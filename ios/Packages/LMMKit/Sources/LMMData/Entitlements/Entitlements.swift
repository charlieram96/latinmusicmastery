import Foundation
import LMMModels

/// A snapshot of what the current user is allowed to access, aggregated from three tables
/// (`instrument_subscriptions`, `subscription_courses`, `profiles.is_admin`) by
/// ``EntitlementsRepository``. Pure and `Equatable` so ``canAccess(_:)`` is trivially testable
/// without any network dependency.
public struct Entitlements: Sendable, Equatable {
    /// Instruments (e.g. "Percussion", "Bass") with an active `instrument_subscriptions` row.
    public var activeInstruments: Set<String>
    /// Course ids explicitly unlocked via an active `subscription_courses` row.
    public var unlockedCourseIds: Set<UUID>
    public var isAdmin: Bool

    public init(
        activeInstruments: Set<String> = [],
        unlockedCourseIds: Set<UUID> = [],
        isAdmin: Bool = false
    ) {
        self.activeInstruments = activeInstruments
        self.unlockedCourseIds = unlockedCourseIds
        self.isAdmin = isAdmin
    }

    /// Exact port of `lib/subscriptions.ts`'s `canAccessCourse` / the SQL `has_course_access`
    /// SECURITY DEFINER function:
    ///
    ///   1. Admins → allow.
    ///   2. A course with no `instrument` → deny (orphaned content; nothing to gate against).
    ///   3. Fundamentals course → allow iff there's an active instrument subscription for the
    ///      course's instrument.
    ///   4. Every other course ("genre" course) → allow iff its id is in `unlockedCourseIds`.
    ///      Note: this never inspects `musicalStyleId` — a genre course without one still gates
    ///      the same way, exactly mirroring the web, whose `AccessCourse` type doesn't carry
    ///      `musical_style_id` at all.
    public func canAccess(_ course: Course) -> Bool {
        if isAdmin { return true }
        guard let instrument = course.instrument else { return false }

        if course.isFundamentals {
            return activeInstruments.contains(instrument)
        }

        return unlockedCourseIds.contains(course.id)
    }
}
