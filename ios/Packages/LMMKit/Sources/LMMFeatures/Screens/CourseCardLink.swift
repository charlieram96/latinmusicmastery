import LMMDesignSystem
import LMMLocalization
import LMMModels
import SwiftUI

/// A `CourseCard` wrapped in a navigation link to the course detail. Shared by Home and the
/// Courses browse grid so both surfaces present a course identically.
struct CourseCardLink: View {
    let course: Course
    let styleName: String?
    let canAccess: Bool
    let isEnrolled: Bool
    let progress: Double?

    @Environment(\.appLocale) private var locale

    var body: some View {
        NavigationLink(value: CatalogRoute.course(course.id)) {
            CourseCard(
                title: course.displayTitle(locale),
                imageURL: course.thumbnailUrl.flatMap(URL.init(string:)),
                style: styleName,
                instrument: CoursePresentation.instrumentLabel(course.instrument),
                accessBadge: CoursePresentation.accessBadge(
                    course: course,
                    canAccess: canAccess,
                    isEnrolled: isEnrolled
                ),
                progress: progress
            )
        }
        .buttonStyle(.plain)
    }
}
