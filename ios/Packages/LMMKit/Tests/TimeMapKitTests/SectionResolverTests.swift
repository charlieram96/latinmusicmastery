import XCTest

@testable import TimeMapKit

/// Port of `playsense-studio-player.tsx`'s active/display/gap section derivation. Covers the
/// single-synthetic-section case, adjacent sections, the trailing-gap hold, and the pre-first
/// upcoming preview.
final class SectionResolverTests: XCTestCase {
    private func range(_ start: Double?, _ end: Double?) -> SectionRange {
        SectionRange(videoStartSeconds: start, videoEndSeconds: end)
    }

    func testEmptyResolvesToNothing() {
        let result = resolveSection([], at: 5)
        XCTAssertEqual(result.activeIndex, -1)
        XCTAssertEqual(result.displayIndex, 0)
        XCTAssertFalse(result.hasNotation)
    }

    func testSingleSyntheticSectionIsAlwaysActive() {
        let sections = [range(nil, nil)]
        for time in [0.0, 10, 999] {
            let result = resolveSection(sections, at: time)
            XCTAssertEqual(result.activeIndex, 0)
            XCTAssertEqual(result.displayIndex, 0)
            XCTAssertTrue(result.hasNotation)
            XCTAssertFalse(result.inTrailingGap)
        }
    }

    func testPicksSectionActiveInItsRange() {
        let sections = [range(0, 10), range(20, 30)]
        let result = resolveSection(sections, at: 25)
        XCTAssertEqual(result.activeIndex, 1)
        XCTAssertEqual(result.displayIndex, 1)
        XCTAssertTrue(result.hasNotation)
    }

    func testHoldsPreviousSectionInTrailingGap() {
        let sections = [range(0, 10), range(20, 30)]
        let result = resolveSection(sections, at: 15) // between section 0's end and section 1's start
        XCTAssertEqual(result.activeIndex, -1, "no section is active in the gap")
        XCTAssertEqual(result.displayIndex, 0, "keep showing the section that just ended")
        XCTAssertTrue(result.inTrailingGap)
        XCTAssertFalse(result.hasNotation)
    }

    func testPreviewsUpcomingSectionBeforeTheFirst() {
        let sections = [range(10, 20), range(30, 40)]
        let result = resolveSection(sections, at: 2) // before any section starts
        XCTAssertEqual(result.activeIndex, -1)
        XCTAssertEqual(result.displayIndex, 0, "preview the first upcoming section")
        XCTAssertFalse(result.inTrailingGap, "not a trailing gap — nothing has ended yet")
    }

    func testLatestStartWinsForOverlap() {
        let sections = [range(0, 30), range(10, 20)]
        let result = resolveSection(sections, at: 15)
        XCTAssertEqual(result.activeIndex, 1, "the later-starting eligible section wins")
    }

    // MARK: - Precomputed resolver (per-frame path)

    /// The precomputed ``SectionResolver`` (placed array built once in init) must match the
    /// one-shot free function at every time — it is the per-frame form the driver holds so the
    /// display-link tick allocates nothing.
    func testPrecomputedResolverMatchesFreeFunctionAcrossTimeline() {
        let sections = [range(0, 10), range(20, 30), range(nil, nil), range(40, nil)]
        let resolver = SectionResolver(sections)
        for tenths in 0...500 {
            let time = Double(tenths) / 10
            let precomputed = resolver.resolve(at: time)
            let oneShot = resolveSection(sections, at: time)
            XCTAssertEqual(precomputed, oneShot, "mismatch at t=\(time)")
        }
    }

    func testPrecomputedResolverEmptyIsInert() {
        let resolver = SectionResolver([])
        let result = resolver.resolve(at: 7)
        XCTAssertEqual(result, SectionResolution(activeIndex: -1, displayIndex: 0, inTrailingGap: false))
    }

    func testPrecomputedResolverHoldsPrevInTrailingGap() {
        let resolver = SectionResolver([range(0, 10), range(20, 30)])
        let result = resolver.resolve(at: 15)
        XCTAssertEqual(result.activeIndex, -1)
        XCTAssertEqual(result.displayIndex, 0)
        XCTAssertTrue(result.inTrailingGap)
    }
}
