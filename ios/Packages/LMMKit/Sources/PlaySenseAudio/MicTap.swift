import AVFoundation
import Foundation
import PlaySenseCore

/// Installs a realtime-safe microphone tap on an `AVAudioEngine`'s input node and runs the
/// ``OnsetDetector`` over it.
///
/// ## Threading / realtime design
/// - **Tap callback** (audio render thread): does the minimum — grabs channel-0 `floatChannelData`,
///   the frame count, and the buffer's `AVAudioTime.hostTime`, and `memcpy`s them into a preallocated
///   lock-free SPSC ring (``AudioSampleRing``). No allocation, no locks, no Objective-C dispatch, no
///   logging. If the drain falls behind, the ring drops the buffer rather than block the audio thread.
/// - **Drain** (dedicated `.userInteractive` serial queue): a timer polls the ring every few ms —
///   the audio thread never signals the consumer (which would mean dispatch from the RT thread).
///   Each drained buffer is fed to the detector in 128-sample sub-blocks (the worklet's render-quantum
///   granularity), with each sub-block's `blockTime` derived from the buffer's input `hostTime` via
///   `GameClock.hostSeconds` — so onset timestamps share the `T0Anchor.hostSeconds` domain.
/// - `onMessage` is invoked on the drain queue; UI consumers must hop to the main actor.
public final class MicTap {

    private let engine: AVAudioEngine
    private let detector = OnsetDetector()
    private let onMessage: (OnsetDetectorMessage) -> Void

    private let drainQueue = DispatchQueue(label: "com.lmm.playsense.onset-drain", qos: .userInteractive)
    private var drainTimer: DispatchSourceTimer?

    private var ring: AudioSampleRing?
    private var drainScratch: [Float] = []
    private var sampleRate: Double = 48_000
    private var installed = false

    private let slotFrames: Int
    private let tapBufferSize: AVAudioFrameCount

    public init(
        engine: AVAudioEngine,
        slotFrames: Int = 8192,
        ringCapacity: Int = 32,
        tapBufferSize: AVAudioFrameCount = 256,
        onMessage: @escaping (OnsetDetectorMessage) -> Void
    ) {
        self.engine = engine
        self.slotFrames = slotFrames
        self.tapBufferSize = tapBufferSize
        self.onMessage = onMessage
        self.ring = AudioSampleRing(capacity: ringCapacity, slotFrames: slotFrames)
        self.drainScratch = [Float](repeating: 0, count: slotFrames)
    }

    /// Configure the detector and install the tap. Safe to call once; a second call is a no-op until
    /// ``remove()``.
    public func install(config: OnsetConfig) {
        guard !installed, let ring else { return }
        let input = engine.inputNode
        let format = input.outputFormat(forBus: 0)
        sampleRate = format.sampleRate > 0 ? format.sampleRate : 48_000
        detector.configure(config: config, sampleRate: sampleRate)

        input.installTap(onBus: 0, bufferSize: tapBufferSize, format: format) { buffer, when in
            // --- realtime tap thread: copy-only, allocation-free, lock-free ---
            guard let channel = buffer.floatChannelData?[0] else { return }
            let frames = Int(buffer.frameLength)
            if frames == 0 { return }
            let hostTime = when.isHostTimeValid ? when.hostTime : mach_absolute_time()
            ring.push(channel, frames: frames, hostTime: hostTime)
        }

        let timer = DispatchSource.makeTimerSource(queue: drainQueue)
        timer.schedule(deadline: .now(), repeating: .milliseconds(5), leeway: .milliseconds(2))
        timer.setEventHandler { [weak self] in self?.drain() }
        drainTimer = timer
        timer.resume()
        installed = true
    }

    /// Remove the tap and stop draining.
    public func remove() {
        guard installed else { return }
        engine.inputNode.removeTap(onBus: 0)
        drainTimer?.cancel()
        drainTimer = nil
        installed = false
    }

    /// Buffers dropped because the ring was full (overrun diagnostics).
    public var dropCount: UInt64 { ring?.dropCount ?? 0 }

    // MARK: - Drain

    private func drain() {
        guard let ring else { return }
        drainScratch.withUnsafeMutableBufferPointer { scratch in
            let dst = scratch.baseAddress!
            while let (frames, hostTime) = ring.pop(into: dst) {
                let baseSeconds = GameClock.hostSeconds(fromTicks: hostTime)
                var offset = 0
                while offset < frames {
                    let len = Swift.min(128, frames - offset)
                    let blockTime = baseSeconds + Double(offset) / sampleRate
                    let sub = UnsafeBufferPointer(start: dst + offset, count: len)
                    detector.process(sub, blockTime: blockTime, emit: onMessage)
                    offset += len
                }
            }
        }
    }
}
