import SnapshotTesting
import UIKit
import XCTest

@testable import NotationEngraving

/// Snapshot coverage for `drawStaffSample` — light + dark notation color, at 2 staff sizes.
/// This is the end-to-end proof for task C13: it exercises font loading (`BravuraFont`),
/// metrics (`GlyphMetrics`), and staff coordinate math (`StaffGeometry`) together, rendered
/// through `UIGraphicsImageRenderer` (the one place in this target that touches UIKit —
/// `drawStaffSample` itself is CoreGraphics/CoreText only).
final class StaffSampleSnapshotTests: XCTestCase {
    private let smallScale = ScaleContext(staffSpacePoints: 8)
    private let largeScale = ScaleContext(staffSpacePoints: 16)

    private let smallSize = CGSize(width: 260, height: 130)
    private let largeSize = CGSize(width: 460, height: 230)

    func testSmallStaffLight() {
        assertStaffSample(scale: smallScale, size: smallSize, notationColor: .lightDefault, background: .white)
    }

    func testSmallStaffDark() {
        assertStaffSample(scale: smallScale, size: smallSize, notationColor: .darkDefault, background: .black)
    }

    func testLargeStaffLight() {
        assertStaffSample(scale: largeScale, size: largeSize, notationColor: .lightDefault, background: .white)
    }

    func testLargeStaffDark() {
        assertStaffSample(scale: largeScale, size: largeSize, notationColor: .darkDefault, background: .black)
    }

    // MARK: Helper

    private func assertStaffSample(
        scale: ScaleContext,
        size: CGSize,
        notationColor: NotationColor,
        background: UIColor,
        file: StaticString = #file,
        testName: String = #function,
        line: UInt = #line
    ) {
        let renderer = UIGraphicsImageRenderer(size: size)
        let image = renderer.image { rendererContext in
            let ctx = rendererContext.cgContext
            ctx.setFillColor(background.cgColor)
            ctx.fill(CGRect(origin: .zero, size: size))
            drawStaffSample(in: ctx, size: size, scale: scale, notationColor: notationColor)
        }
        assertSnapshot(
            of: image,
            as: .image(precision: 0.98, perceptualPrecision: 0.97),
            file: file,
            testName: testName,
            line: line
        )
    }
}
