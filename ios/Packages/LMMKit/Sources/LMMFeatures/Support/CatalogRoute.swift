import Foundation

/// Navigation destinations pushed within a tab's `NavigationStack`. Kept as a plain,
/// value-type enum so routing is testable without the SwiftUI environment.
public enum CatalogRoute: Hashable {
    /// A course's detail screen.
    case course(UUID)
    /// The lesson viewer for a class (a placeholder until Stage B).
    case classViewer(courseId: UUID, classId: UUID)
    /// The standalone "Practice Songs" list (D27) — published `play_sense_songs`, reachable from Home.
    case practiceSongs
}
