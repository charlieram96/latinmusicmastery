import AVFoundation
import Foundation
import LMMData
import Observation

/// A caption language available in the picker (mirrors the web's `SubtitleTrackDef`).
struct LessonSubtitleTrack: Equatable {
    let lang: SubtitleLang
    let label: String
    let url: URL
}

// swiftlint:disable identifier_name
/// The two caption languages the app carries (web parity: `subtitles_en_url` / `subtitles_es_url`).
enum SubtitleLang: String, Equatable {
    case en
    case es
    // swiftlint:enable identifier_name

    var label: String {
        switch self {
        case .en: return "English"
        case .es: return "Español"
        }
    }
}

/// Owns the `AVPlayer` for one lesson video and publishes the state the custom SwiftUI controls
/// render. The player is the source of truth: control methods mutate it, and its observers flow
/// back into the published state — no two-way sync.
///
/// Persistence policy (heartbeat throttle + fire-once completion) is delegated to the pure
/// ``VideoProgressTracker``; A–B loop policy to the pure ``ABLoop``. Teardown removes every
/// observer and nils the item so there are no retain cycles or leaked periodic observers — every
/// escaping closure captures `self` weakly.
@MainActor
@Observable
final class LessonVideoPlayerModel {
    // MARK: Published state
    private(set) var currentSeconds: Double = 0
    private(set) var durationSeconds: Double = 0
    private(set) var isPlaying = false
    private(set) var bufferedSeconds: Double = 0
    private(set) var isReady = false
    private(set) var hasStarted = false
    var playbackRate: Double = 1
    var loop = ABLoop()
    var isFullscreen = false

    private(set) var availableSubtitles: [LessonSubtitleTrack] = []
    private(set) var activeSubtitle: SubtitleLang?
    private(set) var activeCueText: String?

    // MARK: Playback
    @ObservationIgnored let player: AVPlayer

    // MARK: Persistence hooks (wired by the class viewer)
    @ObservationIgnored var onPersistPosition: (@MainActor (Int) -> Void)?
    @ObservationIgnored var onReachedCompletion: (@MainActor () -> Void)?

    // MARK: Private
    @ObservationIgnored private var tracker: VideoProgressTracker
    @ObservationIgnored private let resumeSeconds: Int?
    @ObservationIgnored private var didSeekToResume = false
    @ObservationIgnored private var cues: [SubtitleLang: [SubtitleCue]] = [:]

    @ObservationIgnored private var timeObserver: Any?
    @ObservationIgnored private var statusObservation: NSKeyValueObservation?
    @ObservationIgnored private var bufferObservation: NSKeyValueObservation?
    @ObservationIgnored private var timeControlObservation: NSKeyValueObservation?
    @ObservationIgnored private var endObserver: NSObjectProtocol?

    static let speeds: [Double] = [0.5, 0.75, 1, 1.25, 1.5, 2]

    init(url: URL, resumeSeconds: Int?, alreadyComplete: Bool, defaultSubtitle: SubtitleLang?) {
        self.resumeSeconds = resumeSeconds
        self.tracker = VideoProgressTracker(resumeSecond: resumeSeconds, alreadyComplete: alreadyComplete)
        self.activeSubtitle = defaultSubtitle
        let item = AVPlayerItem(url: url)
        // Preserve pitch when the student slows a lesson down to hear a pattern.
        item.audioTimePitchAlgorithm = .timeDomain
        self.player = AVPlayer(playerItem: item)
        self.player.automaticallyWaitsToMinimizeStalling = true
        wireObservers(item: item)
    }

    // MARK: - Transport

    func play() {
        hasStarted = true
        player.rate = Float(playbackRate)
    }

    func pause() {
        player.pause()
        flushPosition()
    }

    func togglePlayPause() {
        if isPlaying { pause() } else { play() }
    }

    func seek(to seconds: Double) {
        let clamped = max(0, min(seconds, durationSeconds > 0 ? durationSeconds : seconds))
        currentSeconds = clamped
        let target = CMTime(seconds: clamped, preferredTimescale: 600)
        player.seek(to: target, toleranceBefore: .zero, toleranceAfter: .zero)
        updateActiveCue()
    }

    func skip(_ delta: Double) {
        seek(to: currentSeconds + delta)
    }

    func setPlaybackRate(_ rate: Double) {
        playbackRate = rate
        if isPlaying { player.rate = Float(rate) }
    }

    // MARK: - A/B loop

    func setLoopA() { loop.setA(currentSeconds) }
    func setLoopB() { loop.setB(currentSeconds) }
    func toggleLoopEnabled() { loop.setEnabled(!loop.isEnabled) }
    func clearLoop() { loop.clear() }

    // MARK: - Subtitles

    func setActiveSubtitle(_ lang: SubtitleLang?) {
        activeSubtitle = lang
        UserDefaults.standard.set(lang?.rawValue ?? "off", forKey: Self.subtitlePrefKey)
        updateActiveCue()
    }

    static let subtitlePrefKey = "lmm.subtitle.pref"

    /// Fetches + parses the VTT sidecars off the main actor, then publishes the tracks that
    /// actually loaded. Silent on failure — a dead sidecar just means that language is absent.
    func loadSubtitles(_ tracks: [LessonSubtitleTrack]) async {
        var loaded: [LessonSubtitleTrack] = []
        var parsed: [SubtitleLang: [SubtitleCue]] = [:]
        for track in tracks {
            guard let text = try? await fetchText(track.url) else { continue }
            let vttCues = WebVTTParser.parse(text)
            guard !vttCues.isEmpty else { continue }
            parsed[track.lang] = vttCues
            loaded.append(track)
        }
        cues = parsed
        availableSubtitles = loaded
        // Honor a stored preference, else keep the locale default if it actually loaded.
        if let stored = UserDefaults.standard.string(forKey: Self.subtitlePrefKey) {
            if stored == "off" {
                activeSubtitle = nil
            } else if let lang = SubtitleLang(rawValue: stored), parsed[lang] != nil {
                activeSubtitle = lang
            }
        }
        if let active = activeSubtitle, parsed[active] == nil {
            activeSubtitle = nil
        }
        updateActiveCue()
    }

    private nonisolated func fetchText(_ url: URL) async throws -> String {
        let (data, _) = try await URLSession.shared.data(from: url)
        return String(bytes: data, encoding: .utf8) ?? ""
    }

    // MARK: - Persistence

    /// Called on pause, view disappear, and app background.
    func flushPosition() {
        guard isReady else { return }
        let decision = tracker.flush(currentSeconds: currentSeconds, durationSeconds: durationSeconds)
        apply(decision)
    }

    // MARK: - Lifecycle

    /// Idempotent teardown. Safe to call from `onDisappear`; also called from `deinit`.
    func teardown() {
        if let timeObserver {
            player.removeTimeObserver(timeObserver)
            self.timeObserver = nil
        }
        statusObservation?.invalidate(); statusObservation = nil
        bufferObservation?.invalidate(); bufferObservation = nil
        timeControlObservation?.invalidate(); timeControlObservation = nil
        if let endObserver {
            NotificationCenter.default.removeObserver(endObserver)
            self.endObserver = nil
        }
        player.pause()
        player.replaceCurrentItem(with: nil)
    }

    deinit {
        // deinit can't touch main-actor state; remove the only non-isolated observers here.
        // The view's onDisappear already runs the full teardown on the main actor.
        if let timeObserver { player.removeTimeObserver(timeObserver) }
        statusObservation?.invalidate()
        bufferObservation?.invalidate()
        timeControlObservation?.invalidate()
        if let endObserver { NotificationCenter.default.removeObserver(endObserver) }
        #if DEBUG
        print("LessonVideoPlayerModel deinit — observers released")
        #endif
    }

    // MARK: - Observer wiring

    private func wireObservers(item: AVPlayerItem) {
        // Smooth cursor + heartbeat + loop wrap + caption sync (~4 Hz).
        let interval = CMTime(seconds: 0.25, preferredTimescale: 600)
        timeObserver = player.addPeriodicTimeObserver(forInterval: interval, queue: .main) { [weak self] time in
            guard let self else { return }
            MainActor.assumeIsolated { self.onTick(seconds: time.seconds) }
        }

        // AVFoundation fires raw NSKeyValueObservation callbacks on whatever thread the KVO'd
        // property actually changed on — unlike the periodic time observer / notification
        // observer above (both pinned to queue .main), there's no guarantee this is the main
        // thread. `MainActor.assumeIsolated` would trap the moment that assumption is wrong, so
        // hop explicitly instead.
        statusObservation = item.observe(\.status, options: [.new]) { [weak self] item, _ in
            guard let self else { return }
            Task { @MainActor in self.onStatusChange(item) }
        }

        bufferObservation = item.observe(\.loadedTimeRanges, options: [.new]) { [weak self] item, _ in
            guard let self else { return }
            Task { @MainActor in self.onBufferChange(item) }
        }

        timeControlObservation = player.observe(\.timeControlStatus, options: [.new]) { [weak self] player, _ in
            guard let self else { return }
            Task { @MainActor in self.isPlaying = player.timeControlStatus == .playing }
        }

        endObserver = NotificationCenter.default.addObserver(
            forName: .AVPlayerItemDidPlayToEndTime,
            object: item,
            queue: .main
        ) { [weak self] _ in
            guard let self else { return }
            MainActor.assumeIsolated { self.onPlaybackEnded() }
        }
    }

    private func onTick(seconds: Double) {
        guard seconds.isFinite else { return }
        // Wrap the A/B loop before publishing so the cursor never overshoots B.
        if let target = loop.loopTarget(currentSeconds: seconds) {
            seek(to: target)
            return
        }
        currentSeconds = seconds
        updateActiveCue()
        // Heartbeat only advances while actually playing.
        if isPlaying {
            let decision = tracker.tick(currentSeconds: seconds, durationSeconds: durationSeconds)
            apply(decision)
        }
    }

    private func onStatusChange(_ item: AVPlayerItem) {
        guard item.status == .readyToPlay else { return }
        let seconds = item.duration.seconds
        if seconds.isFinite, seconds > 0 { durationSeconds = seconds }
        isReady = true
        if !didSeekToResume, let resumeSeconds, resumeSeconds > 0,
           durationSeconds == 0 || Double(resumeSeconds) < durationSeconds - 1 {
            didSeekToResume = true
            seek(to: Double(resumeSeconds))
        } else {
            didSeekToResume = true
        }
    }

    private func onBufferChange(_ item: AVPlayerItem) {
        guard let range = item.loadedTimeRanges.last?.timeRangeValue else { return }
        bufferedSeconds = range.start.seconds + range.duration.seconds
    }

    private func onPlaybackEnded() {
        isPlaying = false
        let decision = tracker.end(durationSeconds: durationSeconds)
        apply(decision)
    }

    private func apply(_ decision: VideoProgressDecision) {
        if let position = decision.writePosition { onPersistPosition?(position) }
        if decision.markComplete { onReachedCompletion?() }
    }

    private func updateActiveCue() {
        guard let active = activeSubtitle, let list = cues[active] else {
            activeCueText = nil
            return
        }
        activeCueText = WebVTTParser.activeCue(at: currentSeconds, in: list)
    }
}
