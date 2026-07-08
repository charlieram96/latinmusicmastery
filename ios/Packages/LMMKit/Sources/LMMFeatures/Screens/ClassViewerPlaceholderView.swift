import LMMData
import LMMDesignSystem
import LMMLocalization
import SwiftUI

/// Stand-in for the real lesson viewer (Stage B). Shows the class title and a "coming soon"
/// message so navigation into a class is wired end-to-end today.
struct ClassViewerPlaceholderView: View {
    let courseId: UUID
    let classId: UUID

    @Environment(AppServices.self) private var services
    @Environment(\.appLocale) private var locale
    @State private var classTitle: String?

    var body: some View {
        VStack(spacing: LMMSpacing.md) {
            Image(systemName: "play.rectangle.on.rectangle.fill")
                .font(.system(size: 40))
                .foregroundStyle(LMMColor.primary)
            VStack(spacing: LMMSpacing.xxs) {
                Text(lmmString("viewer.comingSoon.title"))
                    .font(LMMFont.title2)
                    .foregroundStyle(LMMColor.foreground)
                Text(lmmString("viewer.comingSoon.message"))
                    .font(LMMFont.subheadline)
                    .foregroundStyle(LMMColor.mutedForeground)
                    .multilineTextAlignment(.center)
            }
        }
        .padding(LMMSpacing.xl)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(LMMColor.background)
        .navigationTitle(classTitle ?? "")
        .navigationBarTitleDisplayMode(.inline)
        .task { await loadTitle() }
    }

    private func loadTitle() async {
        guard classTitle == nil else { return }
        let structure = try? await services.catalog.courseStructure(courseId: courseId)
        let match = structure?.sections
            .flatMap(\.classes)
            .first { $0.id == classId }
        classTitle = match?.courseClass.displayTitle(locale)
    }
}
