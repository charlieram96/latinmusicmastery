import Foundation

/// The real-time grading core of a PlaySense session — a faithful port of the onset-processing,
/// tentative-miss, and finish logic in `hooks/use-exercise-session.ts`, lifted out of React refs into one
/// deterministic object.
///
/// ## Isolation
/// Deliberately NOT `@MainActor` and not an `actor`: it is a plain reference type whose mutable state must be
/// touched from a single serial context, which its owner guarantees. In a live session
/// ``SessionCoordinator`` calls it on the main actor and hands it a ``RealDeferredScheduler`` bound to the
/// main queue, so every mutation — direct `ingest`/`checkTentativeMisses`/`finish` calls AND deferred
/// callbacks — is serialized there. The determinism suite drives it synchronously on the test thread with a
/// ``ManualDeferredScheduler``. Keeping the type free of actor isolation is what makes that synchronous,
/// clock-injected testing possible (an `actor` would force `await` at every hop and make the deferred
/// callbacks non-deterministic).
///
/// ## Grading clock
/// Onset timestamps and the clock readings passed to ``checkTentativeMisses(elapsedSeconds:)`` are all in the
/// same monotonic host-seconds domain as `t0` (D20's `T0Anchor.hostSeconds`). Everything is graded relative
/// to `t0`: `relativeTime = onset.timestamp - t0`, exactly as the hook does `onset.timestamp -
/// exerciseStartTime`.
public final class LiveScorer {

    /// Wait for the worklet's post-strum chroma (~80 ms) before grading a chord — port of
    /// `CHORD_GRADE_DELAY_MS`.
    public static let chordGradeDelayMs: Double = 95
    /// Defer a pitched onset with no detectable pitch, re-reading pitch after this delay — port of the
    /// hook's `setTimeout(…, 100)`.
    public static let pitchDeferMs: Double = 100

    // MARK: - Fixed configuration

    private let expectedEvents: [ExpectedEvent]
    private let difficulty: Difficulty
    private let category: InstrumentCategory
    private let calibrationOffsetSec: Double
    private let widenMs: Double
    private let t0Seconds: Double
    private let scheduler: DeferredScheduler

    // MARK: - Injected pitch stream (pitched instruments)

    /// The latest detected fundamental frequency (Hz), mirroring the hook's `pitchDetection.getFrequency()`.
    /// The coordinator's display-link updates this; percussion sessions leave it `nil`.
    public var pitchFrequencyProvider: (() -> Double?)?

    /// Post-onset chroma for a chord strum, keyed by the onset's absolute-timestamp rounded to whole
    /// milliseconds (`round(onsetTimestamp * 1000)`) — the exact key the hook uses on `chromaByOnsetRef`.
    public var chromaProvider: ((Int) -> [Double]?)?

    /// The most recent MIDI note the display-link saw (hook's `lastDetectedMidiRef`) — the last-resort pitch
    /// for a wrong-note catch when an onset carries neither a frequency nor a live pitch reading.
    public var lastDetectedMidiNote: Int?

    // MARK: - Mutable grading state (single-serial-context only)

    private var matchedIndices = Set<Int>()
    private var missDetectedIndices = Set<Int>()
    private var results: [EventResult] = []
    private var extraHits = 0
    private var liveCombo = 0
    private var lastMissCheckIndex = 0
    private var isFinished = false

    // MARK: - Live HUD readouts (port of the hook's current* state)

    public private(set) var currentScore: Double = 0
    public private(set) var currentAccuracy: Double = 0
    public private(set) var currentCombo = 0
    public private(set) var tempoDriftMs: Double = 0
    /// Last grade shown to the player: a ``HitGrade`` rawValue, or `nil` before the first result.
    public private(set) var lastHitGrade: String?

    /// The final, deduplicated + gap-filled results — populated by ``finish(actualDurationSeconds:)``.
    public private(set) var finalResults: [EventResult] = []

    public init(
        expectedEvents: [ExpectedEvent],
        difficulty: Difficulty,
        instrumentCategory: InstrumentCategory,
        calibrationOffsetSec: Double,
        widenMs: Double,
        t0Seconds: Double,
        scheduler: DeferredScheduler
    ) {
        self.expectedEvents = expectedEvents
        self.difficulty = difficulty
        self.category = instrumentCategory
        self.calibrationOffsetSec = calibrationOffsetSec
        self.widenMs = widenMs
        self.t0Seconds = t0Seconds
        self.scheduler = scheduler
    }

    /// Convenience initializer from an ``ExerciseDefinition`` — derives the expected timeline + category, the
    /// same way the hook does in `startExercise`.
    public convenience init(
        exercise: ExerciseDefinition,
        calibrationOffsetSec: Double,
        widenMs: Double,
        t0Seconds: Double,
        scheduler: DeferredScheduler
    ) {
        self.init(
            expectedEvents: generateExpectedTimestamps(exercise),
            difficulty: exercise.difficulty,
            instrumentCategory: getInstrumentCategory(exercise.instrument),
            calibrationOffsetSec: calibrationOffsetSec,
            widenMs: widenMs,
            t0Seconds: t0Seconds,
            scheduler: scheduler
        )
    }

    /// The live grading snapshot the HUD renders (throttled by the coordinator).
    public var snapshot: Snapshot {
        Snapshot(
            score: currentScore,
            accuracy: currentAccuracy,
            combo: currentCombo,
            tempoDriftMs: tempoDriftMs,
            lastHitGrade: lastHitGrade,
            results: results,
            extraHits: extraHits
        )
    }

    public struct Snapshot: Equatable, Sendable {
        public let score: Double
        public let accuracy: Double
        public let combo: Int
        public let tempoDriftMs: Double
        public let lastHitGrade: String?
        public let results: [EventResult]
        public let extraHits: Int
    }

    // MARK: - Onset ingestion

    /// Process one detected onset — the port of the hook's per-onset loop body. Routes to chord reservation,
    /// pitched deferral, or immediate single-onset grading.
    ///
    /// Onsets whose corrected time precedes `t0` are dropped without scoring: they are count-in-period taps,
    /// which the hook discards wholesale (its `readyToGrade` index sync) so they never become extra hits.
    public func ingest(_ onset: OnsetEvent) {
        guard !isFinished else { return }
        let relativeTime = onset.timestamp - t0Seconds
        guard relativeTime >= 0 else { return }

        // Chord routing: an onset landing on a chord-group event reserves the whole group now (so later
        // onsets and the miss-detector skip it) and defers grading to await the post-strum chroma.
        if category == .pitched, routeChordIfNeeded(onset: onset, relativeTime: relativeTime) {
            return
        }

        // Pitched: prefer the onset's own frequency, else the live pitch reading, else the last MIDI seen.
        let pitchFrequency = onset.frequency ?? pitchFrequencyProvider?()
        let detectedMidi: Int? = category == .pitched
            ? (pitchFrequency.map(frequencyToMidi) ?? lastDetectedMidiNote)
            : nil
        let detectedFrequency: Double? = category == .pitched ? pitchFrequency : nil

        // Pitched with no pitch yet — defer 100 ms and re-read pitch before grading.
        if category == .pitched, detectedMidi == nil {
            let deferred = onset
            scheduler.schedule(afterMilliseconds: Self.pitchDeferMs) { [weak self] in
                self?.gradePitchDeferred(onset: deferred)
            }
            return
        }

        var matched = matchedIndices
        let result = gradeSingleOnset(
            onsetTimestamp: relativeTime,
            onsetEnergy: onset.energy,
            expectedEvents: expectedEvents,
            matchedIndices: &matched,
            difficulty: difficulty,
            calibrationOffsetSec: calibrationOffsetSec,
            widenMs: widenMs,
            instrumentCategory: category,
            detectedMidiNote: detectedMidi,
            detectedFrequency: detectedFrequency,
            detectedSurface: onset.surface
        )
        matchedIndices = matched
        applySingleResult(result)
    }

    /// Reserve + schedule a chord group if `onset` lands on one; returns `true` when it did (so `ingest`
    /// stops). Pitched-only path.
    private func routeChordIfNeeded(onset: OnsetEvent, relativeTime: Double) -> Bool {
        let candidate = matchOnsetToExpected(
            onsetTimestamp: relativeTime,
            expectedEvents: expectedEvents,
            matchedIndices: matchedIndices,
            difficulty: difficulty,
            calibrationOffsetSec: calibrationOffsetSec,
            widenMs: widenMs
        )
        guard let chordId = candidate?.chordId else { return false }
        for event in expectedEvents where event.chordId == chordId {
            matchedIndices.insert(event.eventIndex)
        }
        let onsetTimestamp = onset.timestamp
        let energy = onset.energy
        scheduler.schedule(afterMilliseconds: Self.chordGradeDelayMs) { [weak self] in
            self?.gradeChordDeferred(onsetTimestamp: onsetTimestamp, energy: energy, chordId: chordId)
        }
        return true
    }
}

// MARK: - Deferred grading, tentative miss, finish

extension LiveScorer {

    private func gradeChordDeferred(onsetTimestamp: Double, energy: Double, chordId: String) {
        guard !isFinished else { return }
        let chromaKey = Int((onsetTimestamp * 1000).rounded())
        let chroma = chromaProvider?(chromaKey)
        var matched = matchedIndices
        let chordResults = gradeChordOnset(
            onsetTimestamp: onsetTimestamp - t0Seconds,
            onsetEnergy: energy,
            expectedEvents: expectedEvents,
            matchedIndices: &matched,
            chordId: chordId,
            difficulty: difficulty,
            calibrationOffsetSec: calibrationOffsetSec,
            widenMs: widenMs,
            chroma: chroma
        )
        matchedIndices = matched
        guard !chordResults.isEmpty else { return }

        // Replace any tentative misses recorded for these events.
        for result in chordResults where missDetectedIndices.contains(result.eventIndex) {
            missDetectedIndices.remove(result.eventIndex)
            results.removeAll { $0.eventIndex == result.eventIndex && $0.grade == .miss }
        }

        results.append(contentsOf: chordResults)
        lastHitGrade = chordResults[0].grade.rawValue

        // Combo: the chord counts as a single unit.
        if chordResults.contains(where: { $0.grade != .miss }) {
            liveCombo += 1
        } else {
            liveCombo = 0
        }
        currentCombo = liveCombo
        recomputeLiveStats()
    }

    private func gradePitchDeferred(onset: OnsetEvent) {
        guard !isFinished else { return }
        let delayedFrequency = pitchFrequencyProvider?()
        let delayedMidi = delayedFrequency.map(frequencyToMidi)
        var matched = matchedIndices
        let result = gradeSingleOnset(
            onsetTimestamp: onset.timestamp - t0Seconds,
            onsetEnergy: onset.energy,
            expectedEvents: expectedEvents,
            matchedIndices: &matched,
            difficulty: difficulty,
            calibrationOffsetSec: calibrationOffsetSec,
            widenMs: widenMs,
            instrumentCategory: category,
            detectedMidiNote: delayedMidi,
            detectedFrequency: delayedFrequency,
            detectedSurface: onset.surface
        )
        matchedIndices = matched
        applySingleResult(result)
    }

    /// Shared tail of the immediate + deferred-pitch single-onset paths (hook lines 439-481 / 394-419):
    /// un-miss on a late hit, append, combo, live stats — or count an extra hit when nothing matched.
    private func applySingleResult(_ result: EventResult?) {
        guard let result else {
            // Extra hit: the hook only increments the counter here — live stats are NOT recomputed until
            // the next successful grade (or finish), so the on-screen score doesn't twitch per stray hit.
            extraHits += 1
            return
        }
        if missDetectedIndices.contains(result.eventIndex) {
            missDetectedIndices.remove(result.eventIndex)
            results.removeAll { $0.eventIndex == result.eventIndex && $0.grade == .miss }
        }
        results.append(result)
        lastHitGrade = result.grade.rawValue
        if result.grade != .miss {
            liveCombo += 1
        } else {
            liveCombo = 0
        }
        currentCombo = liveCombo
        recomputeLiveStats()
    }

    // MARK: - Tentative miss detection

    /// Real-time miss detection — port of the `updatePlayhead` miss loop. Any unmatched expected event whose
    /// Ok window (+200 ms buffer) has fully passed is tentatively marked a miss; a later real hit can still
    /// UN-miss it (miss detection uses a separate `missDetectedIndices` set, so `gradeSingleOnset` can still
    /// match a late onset).
    ///
    /// `elapsedSeconds` is the time since `t0` (`now - t0`), matching the hook's `elapsed`.
    public func checkTentativeMisses(elapsedSeconds: Double) {
        guard !isFinished else { return }
        let okWindowSec = (difficulty.toleranceWindows.ok + 200) / 1000
        let correctedTime = elapsedSeconds - calibrationOffsetSec
        var missDetected = false

        var index = lastMissCheckIndex
        while index < expectedEvents.count {
            let event = expectedEvents[index]
            if correctedTime < event.timestamp + okWindowSec { break }
            if matchedIndices.contains(event.eventIndex) || missDetectedIndices.contains(event.eventIndex) {
                lastMissCheckIndex = index + 1
                index += 1
                continue
            }
            results.append(EventResult(
                eventIndex: event.eventIndex,
                grade: .miss,
                offsetMs: nil,
                timing: nil,
                onsetEnergy: nil
            ))
            missDetectedIndices.insert(event.eventIndex)
            liveCombo = 0
            missDetected = true
            lastMissCheckIndex = index + 1
            index += 1
        }

        if missDetected {
            currentCombo = 0
            lastHitGrade = HitGrade.miss.rawValue
            recomputeLiveStats()
        }
    }

    // MARK: - Finish

    /// Finalize the attempt — port of `finishExercise`'s result assembly. Cancels deferred work, dedupes by
    /// `eventIndex` (preferring a non-miss over a miss), fills every unmatched expected event as a miss,
    /// sorts by `eventIndex`, and returns the aggregate ``AttemptStats``. Idempotent.
    @discardableResult
    public func finish(actualDurationSeconds: Double) -> AttemptStats {
        if isFinished {
            return computeStats(results: finalResults, extraHits: extraHits, durationSeconds: actualDurationSeconds)
        }
        isFinished = true
        scheduler.cancelAll()

        var byIndex: [Int: EventResult] = [:]
        for result in results {
            if let existing = byIndex[result.eventIndex] {
                if existing.grade == .miss, result.grade != .miss {
                    byIndex[result.eventIndex] = result
                }
            } else {
                byIndex[result.eventIndex] = result
            }
        }
        for event in expectedEvents where byIndex[event.eventIndex] == nil {
            byIndex[event.eventIndex] = EventResult(
                eventIndex: event.eventIndex,
                grade: .miss,
                offsetMs: nil,
                timing: nil,
                onsetEnergy: nil
            )
        }

        let allResults = byIndex.values.sorted { $0.eventIndex < $1.eventIndex }
        finalResults = allResults
        return computeStats(results: allResults, extraHits: extraHits, durationSeconds: actualDurationSeconds)
    }

    // MARK: - Helpers

    private func recomputeLiveStats() {
        let stats = computeStats(results: results, extraHits: extraHits, durationSeconds: 0)
        currentScore = stats.score
        currentAccuracy = stats.accuracy
        tempoDriftMs = stats.tempoDriftMs
    }
}
