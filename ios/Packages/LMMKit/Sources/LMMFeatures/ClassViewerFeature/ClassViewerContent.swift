import Foundation
import LMMData
import LMMModels

/// Pure derivation of a single class's viewer content from an already-fetched ``CourseStructure``.
///
/// Keeping this out of the SwiftUI view makes the two derivations the brief calls out — the
/// item-switcher ordering and the per-item completion state — unit-testable without the
/// environment. Items arrive already sorted by `order_index` from
/// ``CourseStructure/buildStructure(sections:progress:)``; this just locates the class and reads
/// its progress.
struct ClassViewerContent: Equatable {
    let classTitleKey: String
    let items: [ClassItem]
    let completedItemIds: Set<UUID>
    /// Server-known resume points (`last_position_seconds`) per item, for the video player.
    let resumePositions: [UUID: Int]

    /// Locates `classId` within `structure` and derives its ordered items + completion set. Returns
    /// `nil` when the class isn't part of the structure.
    static func derive(from structure: CourseStructure, classId: UUID) -> ClassViewerContent? {
        for section in structure.sections {
            guard let enriched = section.classes.first(where: { $0.id == classId }) else { continue }
            var resume: [UUID: Int] = [:]
            for item in enriched.items {
                if let seconds = structure.progressMap[item.id]?.lastPositionSeconds {
                    resume[item.id] = seconds
                }
            }
            return ClassViewerContent(
                classTitleKey: enriched.courseClass.title,
                items: enriched.items,
                completedItemIds: Set(enriched.completedItemIds),
                resumePositions: resume
            )
        }
        return nil
    }

    func isComplete(_ itemId: UUID) -> Bool {
        completedItemIds.contains(itemId)
    }
}

/// Pure bounded index navigation for the item switcher's prev/next controls.
struct ClassItemNavigator: Equatable {
    private(set) var index: Int
    let count: Int

    init(index: Int = 0, count: Int) {
        self.count = count
        self.index = count == 0 ? 0 : min(max(0, index), count - 1)
    }

    var canGoPrevious: Bool { index > 0 }
    var canGoNext: Bool { index < count - 1 }

    mutating func goPrevious() {
        if canGoPrevious { index -= 1 }
    }

    mutating func goNext() {
        if canGoNext { index += 1 }
    }

    mutating func select(_ newIndex: Int) {
        guard count > 0 else { return }
        index = min(max(0, newIndex), count - 1)
    }
}
