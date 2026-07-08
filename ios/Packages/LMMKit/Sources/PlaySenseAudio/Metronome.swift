import AVFoundation
import Foundation

/// The metronome voice: one dedicated `AVAudioPlayerNode` fed pre-rendered click buffers, scheduling
/// the entire exercise (count-in + all beats) sample-accurately at `t0`.
///
/// Unlike the web hook there is no look-ahead timer — iOS can schedule the full track up front, so we
/// hand the player node every click at construction time relative to a single `t0` `AVAudioTime`.
public final class Metronome {
    /// The player node driving click playback. Exposed so the owning engine can attach/connect it.
    public let playerNode = AVAudioPlayerNode()

    private let format: AVAudioFormat
    private let downbeatBuffer: AVAudioPCMBuffer
    private let beatBuffer: AVAudioPCMBuffer

    /// Build the click buffers for a given sample rate. Buffers are rendered once and reused for every
    /// scheduled click (no per-click allocation).
    public init(sampleRate: Double) {
        guard let format = AVAudioFormat(standardFormatWithSampleRate: sampleRate, channels: 1) else {
            fatalError("Failed to create metronome audio format at \(sampleRate) Hz")
        }
        self.format = format
        self.downbeatBuffer = Self.makeBuffer(for: .downbeat, sampleRate: sampleRate, format: format)
        self.beatBuffer = Self.makeBuffer(for: .beat, sampleRate: sampleRate, format: format)
    }

    private static func makeBuffer(for spec: ClickSpec, sampleRate: Double, format: AVAudioFormat) -> AVAudioPCMBuffer {
        let samples = renderClickSamples(spec, sampleRate: sampleRate)
        guard
            let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: AVAudioFrameCount(samples.count)),
            let channel = buffer.floatChannelData
        else {
            fatalError("Failed to allocate click buffer")
        }
        buffer.frameLength = AVAudioFrameCount(samples.count)
        samples.withUnsafeBufferPointer { src in
            channel[0].update(from: src.baseAddress!, count: samples.count)
        }
        return buffer
    }

    /// Attach and connect the player node to `mixer` on the given engine.
    public func attach(to engine: AVAudioEngine, mixer: AVAudioNode) {
        engine.attach(playerNode)
        engine.connect(playerNode, to: mixer, format: format)
    }

    /// Schedule the full click track at `t0` (the exercise-start `AVAudioTime`). Count-in clicks are at
    /// negative offsets, so `t0` must sit at least `countInDuration` in the future.
    public func schedule(_ clicks: [ClickEvent], at startTime: AVAudioTime, timebase: HostTimebase = .system) {
        playerNode.stop()
        playerNode.play()
        for click in clicks {
            let when = startTime.offset(bySeconds: click.offsetSeconds, timebase: timebase)
            let buffer = click.isDownbeat ? downbeatBuffer : beatBuffer
            playerNode.scheduleBuffer(buffer, at: when, options: [], completionHandler: nil)
        }
    }

    public func stop() {
        playerNode.stop()
    }
}
