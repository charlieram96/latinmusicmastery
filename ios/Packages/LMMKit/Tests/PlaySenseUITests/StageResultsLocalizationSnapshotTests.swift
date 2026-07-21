import PlaySenseCore
import SnapshotTesting
import SwiftUI
import XCTest

@testable import PlaySenseUI

/// Pins one Spanish rendering of the post-take results panel (finding 2 of the final review's
/// localization sweep). Resolves PlaySenseUI's compiled `es.lproj` and points the module's string
/// lookups at it via `playSenseLocalizationBundleOverride`, so the assertion is deterministic and
/// does not depend on the simulator's device language (which the `.module` bundle caches on first
/// use). Verifies both the rendered image and, as a fast non-image guard, that a couple of the
/// user-facing strings actually resolve to Spanish — while the PERFECT/GOOD/OK/MISS grade tokens
/// deliberately stay English brand voice (see `StageResultsView.statGrid`).
final class StageResultsLocalizationSnapshotTests: XCTestCase {
    private let precision: Float = 0.98
    private let perceptual: Float = 0.96

    override func tearDown() {
        playSenseLocalizationBundleOverride = nil
        super.tearDown()
    }

    private func activateSpanishBundle() throws {
        guard let esURL = playSenseModuleBundle.url(forResource: "es", withExtension: "lproj"),
              let esBundle = Bundle(url: esURL) else {
            throw XCTSkip("PlaySenseUI es.lproj not present in the resource bundle.")
        }
        playSenseLocalizationBundleOverride = esBundle
    }

    /// Fast, environment-independent guard: the catalog really carries the Spanish overlay and the
    /// grade tokens really stay English.
    func testSpanishStringsResolve() throws {
        try activateSpanishBundle()
        XCTAssertEqual(lmmString("stage.exit"), "Salir")
        XCTAssertEqual(lmmString("common.retry"), "Reintentar")
        XCTAssertEqual(lmmString("stage.results.practiceUnranked"), "PRÁCTICA — sin clasificar")
        // Grade names are brand voice — not translated, mirroring the web stage.
        XCTAssertEqual(lmmString("stage.perEvent"), "POR EVENTO")
    }

    @MainActor
    func testStageResultsSpanishSnapshot() throws {
        try activateSpanishBundle()
        let view = StageResultsView(
            stats: Self.sampleStats,
            results: Self.sampleResults,
            isPractice: true,
            onRetry: {},
            onExit: {}
        )
        .frame(width: 402, height: 874)
        .background(Color.black)

        assertSnapshot(
            of: view,
            as: .image(
                precision: precision,
                perceptualPrecision: perceptual,
                layout: .fixed(width: 402, height: 874),
                traits: UITraitCollection(userInterfaceStyle: .dark)
            )
        )
    }

    // MARK: - Sample data (mirrors StageScreenshotTests)

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
