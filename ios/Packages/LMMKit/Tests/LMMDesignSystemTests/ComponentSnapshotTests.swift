import LMMDesignSystem
import SnapshotTesting
import SwiftUI
import XCTest

/// Snapshot coverage for the design-system components called out in the task brief:
/// `CourseCard` (light + dark) and every `Badge` variant. Reference images are recorded on
/// iPhone 16 / iOS 18.3.1 and committed alongside these tests.
final class ComponentSnapshotTests: XCTestCase {
    private let precision: Float = 0.98
    private let perceptual: Float = 0.97

    func testCourseCardLight() {
        assertComponent(courseCard, width: 320, style: .light)
    }

    func testCourseCardDark() {
        assertComponent(courseCard, width: 320, style: .dark)
    }

    func testCourseCardEnrolledLight() {
        assertComponent(enrolledCard, width: 320, style: .light)
    }

    func testCourseCardEnrolledDark() {
        assertComponent(enrolledCard, width: 320, style: .dark)
    }

    func testBadgeVariantsLight() {
        assertComponent(badgeStack, width: 240, style: .light)
    }

    func testBadgeVariantsDark() {
        assertComponent(badgeStack, width: 240, style: .dark)
    }

    // MARK: Fixtures

    private var courseCard: some View {
        CourseCard(
            title: "Bomba Bass Fundamentals",
            imageURL: nil,
            style: "Bomba",
            instrument: "Bass",
            accessBadge: .locked
        )
    }

    private var enrolledCard: some View {
        CourseCard(
            title: "Salsa Piano: Montunos",
            imageURL: nil,
            style: "Salsa",
            instrument: "Piano",
            accessBadge: .enrolled,
            progress: 0.45
        )
    }

    private var badgeStack: some View {
        VStack(alignment: .leading, spacing: 12) {
            Badge(.free)
            Badge(.locked)
            Badge(.enrolled)
            Badge(.instrument("Bass"))
            Badge(.style("Bomba"))
        }
    }

    // MARK: Helper

    private func assertComponent(
        _ view: some View,
        width: CGFloat,
        style: UIUserInterfaceStyle,
        file: StaticString = #file,
        testName: String = #function,
        line: UInt = #line
    ) {
        let host = view
            .frame(width: width)
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
