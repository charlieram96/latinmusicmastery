import XCTest

@testable import TimeMapKit

/// Case-for-case port of `lib/playsense-studio/__tests__/active-section.test.ts`. Test
/// names mirror the `it(...)` descriptions from that file.
final class ActiveSectionTests: XCTestCase {
    private let sections: [SectionRange] = [
        SectionRange(videoStartSeconds: 4, videoEndSeconds: 5.5), // 0:04-0:05.5
        SectionRange(videoStartSeconds: 14, videoEndSeconds: 16) // 0:14-0:16
    ]

    func testReturnsNegativeOneDuringATalkingGap() {
        XCTAssertEqual(pickActiveSection(sections, at: 0), -1)
        XCTAssertEqual(pickActiveSection(sections, at: 8), -1)
        XCTAssertEqual(pickActiveSection(sections, at: 20), -1)
    }

    func testSelectsTheSectionWhoseRangeContainsTheTime() {
        XCTAssertEqual(pickActiveSection(sections, at: 4), 0)
        XCTAssertEqual(pickActiveSection(sections, at: 5), 0)
        XCTAssertEqual(pickActiveSection(sections, at: 14), 1)
        XCTAssertEqual(pickActiveSection(sections, at: 16), 1)
    }

    func testTreatsRangeBoundsAsInclusive() {
        XCTAssertEqual(pickActiveSection(sections, at: 5.5), 0)
        XCTAssertEqual(pickActiveSection(sections, at: 14), 1)
    }

    func testPrefersTheLatestStartingEligibleSectionWhenRangesOverlap() {
        let overlapping: [SectionRange] = [
            SectionRange(videoStartSeconds: 0, videoEndSeconds: 30),
            SectionRange(videoStartSeconds: 10, videoEndSeconds: 20)
        ]
        XCTAssertEqual(pickActiveSection(overlapping, at: 5), 0)
        XCTAssertEqual(pickActiveSection(overlapping, at: 15), 1) // both eligible -> later start wins
        XCTAssertEqual(pickActiveSection(overlapping, at: 25), 0)
    }

    func testANullStartIsAlwaysEligible() {
        let single: [SectionRange] = [SectionRange(videoStartSeconds: nil, videoEndSeconds: nil)]
        XCTAssertEqual(pickActiveSection(single, at: 0), 0)
        XCTAssertEqual(pickActiveSection(single, at: 9999), 0)
    }

    func testANullEndStaysActiveToTheEndOfTheVideo() {
        let openEnded: [SectionRange] = [SectionRange(videoStartSeconds: 10, videoEndSeconds: nil)]
        XCTAssertEqual(pickActiveSection(openEnded, at: 9), -1)
        XCTAssertEqual(pickActiveSection(openEnded, at: 10), 0)
        XCTAssertEqual(pickActiveSection(openEnded, at: 100_000), 0)
    }
}
