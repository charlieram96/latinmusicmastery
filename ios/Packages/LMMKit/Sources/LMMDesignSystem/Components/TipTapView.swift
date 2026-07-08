import LMMModels
import SwiftUI

/// Native SwiftUI renderer for TipTap/ProseMirror JSON documents (`ClassItem.richContent`).
///
/// Verified against the admin course-studio editor's actual extension config
/// (`components/admin/tiptap-editor.tsx`, used from `item-editor.tsx` for `rich_content`):
/// `StarterKit` (default config) + `Image` + `Youtube` + `Link`. That means the editor *can*
/// produce `codeBlock` and an inline `code` mark (both part of `StarterKit`'s defaults) and
/// has no `Underline` extension installed at all — so `underline` can never appear. Task B8
/// keeps the renderer lean per the brief: `codeBlock`/inline-`code` fall through the
/// "unknown" graceful-degradation path (text still shows, just unstyled) rather than getting
/// bespoke treatment, and `underline` isn't handled since the editor cannot emit it.
///
/// Supported nodes: `doc`, `paragraph`, `heading` (levels 1–3, clamped), `text`,
/// `bulletList`/`orderedList`/`listItem` (recursively nested), `blockquote`, `horizontalRule`,
/// `hardBreak`, `image`, `youtube`.
/// Supported marks: `bold`, `italic`, `strike`, `link` (tappable via `AttributedString`'s
/// native `.link` attribute, restricted to `http`/`https`/`mailto` hrefs — anything else,
/// including this app's own `lmm://` deep-link scheme, renders as plain styled text instead of
/// becoming tappable; CMS-authored content is untrusted input and shouldn't be able to mint new
/// tappable deep links).
///
/// Parsing also caps recursion depth (``TipTapBlockParser`` / ``TipTapInline``) so a
/// pathologically deep or malformed document degrades gracefully instead of overflowing the
/// stack.
public struct TipTapView: View {
    private let blocks: [TipTapBlock]

    public init(content: JSONValue?) {
        self.blocks = TipTapBlockParser.blocks(from: content)
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: LMMSpacing.sm) {
            ForEach(Array(blocks.enumerated()), id: \.offset) { _, block in
                TipTapBlockView(block: block)
            }
        }
    }
}

// MARK: - Rendering
//
// The parsed model (`TipTapBlock`), the parser (`TipTapBlockParser`/`TipTapInline`), and debug
// logging (`TipTapLog`) live in `TipTapParsing.swift` — split out to keep this file to the
// SwiftUI-facing view and its rendering, and because that half is pure Swift (no SwiftUI),
// unit-testable without hosting a view.

private struct TipTapBlockView: View {
    let block: TipTapBlock

    var body: some View {
        switch block {
        case .paragraph(let text), .unknown(let text):
            Text(text)
                .font(LMMFont.body)
                .foregroundStyle(LMMColor.foreground.opacity(0.9))
                .fixedSize(horizontal: false, vertical: true)

        case .heading(let level, let text):
            Text(text)
                .font(headingFont(level))
                .foregroundStyle(LMMColor.foreground)
                .fixedSize(horizontal: false, vertical: true)

        case .bulletList(let items):
            VStack(alignment: .leading, spacing: LMMSpacing.xs) {
                ForEach(Array(items.enumerated()), id: \.offset) { _, itemBlocks in
                    TipTapListItemView(marker: "•", blocks: itemBlocks)
                }
            }

        case .orderedList(let start, let items):
            VStack(alignment: .leading, spacing: LMMSpacing.xs) {
                ForEach(Array(items.enumerated()), id: \.offset) { index, itemBlocks in
                    TipTapListItemView(marker: "\(start + index).", blocks: itemBlocks)
                }
            }

        case .blockquote(let children):
            VStack(alignment: .leading, spacing: LMMSpacing.xs) {
                ForEach(Array(children.enumerated()), id: \.offset) { _, child in
                    TipTapBlockView(block: child)
                }
            }
            .padding(.leading, LMMSpacing.sm)
            .overlay(alignment: .leading) {
                Rectangle().fill(LMMColor.border).frame(width: 3)
            }

        case .horizontalRule:
            Rectangle().fill(LMMColor.border).frame(height: 1)

        case .image(let src, let alt):
            TipTapImageView(src: src, alt: alt)

        case .youtube(let src):
            TipTapYoutubeView(src: src)
        }
    }

    private func headingFont(_ level: Int) -> Font {
        switch level {
        case 1: return LMMFont.title2
        case 2: return LMMFont.headline
        default: return LMMFont.callout.weight(.semibold)
        }
    }
}

private struct TipTapListItemView: View {
    let marker: String
    let blocks: [TipTapBlock]

    var body: some View {
        HStack(alignment: .top, spacing: LMMSpacing.xs) {
            Text(marker)
                .font(LMMFont.body)
                .foregroundStyle(LMMColor.mutedForeground)
            VStack(alignment: .leading, spacing: LMMSpacing.xs) {
                ForEach(Array(blocks.enumerated()), id: \.offset) { _, block in
                    TipTapBlockView(block: block)
                }
            }
        }
    }
}

private struct TipTapImageView: View {
    let src: String
    let alt: String?

    var body: some View {
        if let url = URL(string: src) {
            AsyncImage(url: url) { phase in
                switch phase {
                case .success(let image):
                    image.resizable().aspectRatio(contentMode: .fit)
                case .failure, .empty:
                    placeholder
                @unknown default:
                    placeholder
                }
            }
            .clipShape(RoundedRectangle(cornerRadius: LMMRadius.md, style: .continuous))
            .accessibilityLabel(Text(alt?.isEmpty == false ? alt! : "Image"))
        }
    }

    private var placeholder: some View {
        RoundedRectangle(cornerRadius: LMMRadius.md, style: .continuous)
            .fill(LMMColor.surfaceSunken)
            .frame(height: 160)
            .overlay(
                Image(systemName: "photo")
                    .font(.system(size: 28))
                    .foregroundStyle(LMMColor.mutedForeground)
            )
    }
}

/// A tappable YouTube thumbnail that opens the video via `Link` (the brief's simpler
/// alternative to hosting an `SFSafariViewController`) — no in-app video surface, matching
/// how `image` also just links out rather than embedding playback.
private struct TipTapYoutubeView: View {
    let src: String

    var body: some View {
        if let url = URL(string: src) {
            Link(destination: url) {
                ZStack {
                    thumbnail
                    Image(systemName: "play.circle.fill")
                        .font(.system(size: 44))
                        .foregroundStyle(.white)
                        .shadow(radius: 4)
                }
            }
            .buttonStyle(.plain)
            .accessibilityLabel(Text("Play YouTube video"))
        }
    }

    @ViewBuilder
    private var thumbnail: some View {
        if
            let videoID = YoutubeVideoID.extract(from: src),
            let thumbnailURL = URL(string: "https://img.youtube.com/vi/\(videoID)/hqdefault.jpg") {
            AsyncImage(url: thumbnailURL) { phase in
                if case .success(let image) = phase {
                    image.resizable().aspectRatio(16.0 / 9.0, contentMode: .fill)
                } else {
                    placeholder
                }
            }
            .aspectRatio(16.0 / 9.0, contentMode: .fit)
            .clipShape(RoundedRectangle(cornerRadius: LMMRadius.md, style: .continuous))
        } else {
            placeholder
        }
    }

    private var placeholder: some View {
        RoundedRectangle(cornerRadius: LMMRadius.md, style: .continuous)
            .fill(LMMColor.surfaceSunken)
            .aspectRatio(16.0 / 9.0, contentMode: .fit)
    }
}

/// Extracts an 11-character YouTube video ID from the URL shapes `@tiptap/extension-youtube`
/// actually stores in `attrs.src` (`watch?v=`, `youtu.be/`, `embed/`), for building the
/// thumbnail URL. Pure + unit-tested independent of the view.
enum YoutubeVideoID {
    static func extract(from src: String) -> String? {
        guard let components = URLComponents(string: src) else { return nil }

        if let host = components.host, host.contains("youtu.be") {
            let id = components.path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
            return id.isEmpty ? nil : id
        }

        if let value = components.queryItems?.first(where: { $0.name == "v" })?.value, !value.isEmpty {
            return value
        }

        let pathParts = components.path.split(separator: "/").map(String.init)
        if let embedIndex = pathParts.firstIndex(of: "embed"), embedIndex + 1 < pathParts.count {
            return pathParts[embedIndex + 1]
        }

        return nil
    }
}
