import Foundation

/// The result of resolving which score section a video lesson should show at a given time —
/// the port of `playsense-studio-player.tsx`'s `activeSection` / `prevSection` / `upcomingSection`
/// / `displaySection` / `inTrailingGap` derivation (lines ~164-203).
public struct SectionResolution: Equatable, Sendable {
    /// Index of the section active at the current time, or `-1` when the playhead is in a gap.
    public let activeIndex: Int
    /// Index of the section whose notation to DISPLAY — never `-1` when sections exist: during a
    /// gap we keep showing the section that just ended (or preview the upcoming one before the
    /// first section) so the staff is never blank.
    public let displayIndex: Int
    /// True when there's no active section but we're sitting in the trailing gap of the one that
    /// just finished (the displayed section is `prevSection`).
    public let inTrailingGap: Bool

    public init(activeIndex: Int, displayIndex: Int, inTrailingGap: Bool) {
        self.activeIndex = activeIndex
        self.displayIndex = displayIndex
        self.inTrailingGap = inTrailingGap
    }

    /// Whether a scored section is actually active right now (the cursor should be live).
    public var hasNotation: Bool { activeIndex >= 0 }
}

/// Resolve the active + displayed section for `time`, mirroring the web player's memoized
/// derivation. Pure, so the section-switching logic is unit-testable in isolation.
///
/// `sections` order is the caller's stable order (matching `pickActiveSection`); the "placed"
/// ordering used for prev/upcoming is derived internally by video start time.
public func resolveSection(_ sections: [SectionRange], at time: VideoTimeSec) -> SectionResolution {
    guard !sections.isEmpty else {
        return SectionResolution(activeIndex: -1, displayIndex: 0, inTrailingGap: false)
    }

    let activeIndex = pickActiveSection(sections, at: time)

    // Placed sections (those with an explicit start), sorted by start — used to resolve prev/next.
    let placed = sections.enumerated()
        .filter { $0.element.videoStartSeconds != nil }
        .sorted { ($0.element.videoStartSeconds ?? 0) < ($1.element.videoStartSeconds ?? 0) }

    // The section whose trailing gap we're in: the last placed one that has already ended.
    var prevIndex = -1
    for entry in placed {
        let end = entry.element.videoEndSeconds ?? entry.element.videoStartSeconds
        if let end, end <= time { prevIndex = entry.offset }
    }

    // The next placed section that hasn't started yet.
    var upcomingIndex = -1
    for entry in placed where (entry.element.videoStartSeconds ?? 0) > time + 0.05 {
        upcomingIndex = entry.offset
        break
    }

    let displayIndex: Int
    if activeIndex >= 0 {
        displayIndex = activeIndex
    } else if prevIndex >= 0 {
        displayIndex = prevIndex
    } else if upcomingIndex >= 0 {
        displayIndex = upcomingIndex
    } else {
        displayIndex = 0
    }

    let inTrailingGap = activeIndex < 0 && prevIndex >= 0 && displayIndex == prevIndex
    return SectionResolution(activeIndex: activeIndex, displayIndex: displayIndex, inTrailingGap: inTrailingGap)
}
