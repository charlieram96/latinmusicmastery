import LMMDesignSystem
import LMMModels
import SwiftUI

/// View-side presentation helpers that turn domain models into design-system inputs.
enum CoursePresentation {
    /// The access badge for a course card: enrolled wins, then locked for content the user
    /// can't reach. Accessible-but-not-enrolled courses show no badge (a clean card).
    /// `.locked` is state only — no price, no purchase affordance (App Review requirement).
    static func accessBadge(
        course: Course,
        canAccess: Bool,
        isEnrolled: Bool
    ) -> Badge.Kind? {
        if isEnrolled { return .enrolled }
        if !canAccess { return .locked }
        return nil
    }

    /// A human instrument label ("bass" → "Bass").
    static func instrumentLabel(_ raw: String?) -> String? {
        guard let raw, !raw.isEmpty else { return nil }
        return raw.prefix(1).uppercased() + raw.dropFirst()
    }

    /// "12 min" from a duration in seconds (rounded up, min 1 when there's any content).
    static func minutesLabel(seconds: Int) -> String? {
        guard seconds > 0 else { return nil }
        let minutes = max(1, Int((Double(seconds) / 60).rounded()))
        return lmmFormat("unit.minutesFormat", minutes)
    }

    /// "3 classes".
    static func classesLabel(count: Int) -> String {
        lmmFormat("unit.classesFormat", count)
    }

    /// "8 items".
    static func itemsLabel(count: Int) -> String {
        lmmFormat("unit.itemsFormat", count)
    }
}
