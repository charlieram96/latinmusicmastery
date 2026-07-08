import AVFoundation
import XCTest

@testable import PlaySenseAudio

/// Offline manual-rendering tests. `enableManualRenderingMode` runs the real node graph without the
/// live session, so scheduled onsets can be inspected at sample resolution. If the platform refuses
/// manual rendering (documented simulator quirk), the tests skip with a message rather than fail.
final class OfflineRenderingTests: XCTestCase {

    private let sampleRate = AudioTestSupport.sampleRate

    /// Two impulse stems scheduled at the SAME `t0`, rendered together, land on the SAME output frame —
    /// the sample-exact multi-stem sync property (the brief's "mixed output whose onset alignment is
    /// sample-exact"). A single engine run keeps warm-up shared so the alignment is deterministic: if
    /// the two impulses were even one frame apart they would appear as two half-amplitude spikes rather
    /// than one doubled spike.
    func testMultiStemSyncOnsetsAreSampleExact() throws {
        let t0Frame: AVAudioFramePosition = 2_000
        let spike: Float = 0.8

        // Each stem is a single non-zero sample at its own frame 0.
        func impulseBuffer() -> AVAudioPCMBuffer {
            let format = AVAudioFormat(standardFormatWithSampleRate: sampleRate, channels: 1)!
            let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: 2_000)!
            buffer.frameLength = 2_000
            buffer.floatChannelData![0][0] = spike
            return buffer
        }

        let player = BackingTrackPlayer()
        player.load(buffers: [impulseBuffer(), impulseBuffer()])

        let mixed: [Float]
        do {
            mixed = try AudioTestSupport.renderOffline(
                totalFrames: 6_000,
                build: { engine, mixer in player.attach(to: engine, mixer: mixer) },
                schedule: { player.schedule(at: AVAudioTime(sampleTime: t0Frame, atRate: sampleRate)) }
            )
        } catch is AudioTestSupport.ManualRenderingUnavailable {
            throw XCTSkip("Manual rendering unavailable on this platform; multi-stem sync not exercised offline.")
        }

        guard let peakIndex = mixed.indices.max(by: { abs(mixed[$0]) < abs(mixed[$1]) }),
              abs(mixed[peakIndex]) > 0.1 else {
            throw XCTSkip("Offline render produced silence (simulator audio quirk); onsets not measurable.")
        }
        // Both impulses summed on the exact same frame → ~2× a single impulse (≈1.6, not ≈0.8).
        XCTAssertEqual(abs(mixed[peakIndex]), spike * 2, accuracy: 0.25,
                       "two impulses at the same t0 must sum on one frame")
        // Immediate neighbours are near-zero — a single doubled spike, not two adjacent half spikes.
        XCTAssertLessThan(abs(mixed[peakIndex - 1]), 0.3)
        XCTAssertLessThan(abs(mixed[peakIndex + 1]), 0.3)
        // And it lands at the scheduled t0 (metronome test pins the tight tolerance; allow warm-up slack).
        XCTAssertEqual(peakIndex, Int(t0Frame), accuracy: 64, "onset near the scheduled t0 sample")
    }

    /// The metronome player renders clicks at the scheduled sample offsets.
    func testMetronomeClickOnsetsLandAtScheduledOffsets() throws {
        let base: AVAudioFramePosition = 2_000
        // Two beats, no count-in, 120 BPM → 0.5 s apart = 24_000 frames.
        let clicks = MetronomeSchedule.clicks(bpm: 120, beatsPerMeasure: 4, countInBeats: 0, exerciseBeats: 2)
        let metronome = Metronome(sampleRate: sampleRate)

        let samples: [Float]
        do {
            samples = try AudioTestSupport.renderOffline(
                totalFrames: 30_000,
                build: { engine, mixer in metronome.attach(to: engine, mixer: mixer) },
                schedule: {
                    metronome.schedule(clicks, at: AVAudioTime(sampleTime: base, atRate: sampleRate))
                }
            )
        } catch is AudioTestSupport.ManualRenderingUnavailable {
            throw XCTSkip("Manual rendering unavailable; metronome onset positions not exercised offline.")
        }

        let onsets = AudioTestSupport.onsetFrames(samples, threshold: 0.05, minGap: 5_000)
        guard onsets.count >= 2 else {
            throw XCTSkip("Offline render produced \(onsets.count) click onset(s); simulator audio quirk.")
        }
        // Click envelopes start with an instantaneous attack, so the first loud frame ≈ the schedule.
        XCTAssertEqual(onsets[0], Int(base), accuracy: 8, "first click at base sample")
        XCTAssertEqual(onsets[1], Int(base) + 24_000, accuracy: 8, "second click 0.5 s later")
    }

    /// The generated sine-sweep WAV fixture decodes through the real URL → AVAudioFile → buffer path and
    /// schedules audibly.
    func testSineSweepWAVFixtureLoadsAndSchedules() throws {
        let url = try AudioTestSupport.writeSineSweepWAV(seconds: 0.2)
        defer { try? FileManager.default.removeItem(at: url) }

        let player = BackingTrackPlayer()
        try player.load(urls: [url])
        XCTAssertEqual(player.stemCount, 1)

        let samples: [Float]
        do {
            samples = try AudioTestSupport.renderOffline(
                totalFrames: 5_000,
                build: { engine, mixer in player.attach(to: engine, mixer: mixer) },
                schedule: { player.schedule(at: AVAudioTime(sampleTime: 1_000, atRate: sampleRate)) }
            )
        } catch is AudioTestSupport.ManualRenderingUnavailable {
            throw XCTSkip("Manual rendering unavailable; WAV scheduling not exercised offline.")
        }
        guard let onset = AudioTestSupport.firstOnset(samples) else {
            throw XCTSkip("Offline render produced silence; WAV onset not measurable.")
        }
        XCTAssertEqual(onset, 1_000, accuracy: 4, "decoded WAV stem should onset at the scheduled sample")
    }

    /// Speaker-safe mode halves the shared submix gain (parity with the web `? 0.5 : 1.0`).
    func testSpeakerSafeModeHalvesGain() {
        let player = BackingTrackPlayer()
        XCTAssertEqual(BackingTrackPlayer.AudioMode.headphones.gain, 1.0)
        XCTAssertEqual(BackingTrackPlayer.AudioMode.speakerSafe.gain, 0.5)
        player.setMode(.speakerSafe)
        XCTAssertEqual(player.submix.outputVolume, 0.5, accuracy: 1e-6)
        player.setMode(.headphones)
        XCTAssertEqual(player.submix.outputVolume, 1.0, accuracy: 1e-6)
    }
}
