import LMMDesignSystem
import SwiftUI

/// The prominent "continue learning" card on Home. A wide thumbnail with the course title,
/// a progress bar, and a completion count, tuned to invite a tap back into the course.
struct ContinueCard: View {
    let title: String
    let imageURL: URL?
    let progress: Double
    let subtitle: String

    var body: some View {
        HStack(spacing: LMMSpacing.md) {
            thumbnail
            VStack(alignment: .leading, spacing: LMMSpacing.xs) {
                Text(title)
                    .font(LMMFont.headline)
                    .foregroundStyle(LMMColor.foreground)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
                Text(subtitle)
                    .font(LMMFont.caption)
                    .foregroundStyle(LMMColor.mutedForeground)
                ProgressBar(progress: progress)
                    .padding(.top, 2)
            }
            Image(systemName: "play.circle.fill")
                .font(.system(size: 30))
                .foregroundStyle(LMMColor.primary)
        }
        .padding(LMMSpacing.sm)
        .background(
            RoundedRectangle(cornerRadius: LMMRadius.lg, style: .continuous)
                .fill(LMMColor.surface)
        )
        .overlay(
            RoundedRectangle(cornerRadius: LMMRadius.lg, style: .continuous)
                .strokeBorder(LMMColor.border, lineWidth: 1)
        )
    }

    private var thumbnail: some View {
        RoundedRectangle(cornerRadius: LMMRadius.md, style: .continuous)
            .fill(LMMColor.warmGradient)
            .frame(width: 84, height: 84)
            .overlay(
                Image(systemName: "music.note")
                    .font(.system(size: 24, weight: .semibold))
                    .foregroundStyle(LMMColor.onPrimary.opacity(0.85))
            )
            .overlay {
                if let imageURL {
                    AsyncImage(url: imageURL) { phase in
                        if case .success(let image) = phase {
                            image.resizable().scaledToFill()
                        } else {
                            Color.clear
                        }
                    }
                }
            }
            .clipShape(RoundedRectangle(cornerRadius: LMMRadius.md, style: .continuous))
    }
}
