import XCTest

@testable import NotationEngraving

/// Pure unit-conversion coverage — SMuFL metrics (bboxes, anchors, engravingDefaults) are all
/// expressed in staff spaces; `ScaleContext` is the one place that turns a staff space into
/// points for a concretely-sized staff.
final class ScaleContextTests: XCTestCase {
    func testConvertsWholeStaffSpacesToPoints() {
        let scale = ScaleContext(staffSpacePoints: 10)
        XCTAssertEqual(scale.points(1), 10)
        XCTAssertEqual(scale.points(2.5), 25)
    }

    func testZeroStaffSpacesIsZeroPoints() {
        let scale = ScaleContext(staffSpacePoints: 12)
        XCTAssertEqual(scale.points(0), 0)
    }

    func testNegativeStaffSpacesConvertProportionally() {
        let scale = ScaleContext(staffSpacePoints: 8)
        XCTAssertEqual(scale.points(-0.5), -4)
    }

    /// SMuFL fonts are designed at 4 staff-spaces per em (the standard SMuFL convention —
    /// see the spec's "Font em sizes" section) — so the CTFont point size for a given
    /// staff-space size is always `staffSpacePoints * 4`.
    func testFontPointSizeIsFourTimesStaffSpace() {
        let scale = ScaleContext(staffSpacePoints: 10)
        XCTAssertEqual(scale.fontPointSize, 40)
    }
}
