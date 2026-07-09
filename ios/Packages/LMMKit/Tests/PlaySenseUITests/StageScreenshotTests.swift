import Metal
import PlaySenseBLE
import PlaySenseCore
import PlaySenseHighway
import ScoreModel
import SpriteKit
import SwiftUI
import UIKit
import XCTest

@testable import PlaySenseUI

/// Deterministic screenshots of the real PlaySense stage for the D24 deliverable. The highway is
/// rendered head-lessly with `SKRenderer` into an offscreen Metal texture at a controlled playhead
/// (so notes sit exactly where we want, with hit/miss choreography frozen mid-flight), and the real
/// SwiftUI chrome (count-in, HUD, results) is rendered with `ImageRenderer` and composited on top —
/// the same views the live `StagePlayerView` shows. Opt-in via `RUN_STAGE_SHOTS=1`; PNGs land in
/// `STAGE_SHOT_DIR`.
final class StageScreenshotTests: XCTestCase {

    private var outputDir: URL?

    override func setUpWithError() throws {
        let env = ProcessInfo.processInfo.environment
        guard env["RUN_STAGE_SHOTS"] == "1" else {
            throw XCTSkip("Set RUN_STAGE_SHOTS=1 (and STAGE_SHOT_DIR) to render stage screenshots.")
        }
        guard MTLCreateSystemDefaultDevice() != nil else {
            throw XCTSkip("No Metal device available for offscreen highway rendering.")
        }
        outputDir = URL(fileURLWithPath: env["STAGE_SHOT_DIR"] ?? NSTemporaryDirectory())
    }

    private let size = CGSize(width: 402, height: 874)

    @MainActor
    func testRenderStageScreenshots() throws {
        let exercise = StagePlayerView.sampleExercise
        let duration = getExerciseDuration(exercise) // 4.8s conga groove

        // 1) Count-in: notes waiting near the top; the 3-2-1 overlay with beat pulse.
        try shoot(
            name: "01-countdown",
            highway: highway(exercise: exercise, playhead: 0, warm: 0.3),
            chrome: AnyView(CountdownOverlay(beat: 3, onCancel: {}))
        )

        // 2) Mid-play: notes falling, a PERFECT hit flash at the line, live HUD.
        try shoot(
            name: "02-midplay-hit",
            highway: highway(exercise: exercise, playhead: 1.8 / duration, warm: 0.13) { scene in
                scene.currentScore = 1240
                scene.currentCombo = 6
                scene.triggerHitEffect(eventIndex: 3, grade: .perfect) // note at 1.8s sits on the line
            },
            chrome: AnyView(StagePlayingChrome(
                score: 1240, combo: 6, accuracy: 98, lastGrade: "perfect", comboFlare: true, onQuit: {}
            ))
        )

        // 3) Miss: a note breaks through the glass — ripple + red seep + sinking pill.
        try shoot(
            name: "03-miss",
            highway: highway(exercise: exercise, playhead: 1.35 / duration, warm: 0.25),
            chrome: AnyView(StagePlayingChrome(
                score: 640, combo: 0, accuracy: 71, lastGrade: "miss", comboFlare: false, onQuit: {}
            ))
        )

        // 4) Results: the design-system panel over the dimmed highway.
        try shoot(
            name: "04-results",
            highway: highway(exercise: exercise, playhead: 1, warm: 0.5),
            chrome: AnyView(StageResultsView(
                stats: Self.sampleStats, results: Self.sampleResults, isPractice: false,
                onRetry: {}, onExit: {}
            ))
        )

        try shootResultsPersistStates(exercise: exercise)

        // 5) Fix round 1 (D25's review, finding 2): mode-select with a surfaced BLE connect-failure error —
        // previously rendered NOWHERE. `debugForceModeSelectError` deterministically forces the state a
        // real Simulator's `.unsupported` CoreBluetooth stack would otherwise reach on its own.
        let modeSelectView = StagePlayerView(exercise: exercise, startMode: nil)
        modeSelectView.coordinator.present(exercise: exercise)
        modeSelectView.coordinator.debugForceModeSelectError(PlaySenseBLEErrorMessage.bluetoothUnsupported)
        try shoot(
            name: "05-modeselect-error",
            highway: highway(exercise: exercise, playhead: 0, warm: 0),
            chrome: AnyView(modeSelectView.modeSelectOverlay)
        )
    }

    /// D26: the results panel while the attempt is saving, and after it's been queued offline
    /// (`AttemptPersistState` — see `SessionCoordinator.persistAttemptIfNeeded`). Split out of
    /// `testRenderStageScreenshots` to stay under SwiftLint's `function_body_length`.
    @MainActor
    private func shootResultsPersistStates(exercise: ExerciseDefinition) throws {
        try shoot(
            name: "04b-results-saving",
            highway: highway(exercise: exercise, playhead: 1, warm: 0.5),
            chrome: AnyView(StageResultsView(
                stats: Self.sampleStats, results: Self.sampleResults, isPractice: false,
                persistState: .saving, onRetry: {}, onExit: {}
            ))
        )
        try shoot(
            name: "04c-results-queued",
            highway: highway(exercise: exercise, playhead: 1, warm: 0.5),
            chrome: AnyView(StageResultsView(
                stats: Self.sampleStats, results: Self.sampleResults, isPractice: false,
                persistState: .queued, onRetry: {}, onExit: {}
            ))
        )
    }

    // MARK: - Highway offscreen render

    @MainActor
    private func highway(
        exercise: ExerciseDefinition, playhead: Double, warm: Double, mutate: ((HighwayScene) -> Void)? = nil
    ) -> UIImage {
        let scene = HighwayScene(size: size)
        scene.size = size
        scene.configure(exercise: exercise)
        scene.playheadProgress = playhead
        mutate?(scene)
        // Advance a few frames so the ambient scene settles and hit/miss particles reach mid-life;
        // fixed playhead keeps notes stationary while choreography animates.
        let frames = stride(from: 0.0, through: warm, by: 1.0 / 60).map { $0 }
        return MetalSceneRenderer.render(scene: scene, size: size, times: frames)
    }

    // MARK: - Composite + write

    @MainActor
    private func shoot(name: String, highway: UIImage, chrome: AnyView) throws {
        let renderer = ImageRenderer(content: chrome.frame(width: size.width, height: size.height))
        renderer.scale = 2
        renderer.isOpaque = false
        let chromeImage = renderer.uiImage

        let format = UIGraphicsImageRendererFormat.preferred()
        format.scale = 2
        format.opaque = true
        let composite = UIGraphicsImageRenderer(size: size, format: format).image { _ in
            highway.draw(in: CGRect(origin: .zero, size: size))
            chromeImage?.draw(in: CGRect(origin: .zero, size: size))
        }

        guard let dir = outputDir, let data = composite.pngData() else {
            return XCTFail("no output dir / png encode failed for \(name)")
        }
        let url = dir.appendingPathComponent("stage-\(name).png")
        try data.write(to: url)
        XCTAssertTrue(FileManager.default.fileExists(atPath: url.path), "wrote \(url.lastPathComponent)")
    }

    // MARK: - Sample results

    private static let sampleResults: [EventResult] = {
        let grades: [HitGrade] = [.perfect, .perfect, .good, .perfect, .ok, .perfect, .good, .miss,
                                  .perfect, .perfect, .good, .perfect, .ok, .perfect, .perfect, .good]
        return grades.enumerated().map {
            EventResult(eventIndex: $0.offset, grade: $0.element, offsetMs: 12, timing: .onTime, onsetEnergy: 1)
        }
    }()

    private static let sampleStats = AttemptStats(
        score: 88, accuracy: 91, perfectCount: 9, goodCount: 4, okCount: 2, missCount: 1, extraHits: 0,
        maxCombo: 7, maxStreak: 7, avgOffsetMs: 12, tempoDriftMs: 3, durationSeconds: 4.8, pitchAccuracy: nil
    )
}

// MARK: - Metal offscreen scene renderer

private enum MetalSceneRenderer {
    @MainActor
    static func render(scene: HighwayScene, size: CGSize, times: [Double]) -> UIImage {
        guard let device = MTLCreateSystemDefaultDevice(),
              let queue = device.makeCommandQueue() else { return UIImage() }
        let renderer = SKRenderer(device: device)
        renderer.scene = scene

        let scale: CGFloat = 2
        let width = Int(size.width * scale), height = Int(size.height * scale)
        let desc = MTLTextureDescriptor.texture2DDescriptor(
            pixelFormat: .bgra8Unorm, width: width, height: height, mipmapped: false
        )
        desc.usage = [.renderTarget, .shaderRead]
        guard let texture = device.makeTexture(descriptor: desc) else { return UIImage() }

        let viewport = CGRect(x: 0, y: 0, width: width, height: height)
        for time in times.isEmpty ? [0] : times {
            renderer.update(atTime: time)
            let pass = MTLRenderPassDescriptor()
            pass.colorAttachments[0].texture = texture
            pass.colorAttachments[0].loadAction = .clear
            pass.colorAttachments[0].clearColor = MTLClearColorMake(0.02, 0.02, 0.02, 1)
            pass.colorAttachments[0].storeAction = .store
            guard let buffer = queue.makeCommandBuffer() else { continue }
            renderer.render(withViewport: viewport, commandBuffer: buffer, renderPassDescriptor: pass)
            buffer.commit()
            buffer.waitUntilCompleted()
        }
        return image(from: texture, width: width, height: height) ?? UIImage()
    }

    private static func image(from texture: MTLTexture, width: Int, height: Int) -> UIImage? {
        let bytesPerRow = width * 4
        var raw = [UInt8](repeating: 0, count: bytesPerRow * height)
        texture.getBytes(&raw, bytesPerRow: bytesPerRow,
                         from: MTLRegionMake2D(0, 0, width, height), mipmapLevel: 0)
        let colorSpace = CGColorSpaceCreateDeviceRGB()
        // Metal texture is BGRA; premultiplied-first + little-endian maps it to a correct CGImage.
        let bitmap = CGBitmapInfo(rawValue: CGImageAlphaInfo.premultipliedFirst.rawValue)
            .union(.byteOrder32Little)
        guard let ctx = CGContext(
            data: &raw, width: width, height: height, bitsPerComponent: 8, bytesPerRow: bytesPerRow,
            space: colorSpace, bitmapInfo: bitmap.rawValue
        ), let cgImage = ctx.makeImage() else { return nil }
        return UIImage(cgImage: cgImage, scale: 2, orientation: .up)
    }
}
