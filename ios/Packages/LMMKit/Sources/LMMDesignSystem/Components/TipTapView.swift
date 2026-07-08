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
/// native `.link` attribute).
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

// MARK: - Parsed model

/// A parsed, renderable block-level node. Parsing (`TipTapBlockParser`) is pure Swift — no
/// SwiftUI — so it's unit-testable without hosting a view.
enum TipTapBlock: Equatable {
    case paragraph(AttributedString)
    case heading(level: Int, text: AttributedString)
    /// Each inner array is one list item's block children (usually a single paragraph, but a
    /// list item may itself contain a nested list).
    case bulletList([[TipTapBlock]])
    case orderedList(start: Int, items: [[TipTapBlock]])
    case blockquote([TipTapBlock])
    case horizontalRule
    case image(src: String, alt: String?)
    case youtube(src: String)
    /// Graceful fallback for a node type outside the bounded rendering set (e.g. `codeBlock`):
    /// its text descendants still show, just unstyled.
    case unknown(text: AttributedString)
}

/// Parses a TipTap/ProseMirror JSON document (`JSONValue`) into ``TipTapBlock``s.
enum TipTapBlockParser {
    static func blocks(from content: JSONValue?) -> [TipTapBlock] {
        guard let content else { return [] }
        return childBlocks(of: content)
    }

    /// Parses every element of `node`'s `content` array as a block. Used for the document root
    /// (whose own `type` — normally `"doc"` — we don't need to check) and for `listItem`.
    private static func childBlocks(of node: JSONValue) -> [TipTapBlock] {
        guard case .object(let dict) = node else { return [] }
        return arrayContent(dict["content"]).compactMap(parseBlock)
    }

    private static func parseBlock(_ node: JSONValue) -> TipTapBlock? {
        guard case .object(let dict) = node, case .string(let type)? = dict["type"] else { return nil }
        let children = arrayContent(dict["content"])

        switch type {
        case "paragraph":
            return .paragraph(TipTapInline.attributedString(from: children))

        case "heading":
            let level = intAttr(dict["attrs"], key: "level") ?? 1
            return .heading(level: min(max(level, 1), 3), text: TipTapInline.attributedString(from: children))

        case "bulletList":
            return .bulletList(children.map(childBlocks(of:)))

        case "orderedList":
            let start = intAttr(dict["attrs"], key: "start") ?? 1
            return .orderedList(start: start, items: children.map(childBlocks(of:)))

        case "blockquote":
            return .blockquote(children.compactMap(parseBlock))

        case "horizontalRule":
            return .horizontalRule

        case "image":
            return parseImage(attrs: dict["attrs"])

        case "youtube":
            return parseYoutube(attrs: dict["attrs"])

        default:
            TipTapLog.unknownNode(type)
            return .unknown(text: TipTapInline.attributedString(from: children))
        }
    }

    private static func parseImage(attrs attrsValue: JSONValue?) -> TipTapBlock? {
        guard case .object(let attrs)? = attrsValue, case .string(let src)? = attrs["src"] else { return nil }
        return .image(src: src, alt: attrs["alt"]?.stringValue)
    }

    private static func parseYoutube(attrs attrsValue: JSONValue?) -> TipTapBlock? {
        guard case .object(let attrs)? = attrsValue, case .string(let src)? = attrs["src"] else { return nil }
        return .youtube(src: src)
    }

    private static func intAttr(_ attrsValue: JSONValue?, key: String) -> Int? {
        guard case .object(let attrs)? = attrsValue, case .number(let value)? = attrs[key] else { return nil }
        return Int(value)
    }

    private static func arrayContent(_ value: JSONValue?) -> [JSONValue] {
        guard case .array(let array)? = value else { return [] }
        return array
    }
}

/// Builds the inline `AttributedString` for a block's `content` array (`text` / `hardBreak`
/// nodes, with `marks` applied per run).
private enum TipTapInline {
    static func attributedString(from nodes: [JSONValue]) -> AttributedString {
        nodes.reduce(into: AttributedString()) { result, node in
            result += run(for: node)
        }
    }

    private static func run(for node: JSONValue) -> AttributedString {
        guard case .object(let dict) = node else { return AttributedString() }
        let type = dict["type"]?.stringValue

        switch type {
        case "text":
            guard case .string(let text)? = dict["text"] else { return AttributedString() }
            var attributed = AttributedString(text)
            applyMarks(dict["marks"], to: &attributed)
            return attributed

        case "hardBreak":
            return AttributedString("\n")

        default:
            // Not itself renderable inline — degrade to any nested text (graceful degradation).
            TipTapLog.unknownNode(type ?? "<missing type>")
            if case .array(let children)? = dict["content"] {
                return attributedString(from: children)
            }
            return AttributedString()
        }
    }

    private static func applyMarks(_ marksValue: JSONValue?, to attributed: inout AttributedString) {
        guard case .array(let marks)? = marksValue else { return }
        for markValue in marks {
            guard
                case .object(let markDict) = markValue,
                case .string(let markType)? = markDict["type"]
            else { continue }

            switch markType {
            case "bold":
                attributed.inlinePresentationIntent = (attributed.inlinePresentationIntent ?? [])
                    .union(.stronglyEmphasized)
            case "italic":
                attributed.inlinePresentationIntent = (attributed.inlinePresentationIntent ?? [])
                    .union(.emphasized)
            case "strike":
                attributed.strikethroughStyle = .single
            case "link":
                if
                    case .object(let linkAttrs)? = markDict["attrs"],
                    case .string(let href)? = linkAttrs["href"],
                    let url = URL(string: href) {
                    attributed.link = url
                    attributed.foregroundColor = LMMColor.primary
                }
            default:
                // Unknown mark (e.g. the editor has no `underline` extension to ever emit one,
                // or an inline `code` mark this renderer doesn't style specially) — ignored;
                // the run's text still renders, just without that styling.
                break
            }
        }
    }
}

private extension JSONValue {
    var stringValue: String? {
        if case .string(let value) = self { return value }
        return nil
    }
}

/// Debug-only visibility into documents that carry node types outside the bounded rendering
/// set, so gaps show up during development without crashing or dropping content in release.
enum TipTapLog {
    static func unknownNode(_ type: String) {
        #if DEBUG
        print("TipTapView: unknown node type \"\(type)\" — rendering its text children only")
        #endif
    }
}

// MARK: - Rendering

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
