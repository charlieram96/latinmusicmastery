import AVFoundation
import XCTest

@testable import PlaySenseAudio

/// Shared helpers for the audio tests: synthetic PCM buffers, a generated sine-sweep WAV fixture
/// (written to a temp file — never downloaded), and an offline manual-rendering harness.
enum AudioTestSupport {

    static let sampleRate = 48_000.0

    /// A mono float buffer of `frames` samples: silence before `onsetFrame`, then a steady tone.
    static func toneBuffer(
        frames: Int,
        onsetFrame: Int = 0,
        frequency: Double = 440,
        amplitude: Float = 0.3,
        sampleRate: Double = sampleRate
    ) -> AVAudioPCMBuffer {
        let format = AVAudioFormat(standardFormatWithSampleRate: sampleRate, channels: 1)!
        let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: AVAudioFrameCount(frames))!
        buffer.frameLength = AVAudioFrameCount(frames)
        let channel = buffer.floatChannelData![0]
        for frame in 0..<frames {
            if frame < onsetFrame {
                channel[frame] = 0
            } else {
                let time = Double(frame - onsetFrame) / sampleRate
                channel[frame] = amplitude * Float(sin(2 * Double.pi * frequency * time))
            }
        }
        return buffer
    }

    /// Write a short sine-sweep WAV to a unique temp URL and return it. Caller deletes when done.
    static func writeSineSweepWAV(
        seconds: Double = 0.25,
        startHz: Double = 300,
        endHz: Double = 3000,
        sampleRate: Double = sampleRate
    ) throws -> URL {
        let format = AVAudioFormat(standardFormatWithSampleRate: sampleRate, channels: 1)!
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("sine-sweep-\(UUID().uuidString).wav")
        let file = try AVAudioFile(forWriting: url, settings: format.settings)

        let frames = Int(seconds * sampleRate)
        let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: AVAudioFrameCount(frames))!
        buffer.frameLength = AVAudioFrameCount(frames)
        let channel = buffer.floatChannelData![0]
        var phase = 0.0
        for frame in 0..<frames {
            let progress = Double(frame) / Double(frames)
            let freq = startHz + (endHz - startHz) * progress
            phase += 2 * Double.pi * freq / sampleRate
            channel[frame] = 0.4 * Float(sin(phase))
        }
        try file.write(from: buffer)
        return url
    }

    /// Render a graph offline through `AVAudioEngine.enableManualRenderingMode` and return channel-0
    /// samples. Throws `ManualRenderingUnavailable` when the platform refuses manual rendering, so the
    /// caller can `XCTSkip` and document rather than fail.
    struct ManualRenderingUnavailable: Error {}

    @discardableResult
    static func renderOffline(
        totalFrames: Int,
        sampleRate: Double = sampleRate,
        build: (AVAudioEngine, _ mixer: AVAudioNode) throws -> Void,
        schedule: () -> Void
    ) throws -> [Float] {
        let engine = AVAudioEngine()
        try build(engine, engine.mainMixerNode)

        guard let renderFormat = AVAudioFormat(standardFormatWithSampleRate: sampleRate, channels: 2) else {
            throw ManualRenderingUnavailable()
        }
        let maxFrames: AVAudioFrameCount = 4096
        do {
            try engine.enableManualRenderingMode(.offline, format: renderFormat, maximumFrameCount: maxFrames)
            try engine.start()
        } catch {
            throw ManualRenderingUnavailable()
        }

        schedule()

        guard let outBuffer = AVAudioPCMBuffer(
            pcmFormat: engine.manualRenderingFormat,
            frameCapacity: engine.manualRenderingMaximumFrameCount
        ) else {
            throw ManualRenderingUnavailable()
        }

        var captured: [Float] = []
        captured.reserveCapacity(totalFrames)
        while captured.count < totalFrames {
            let remaining = totalFrames - captured.count
            let toRender = AVAudioFrameCount(min(remaining, Int(maxFrames)))
            let status = try engine.renderOffline(toRender, to: outBuffer)
            guard status == .success else { break }
            let produced = Int(outBuffer.frameLength)
            if let ch0 = outBuffer.floatChannelData?[0] {
                captured.append(contentsOf: UnsafeBufferPointer(start: ch0, count: produced))
            }
        }

        engine.stop()
        return captured
    }

    /// First frame index whose magnitude exceeds `threshold`, or nil if the signal stays silent.
    static func firstOnset(_ samples: [Float], threshold: Float = 0.05) -> Int? {
        samples.firstIndex { abs($0) > threshold }
    }

    /// Rising-edge onset frames: each index where the signal crosses above `threshold` after at least
    /// `minGap` silent frames. Used to locate discrete metronome clicks.
    static func onsetFrames(_ samples: [Float], threshold: Float = 0.05, minGap: Int = 2000) -> [Int] {
        var onsets: [Int] = []
        var lastLoud = -minGap - 1
        for (index, sample) in samples.enumerated() where abs(sample) > threshold {
            if index - lastLoud > minGap { onsets.append(index) }
            lastLoud = index
        }
        return onsets
    }
}
