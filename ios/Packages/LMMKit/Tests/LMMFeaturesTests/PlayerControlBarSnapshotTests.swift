import SnapshotTesting
import SwiftUI
import XCTest

@testable import LMMFeatures

/// Snapshot coverage for the lesson player's custom control bar (light + dark, controls visible),
/// as called out in the task brief. Rendered from a pure ``PlayerControlBar/State`` — no AVPlayer.
final class PlayerControlBarSnapshotTests: XCTestCase {
    private let precision: Float = 0.98
    private let perceptual: Float = 0.96

    private var controlBar: some View {
        PlayerControlBar(
            state: PlayerControlBar.State(
                currentSeconds: 72,
                durationSeconds: 214,
                bufferedSeconds: 120,
                isPlaying: true,
                playbackRate: 1.5,
                loopAPct: 0.2,
                loopBPct: 0.55,
                loopEnabled: true,
                loopHasEndpoints: true,
                loopValid: true,
                subtitleLabels: ["English", "Español"],
                activeSubtitleLabel: "English",
                isFullscreen: false
            ),
            airPlay: nil
        )
    }

    func testControlBarDark() {
        assertBar(style: .dark)
    }

    func testControlBarLight() {
        assertBar(style: .light)
    }

    private func assertBar(
        style: UIUserInterfaceStyle,
        file: StaticString = #file,
        testName: String = #function,
        line: UInt = #line
    ) {
        let host = controlBar
            .frame(width: 390)
            .background(Color.black)
        assertSnapshot(
            of: host,
            as: .image(
                precision: precision,
                perceptualPrecision: perceptual,
                layout: .sizeThatFits,
                traits: UITraitCollection(userInterfaceStyle: style)
            ),
            file: file,
            testName: testName,
            line: line
        )
    }
}
