import AVFoundation
import Foundation

/// Owns the single `AVAudioEngine` for a PlaySense take and wires the whole graph:
///
///     Metronome.player ─┐
///     stem player 0 ─┐  │
///     stem player 1 ─┼─ backing.submix ─┐
///        …          ─┘                  ├─ engine.mainMixerNode ─ outputNode
///     Metronome.player ─────────────────┘
///
/// `prepare()` builds the graph and leaves the input node instantiated but UNTAPPED (D21 installs the
/// mic tap later). `start(t0Delay:clicks:)` resolves and returns the shared `t0` — the exercise-start
/// anchor in both host-time and output-sample coordinates that D21 onsets and D23 grading reference.
@MainActor
public final class GameAudioEngine {

    /// The one and only engine.
    public let engine = AVAudioEngine()

    private let metronome: Metronome
    private let backing = BackingTrackPlayer()
    private let timebase: HostTimebase
    private var isPrepared = false

    public init(sampleRate: Double = 48_000, timebase: HostTimebase = .system) {
        self.metronome = Metronome(sampleRate: sampleRate)
        self.timebase = timebase
    }

    // MARK: - Backing stems (load before prepare/start)

    /// Load backing stems from URLs (decoded up front).
    public func loadBackingStems(urls: [URL]) throws { try backing.load(urls: urls) }

    /// Load already-decoded backing buffers (debug harness / tests).
    public func loadBackingBuffers(_ buffers: [AVAudioPCMBuffer]) { backing.load(buffers: buffers) }

    /// Set the monitoring mode (speaker-safe halves the backing gain).
    public func setBackingMode(_ mode: BackingTrackPlayer.AudioMode) { backing.setMode(mode) }

    // MARK: - Lifecycle

    /// Build and connect the graph. Idempotent.
    public func prepare() {
        guard !isPrepared else { return }
        let mixer = engine.mainMixerNode
        metronome.attach(to: engine, mixer: mixer)
        backing.attach(to: engine, mixer: mixer)
        // Instantiate the input node so it is live and ready for D21's tap — but install NO tap here.
        _ = engine.inputNode
        engine.prepare()
        isPrepared = true
    }

    /// Start the engine (if needed) and schedule the metronome + backing stems at a freshly resolved
    /// `t0`. `t0Delay` is the requested lead time; it is clamped up so the count-in fits before `t0`.
    @discardableResult
    public func start(t0Delay: TimeInterval, clicks: [ClickEvent]) throws -> T0Anchor {
        if !isPrepared { prepare() }
        if !engine.isRunning { try engine.start() }

        let anchor = resolveAnchor()
        let leadSeconds = max(t0Delay, minimumLead(for: clicks))
        let t0Ticks = GameClock.offsetHostTicks(GameClock.now(), bySeconds: leadSeconds, timebase: timebase)
        let resolved = GameClock.resolveT0(atHostTicks: t0Ticks, anchor: anchor, timebase: timebase)

        let startTime = AVAudioTime(hostTime: t0Ticks)
        metronome.schedule(clicks, at: startTime, timebase: timebase)
        if backing.stemCount > 0 { backing.schedule(at: startTime) }
        return resolved
    }

    /// Stop everything and detach all nodes — no engine or node leaks across sessions.
    public func teardown() {
        metronome.stop()
        backing.stop()
        if engine.isRunning { engine.stop() }
        for node in engine.attachedNodes where node !== engine.outputNode
            && node !== engine.inputNode && node !== engine.mainMixerNode {
            engine.detach(node)
        }
        isPrepared = false
    }

    // MARK: - Helpers

    /// Capture a host/sample render anchor from the running graph. Prefers the main mixer's live
    /// `lastRenderTime`; if the engine has not produced a render time yet, falls back to a synthetic
    /// anchor pinned to `now` at sample 0 (still internally consistent for `t0` resolution).
    private func resolveAnchor() -> RenderAnchor {
        if let render = engine.mainMixerNode.lastRenderTime?.renderAnchor { return render }
        if let render = engine.outputNode.lastRenderTime?.renderAnchor { return render }
        let sampleRate = engine.mainMixerNode.outputFormat(forBus: 0).sampleRate
        return RenderAnchor(hostTicks: GameClock.now(), sampleTime: 0, sampleRate: sampleRate)
    }

    /// Seconds `t0` must sit in the future so the most-negative (count-in) offset still lands after now,
    /// plus a small scheduling safety buffer.
    private func minimumLead(for clicks: [ClickEvent]) -> TimeInterval {
        let earliest = clicks.map(\.offsetSeconds).min() ?? 0
        return max(0, -earliest) + 0.1
    }
}
