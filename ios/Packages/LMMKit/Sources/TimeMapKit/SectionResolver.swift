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

/// Resolves the active + displayed section for a video time, mirroring the web player's memoized
/// derivation (`activeSection` / `prevSection` / `upcomingSection` / `displaySection` /
/// `inTrailingGap`). Pure, so the section-switching logic is unit-testable in isolation.
///
/// Built ONCE from the fixed sections (the per-lesson list never changes at runtime); the
/// prev/upcoming "placed" ordering — sections with an explicit video start, sorted by start — is
/// precomputed in ``init(_:)`` so the per-frame ``resolve(at:)`` path allocates NOTHING: it does a
/// couple of linear scans over stored arrays plus scalar comparisons, no `enumerated`/`filter`/
/// `sorted` heap allocation on the display-link tick (the previous free-function form ran all three
/// every frame).
public struct SectionResolver: Sendable {
    /// A section that carries an explicit video start, flattened for the per-frame scan.
    private struct Placed: Sendable {
        let offset: Int
        let start: VideoTimeSec
        /// End of the section (`videoEndSeconds`, or `start` when open-ended) — the boundary a
        /// trailing gap begins after.
        let end: VideoTimeSec
    }

    private let sections: [SectionRange]
    /// Placed sections sorted ascending by video start — the precomputed prev/upcoming index.
    private let placed: [Placed]

    public init(_ sections: [SectionRange]) {
        self.sections = sections
        self.placed = sections.enumerated()
            .compactMap { offset, element -> Placed? in
                guard let start = element.videoStartSeconds else { return nil }
                return Placed(offset: offset, start: start, end: element.videoEndSeconds ?? start)
            }
            .sorted { $0.start < $1.start }
    }

    /// Resolve the active/displayed section for `time`. Zero heap allocation — reuses the stored
    /// `sections` / `placed` arrays and returns a value type.
    public func resolve(at time: VideoTimeSec) -> SectionResolution {
        guard !sections.isEmpty else {
            return SectionResolution(activeIndex: -1, displayIndex: 0, inTrailingGap: false)
        }

        let activeIndex = pickActiveSection(sections, at: time)

        // The section whose trailing gap we're in: the latest-starting placed one that has ended.
        // `placed` is start-sorted, so the last match while scanning forward is the latest start.
        var prevIndex = -1
        for entry in placed where entry.end <= time { prevIndex = entry.offset }

        // The next placed section that hasn't started yet (first in start order past `time`).
        var upcomingIndex = -1
        for entry in placed where entry.start > time + 0.05 {
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
}

/// One-shot convenience for callers that resolve a single time (tests, non-per-frame paths).
/// Builds a ``SectionResolver`` and resolves once — do NOT call this per frame; hold a
/// ``SectionResolver`` instead so the placed array is precomputed rather than rebuilt each tick.
public func resolveSection(_ sections: [SectionRange], at time: VideoTimeSec) -> SectionResolution {
    SectionResolver(sections).resolve(at: time)
}
