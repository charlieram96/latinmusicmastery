import Foundation
import LMMModels

/// Client-side aggregation of a course's outline plus the current user's progress — the iOS
/// mirror of `getCourseStructureForStudent` in `app/actions/course-student.ts`.
///
/// Built by the pure ``buildStructure(sections:progress:)`` from raw embedded-select rows, so
/// the aggregation (nested sorts, per-class/section/course totals, duration math, `nextClassId`)
/// is unit-testable without any network dependency.
public struct CourseStructure: Equatable, Sendable {
    /// Mirrors one `class_item_progress` row, keyed by `class_item_id` in ``progressMap``.
    public struct Progress: Equatable, Sendable {
        public let completed: Bool
        public let lastPositionSeconds: Int?
    }

    public struct EnrichedClass: Identifiable, Equatable, Sendable {
        public let courseClass: CourseClass
        /// Items sorted by `order_index`. Empty either because the class genuinely has no items
        /// yet, or because RLS hid a non-free class's items from a viewer without access — see
        /// ``itemsVisible`` and ``isLocked(entitlements:course:)``.
        public let items: [ClassItem]
        public let totalItems: Int
        public let completedItems: Int
        public let completedItemIds: [UUID]

        public var id: UUID { courseClass.id }

        /// `false` when the fetch returned no items for this class. On its own this doesn't
        /// distinguish "genuinely empty class" from "gated content" (RLS returns zero rows
        /// either way) — combine with ``isLocked(entitlements:course:)`` for that.
        public var itemsVisible: Bool { !items.isEmpty }

        /// The plan's "Gated" signal: true when this class looks like it *should* have content
        /// (it isn't marked free) but came back empty and the viewer doesn't currently have
        /// access to the parent course — i.e. RLS is almost certainly the reason `items` is
        /// empty, not an authoring gap.
        public func isLocked(entitlements: Entitlements, course: Course) -> Bool {
            guard !itemsVisible, courseClass.isFree != true else { return false }
            return !entitlements.canAccess(course)
        }
    }

    public struct EnrichedSection: Identifiable, Equatable, Sendable {
        public let section: CourseSection
        public let classes: [EnrichedClass]
        public let totalItems: Int
        public let completedItems: Int

        public var id: UUID { section.id }
    }

    public let sections: [EnrichedSection]
    public let totalItems: Int
    public let completedItems: Int
    public let totalDurationSeconds: Int
    public let completedDurationSeconds: Int
    /// The first class (in section, then class, `order_index` order) with at least one
    /// incomplete item — `nil` once every item in the course is complete (or the course has no
    /// items at all). A class with zero items is never chosen, matching the web's
    /// `classCompletedItems < classTotalItems` check (`0 < 0` is `false`).
    public let nextClassId: UUID?
    public let progressMap: [UUID: Progress]

    /// Mirrors `getCourseStructureForStudent`'s aggregation exactly. `sections` is expected in
    /// the order the repository already fetched it in (the query orders by `order_index`
    /// server-side, just like the web); only the nested `classes`/`items` arrays are sorted here,
    /// exactly as the web does client-side after fetching.
    public static func buildStructure(
        sections: [CourseSection],
        progress: [ClassItemProgress]
    ) -> CourseStructure {
        let progressMap = buildProgressMap(progress)
        var totals = Totals()

        let enrichedSections: [EnrichedSection] = sections.map { section in
            enrichSection(section, progressMap: progressMap, totals: &totals)
        }

        return CourseStructure(
            sections: enrichedSections,
            totalItems: totals.totalItems,
            completedItems: totals.completedItems,
            totalDurationSeconds: totals.totalDurationSeconds,
            completedDurationSeconds: totals.completedDurationSeconds,
            nextClassId: totals.nextClassId,
            progressMap: progressMap
        )
    }

    /// Running totals threaded through ``enrichSection(_:progressMap:totals:)``/
    /// ``enrichClass(_:progressMap:totals:)`` so `nextClassId` reflects the first incomplete
    /// class encountered across the WHOLE course (not just within one section).
    private struct Totals {
        var totalItems = 0
        var completedItems = 0
        var totalDurationSeconds = 0
        var completedDurationSeconds = 0
        var nextClassId: UUID?
    }

    private static func buildProgressMap(_ progress: [ClassItemProgress]) -> [UUID: Progress] {
        var map: [UUID: Progress] = [:]
        for row in progress {
            map[row.classItemId] = Progress(
                completed: row.completed ?? false,
                lastPositionSeconds: row.lastPositionSeconds
            )
        }
        return map
    }

    private static func enrichSection(
        _ section: CourseSection,
        progressMap: [UUID: Progress],
        totals: inout Totals
    ) -> EnrichedSection {
        let sortedClasses = (section.classes ?? []).sorted { $0.orderIndex < $1.orderIndex }
        var sectionTotalItems = 0
        var sectionCompletedItems = 0

        let enrichedClasses: [EnrichedClass] = sortedClasses.map { courseClass in
            let enriched = enrichClass(courseClass, progressMap: progressMap, totals: &totals)
            sectionTotalItems += enriched.totalItems
            sectionCompletedItems += enriched.completedItems
            return enriched
        }

        totals.totalItems += sectionTotalItems
        totals.completedItems += sectionCompletedItems

        return EnrichedSection(
            section: section,
            classes: enrichedClasses,
            totalItems: sectionTotalItems,
            completedItems: sectionCompletedItems
        )
    }

    private static func enrichClass(
        _ courseClass: CourseClass,
        progressMap: [UUID: Progress],
        totals: inout Totals
    ) -> EnrichedClass {
        let sortedItems = (courseClass.items ?? []).sorted { $0.orderIndex < $1.orderIndex }
        var completedItems = 0
        var completedItemIds: [UUID] = []

        for item in sortedItems {
            let itemProgress = progressMap[item.id]
            if itemProgress?.completed == true {
                completedItems += 1
                completedItemIds.append(item.id)
            }
            if item.itemType == .video, let duration = item.videoDurationSeconds {
                totals.totalDurationSeconds += duration
                if itemProgress?.completed == true {
                    totals.completedDurationSeconds += duration
                }
            }
        }

        let totalItems = sortedItems.count
        if totals.nextClassId == nil, completedItems < totalItems {
            totals.nextClassId = courseClass.id
        }

        return EnrichedClass(
            courseClass: courseClass,
            items: sortedItems,
            totalItems: totalItems,
            completedItems: completedItems,
            completedItemIds: completedItemIds
        )
    }
}
