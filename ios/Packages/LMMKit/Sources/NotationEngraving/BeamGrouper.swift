import Foundation
import ScoreModel

/// Groups a measure's events into beams — a pure port of VexFlow's `Beam.generateBeams`
/// default grouping (the `createGroups` + `sanitizeGroups` + `getBeamGroups` pipeline in
/// `vexflow/src/beam.ts`).
///
/// PROVENANCE — what "match VexFlow's `generateBeams` defaults" resolves to here:
/// the web renderer (`components/playsense-studio/player/notation/renderers/staff-renderer.tsx`)
/// beams with `Beam.generateBeams(vexNotes, { beamRests: false })` — crucially WITHOUT a
/// `groups` option. VexFlow then falls back to its documented default group size,
/// `new Fraction(2, 8)` = one quarter note (see `generateBeams`:
/// `if (!config.groups || !config.groups.length) config.groups = [new Fraction(2, 8)]`).
/// So the actual, ground-truth rule the web renders — and the one ported here — is:
///
///   1. Walk the events accumulating durations into fixed **1-quarter-note** windows measured
///      from the measure start (NOT the meter's beat length; for 4/4 and 3/4 the two coincide,
///      but for compound meters like 6/8 this default groups by quarter notes — pairs of
///      eighths — exactly as the web draws them, rather than by dotted-quarter beats).
///   2. Split each window on rests (`beamRests: false` → every rest breaks the beam) and on
///      any note a quarter or longer (unbeamable).
///   3. Keep the runs of two-or-more beamable notes; those are the beams.
///
/// The one triplet interaction VexFlow's default has (`unbeamable && note.getTuplet()` doubles
/// the window) only affects quarter-or-longer tuplet members, which are unbeamable anyway — an
/// eighth-note triplet (three members summing to exactly one quarter note) lands in a single
/// window with no special handling, which is why a contiguous eighth-triplet run beams as one
/// group. That is the rule the plan asked us to "document": a triplet run stays in one beam
/// group because its members sum to a whole number of quarter-note windows.
public enum BeamGrouper {
    /// VexFlow's default group size when `generateBeams` is called without `groups`:
    /// `Fraction(2, 8)` = one quarter note, in quarter-note units.
    static let groupSizeQN: Double = 1.0
    private static let eps = 1e-6

    /// The beam groups for one measure's events, each an array of indices into `events` (in
    /// order) with two-or-more contiguous beamable notes. `timeSignature` is accepted for
    /// symmetry with the descriptor pipeline and future meter-aware grouping, but — matching the
    /// web's `generateBeams` default (see the type doc) — the window size is a fixed quarter
    /// note independent of meter.
    public static func beamGroups(events: [EventDescriptor], timeSignature: TimeSignature) -> [[Int]] {
        let windows = windowGroups(events)
        let sanitized = sanitize(windows, events: events)
        return sanitized.filter { $0.count > 1 }
    }

    // MARK: createGroups — accumulate into fixed quarter-note windows

    /// Port of VexFlow `createGroups` for the single-tick-group (fixed 1-QN) default: accumulate
    /// event durations, closing a window whenever the running total reaches (`==`) or overshoots
    /// (`>`) one quarter note. A beamable note that overshoots is pushed to the next window; an
    /// unbeamable one stays (and is split out later by `sanitize`). Faithful to VexFlow down to
    /// the carry arithmetic, so the grouping matches the web for any input.
    private static func windowGroups(_ events: [EventDescriptor]) -> [[Int]] {
        var groups: [[Int]] = []
        var current: [Int] = []
        var carry = 0.0
        for index in events.indices {
            var next: [Int] = []
            current.append(index)
            var ticksPerGroup = groupSizeQN
            let unbeamable = events[index].durationCode.beamCount == 0
            if unbeamable && events[index].triplet { ticksPerGroup *= 2 }
            let total = current.reduce(0.0) { $0 + events[$1].durationQN } + carry

            if total > ticksPerGroup + eps {
                if !unbeamable {
                    next.append(current.removeLast())
                }
                groups.append(current)
                // Single tick-group: VexFlow's `do…while` reduces the overflow modulo the
                // window size. Bounded to stay total even on pathological durations.
                carry = total - ticksPerGroup
                var guardCount = 0
                while carry >= ticksPerGroup - eps, guardCount < 1024 {
                    carry -= ticksPerGroup
                    guardCount += 1
                }
                current = next
            } else if abs(total - ticksPerGroup) < eps {
                groups.append(current)
                carry = 0
                current = next
            }
        }
        if !current.isEmpty { groups.append(current) }
        return groups
    }

    // MARK: sanitizeGroups — break on rests + unbeamable notes

    /// Port of VexFlow `sanitizeGroups` with `beamRests: false` and no `maintainStemDirections`:
    /// every rest and every quarter-or-longer note breaks the run. (VexFlow's own
    /// `sanitizeGroups` uses a `parseInt` that misclassifies `w`/`h`/`q` as beamable, but its
    /// final `getBeamGroups` filter rejects any group still containing one — so breaking on
    /// `beamCount == 0` here yields the identical set of beams while reading correctly.)
    private static func sanitize(_ groups: [[Int]], events: [EventDescriptor]) -> [[Int]] {
        var result: [[Int]] = []
        for group in groups {
            var run: [Int] = []
            for index in group {
                let event = events[index]
                if event.isRest || event.durationCode.beamCount == 0 {
                    if !run.isEmpty { result.append(run); run = [] }
                } else {
                    run.append(index)
                }
            }
            if !run.isEmpty { result.append(run) }
        }
        return result
    }
}
