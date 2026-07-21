import SwiftUI

/// The primary catalog surface: a course thumbnail with its access state, title, style /
/// instrument tags, and — when the user is enrolled — a progress bar. Takes plain values so
/// the design system stays decoupled from the data models; the app layer maps a `Course`
/// onto it.
public struct CourseCard: View {
    private let title: String
    private let imageURL: URL?
    private let style: String?
    private let instrument: String?
    private let accessBadge: Badge.Kind?
    private let progress: Double?

    /// - Parameters:
    ///   - title: course title (already localized).
    ///   - imageURL: thumbnail; a warm placeholder is drawn when nil or loading.
    ///   - style: genre tag (e.g. "Bomba"). Optional.
    ///   - instrument: instrument tag (e.g. "Bass"). Optional.
    ///   - accessBadge: overlaid state badge — `.free` / `.locked` / `.enrolled`. Optional.
    ///   - progress: 0...1; when non-nil a progress bar is shown (enrolled courses).
    public init(
        title: String,
        imageURL: URL?,
        style: String? = nil,
        instrument: String? = nil,
        accessBadge: Badge.Kind? = nil,
        progress: Double? = nil
    ) {
        self.title = title
        self.imageURL = imageURL
        self.style = style
        self.instrument = instrument
        self.accessBadge = accessBadge
        self.progress = progress
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: LMMSpacing.sm) {
            thumbnail
            VStack(alignment: .leading, spacing: LMMSpacing.xs) {
                Text(title)
                    .font(LMMFont.headline)
                    .foregroundStyle(LMMColor.foreground)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)

                if style != nil || instrument != nil {
                    HStack(spacing: LMMSpacing.xs) {
                        if let style {
                            Badge(.style(style))
                        }
                        if let instrument {
                            Badge(.instrument(instrument))
                        }
                    }
                }

                if let progress {
                    ProgressBar(progress: progress)
                        .padding(.top, 2)
                }
            }
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
        .accessibilityElement(children: .combine)
    }

    private var thumbnail: some View {
        ZStack(alignment: .topTrailing) {
            RoundedRectangle(cornerRadius: LMMRadius.md, style: .continuous)
                .fill(LMMColor.warmGradient)
                .aspectRatio(16.0 / 9.0, contentMode: .fill)
                .overlay(placeholderGlyph)
                .overlay {
                    if let imageURL {
                        AsyncImage(url: imageURL) { phase in
                            switch phase {
                            case .success(let image):
                                image.resizable().scaledToFill()
                            default:
                                Color.clear
                            }
                        }
                    }
                }
                .clipShape(RoundedRectangle(cornerRadius: LMMRadius.md, style: .continuous))

            if let accessBadge {
                Badge(accessBadge)
                    .padding(LMMSpacing.xs)
            }
        }
    }

    private var placeholderGlyph: some View {
        Image(systemName: "music.note")
            .font(.system(size: 30, weight: .semibold))
            .foregroundStyle(LMMColor.onPrimary.opacity(0.85))
    }
}

#Preview {
    ScrollView {
        VStack(spacing: 16) {
            CourseCard(
                title: "Bomba Bass Fundamentals",
                imageURL: nil,
                style: "Bomba",
                instrument: "Bass",
                accessBadge: .locked
            )
            CourseCard(
                title: "Salsa Piano: Montunos",
                imageURL: nil,
                style: "Salsa",
                instrument: "Piano",
                accessBadge: .enrolled,
                progress: 0.45
            )
        }
        .padding()
    }
    .background(LMMColor.background)
}
