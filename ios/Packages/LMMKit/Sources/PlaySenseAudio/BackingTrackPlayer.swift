import AVFoundation
import Foundation

/// Plays N backing stems locked together at a shared `t0`, mirroring `use-backing-track.ts`:
/// stems are decoded up front, every stem starts at the same `AVAudioTime` (sample-accurate multi-stem
/// sync), all route through one shared gain submix, and speaker-safe mode halves the gain to reduce
/// bleed into the mic.
public final class BackingTrackPlayer {

    public enum AudioMode: Equatable, Sendable {
        case headphones
        case speakerSafe

        /// Shared submix gain — 0.5 in speaker-safe mode (matches the web `? 0.5 : 1.0`).
        public var gain: Float { self == .speakerSafe ? 0.5 : 1.0 }
    }

    /// Shared submix all stems route through; its `outputVolume` is the shared gain.
    public let submix = AVAudioMixerNode()

    private var playerNodes: [AVAudioPlayerNode] = []
    private var buffers: [AVAudioPCMBuffer] = []
    private var format: AVAudioFormat?

    public init() {}

    /// Number of loaded stems.
    public var stemCount: Int { buffers.count }

    // MARK: - Loading

    /// Decode stems from URLs into in-memory PCM buffers up front (URL → `AVAudioFile` → buffer). All
    /// stems are assumed equal-length and pre-synced, exactly as the web hook documents.
    public func load(urls: [URL]) throws {
        var decoded: [AVAudioPCMBuffer] = []
        var commonFormat: AVAudioFormat?
        for url in urls {
            let file = try AVAudioFile(forReading: url)
            let processingFormat = file.processingFormat
            guard
                let buffer = AVAudioPCMBuffer(
                    pcmFormat: processingFormat,
                    frameCapacity: AVAudioFrameCount(file.length)
                )
            else {
                throw BackingTrackError.bufferAllocationFailed(url)
            }
            try file.read(into: buffer)
            decoded.append(buffer)
            commonFormat = processingFormat
        }
        buffers = decoded
        format = commonFormat
    }

    /// Provide already-decoded buffers directly (used by the debug harness and offline tests).
    public func load(buffers: [AVAudioPCMBuffer]) {
        self.buffers = buffers
        self.format = buffers.first?.format
    }

    // MARK: - Engine wiring

    /// Attach the submix and one player node per stem, connecting players → submix → `mixer`.
    public func attach(to engine: AVAudioEngine, mixer: AVAudioNode) {
        engine.attach(submix)
        engine.connect(submix, to: mixer, format: format)

        playerNodes = buffers.map { _ in AVAudioPlayerNode() }
        for (node, buffer) in zip(playerNodes, buffers) {
            engine.attach(node)
            engine.connect(node, to: submix, format: buffer.format)
        }
    }

    /// Set the shared submix gain for the given monitoring mode.
    public func setMode(_ mode: AudioMode) {
        submix.outputVolume = mode.gain
    }

    /// Schedule every stem at the SAME `t0` `AVAudioTime` — the sample-accurate multi-stem start.
    public func schedule(at startTime: AVAudioTime) {
        for (node, buffer) in zip(playerNodes, buffers) {
            node.stop()
            node.play()
            node.scheduleBuffer(buffer, at: startTime, options: [], completionHandler: nil)
        }
    }

    public func stop() {
        for node in playerNodes {
            node.stop()
        }
    }

    public enum BackingTrackError: Error, Equatable {
        case bufferAllocationFailed(URL)
    }
}
