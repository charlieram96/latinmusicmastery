import LMMDesignSystem
import SnapshotTesting
import SwiftUI
import XCTest

/// Snapshot coverage for ``TipTapView`` (Task B8): one representative document — heading,
/// a marked-up paragraph (bold/italic/link), a bullet list, a blockquote, and a horizontal
/// rule — light + dark. Reference images are recorded on iPhone 16 / iOS 18.3.1 and committed
/// alongside these tests. Deliberately excludes `image`/`youtube` nodes, whose `AsyncImage`
/// network fetches would make the snapshot non-deterministic.
final class TipTapViewSnapshotTests: XCTestCase {
    private let precision: Float = 0.98
    private let perceptual: Float = 0.97

    func testRepresentativeDocumentLight() {
        assertDoc(style: .light)
    }

    func testRepresentativeDocumentDark() {
        assertDoc(style: .dark)
    }

    private func assertDoc(
        style: UIUserInterfaceStyle,
        file: StaticString = #file,
        testName: String = #function,
        line: UInt = #line
    ) {
        let host = TipTapView(content: TipTapFixtures.representative)
            .frame(width: 340, alignment: .leading)
            .padding(16)
            .background(LMMColor.background)
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
