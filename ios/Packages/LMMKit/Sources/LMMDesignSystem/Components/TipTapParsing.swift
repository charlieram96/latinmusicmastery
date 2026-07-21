import Foundation
import LMMModels

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
    /// A CMS-authored (or corrupted/adversarial) document could nest lists/blockquotes
    /// arbitrarily deep. Past this depth, parsing stops descending and degrades to an
    /// `unknown` block (logged, no crash) instead of risking a stack overflow.
    static let maxDepth = 50

    static func blocks(from content: JSONValue?) -> [TipTapBlock] {
        guard let content else { return [] }
        return childBlocks(of: content, depth: 0)
    }

    /// Parses every element of `node`'s `content` array as a block. Used for the document root
    /// (whose own `type` — normally `"doc"` — we don't need to check) and for `listItem`.
    private static func childBlocks(of node: JSONValue, depth: Int) -> [TipTapBlock] {
        guard depth <= maxDepth else {
            TipTapLog.depthLimitExceeded(context: "childBlocks")
            return []
        }
        guard case .object(let dict) = node else { return [] }
        return arrayContent(dict["content"]).compactMap { parseBlock($0, depth: depth + 1) }
    }

    private static func parseBlock(_ node: JSONValue, depth: Int) -> TipTapBlock? {
        guard depth <= maxDepth else {
            TipTapLog.depthLimitExceeded(context: "parseBlock")
            return .unknown(text: AttributedString())
        }
        guard case .object(let dict) = node, case .string(let type)? = dict["type"] else { return nil }
        return parseTypedBlock(type: type, dict: dict, depth: depth)
    }

    /// The type-dispatch half of `parseBlock`, split out to keep either function's branch count
    /// (and therefore cyclomatic complexity) low on its own.
    private static func parseTypedBlock(type: String, dict: [String: JSONValue], depth: Int) -> TipTapBlock? {
        let children = arrayContent(dict["content"])

        switch type {
        case "paragraph":
            return .paragraph(TipTapInline.attributedString(from: children, depth: depth))

        case "heading":
            let level = intAttr(dict["attrs"], key: "level") ?? 1
            return .heading(
                level: min(max(level, 1), 3),
                text: TipTapInline.attributedString(from: children, depth: depth)
            )

        case "bulletList":
            return .bulletList(children.map { childBlocks(of: $0, depth: depth + 1) })

        case "orderedList":
            let start = intAttr(dict["attrs"], key: "start") ?? 1
            return .orderedList(start: start, items: children.map { childBlocks(of: $0, depth: depth + 1) })

        case "blockquote":
            return .blockquote(children.compactMap { parseBlock($0, depth: depth + 1) })

        case "horizontalRule":
            return .horizontalRule

        case "image":
            return parseImage(attrs: dict["attrs"])

        case "youtube":
            return parseYoutube(attrs: dict["attrs"])

        default:
            TipTapLog.unknownNode(type)
            return .unknown(text: TipTapInline.attributedString(from: children, depth: depth))
        }
    }

    private static func parseImage(attrs attrsValue: JSONValue?) -> TipTapBlock? {
        guard case .object(let attrs)? = attrsValue, case .string(let src)? = attrs["src"] else {
            TipTapLog.malformedNode("image", reason: "missing or non-string \"attrs.src\"")
            return nil
        }
        return .image(src: src, alt: attrs["alt"]?.stringValue)
    }

    private static func parseYoutube(attrs attrsValue: JSONValue?) -> TipTapBlock? {
        guard case .object(let attrs)? = attrsValue, case .string(let src)? = attrs["src"] else {
            TipTapLog.malformedNode("youtube", reason: "missing or non-string \"attrs.src\"")
            return nil
        }
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
    /// Schemes allowed to become a tappable `.link` attribute. CMS-authored `rich_content` is
    /// untrusted input: without this allowlist, a `link` mark's `href` could carry the app's
    /// own `lmm://` deep-link scheme (or `javascript:`, etc.) and turn plain rendered text into
    /// a tappable deep link the CMS author never should have been able to mint.
    private static let allowedLinkSchemes: Set<String> = ["http", "https", "mailto"]

    static func attributedString(from nodes: [JSONValue], depth: Int) -> AttributedString {
        guard depth <= TipTapBlockParser.maxDepth else {
            TipTapLog.depthLimitExceeded(context: "TipTapInline")
            return AttributedString()
        }
        return nodes.reduce(into: AttributedString()) { result, node in
            result += run(for: node, depth: depth)
        }
    }

    private static func run(for node: JSONValue, depth: Int) -> AttributedString {
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
                return attributedString(from: children, depth: depth + 1)
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
                    let url = URL(string: href),
                    let scheme = url.scheme?.lowercased(),
                    allowedLinkSchemes.contains(scheme) {
                    attributed.link = url
                    attributed.foregroundColor = LMMColor.primary
                } else if
                    case .object(let linkAttrs)? = markDict["attrs"],
                    case .string(let href)? = linkAttrs["href"] {
                    // Parseable URL, but not an allowlisted scheme (or no scheme at all) —
                    // degrade to plain styled text rather than making it tappable.
                    TipTapLog.rejectedLinkScheme(href)
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

    /// A node of a *known* type that's missing a required attribute (e.g. `image`/`youtube`
    /// without `attrs.src`) and is silently dropped from the parsed output.
    static func malformedNode(_ type: String, reason: String) {
        #if DEBUG
        print("TipTapView: malformed \"\(type)\" node (\(reason)) — dropping it")
        #endif
    }

    /// A `link` mark's `href` didn't pass the tappable-scheme allowlist (`http`/`https`/
    /// `mailto`) — rendered as plain styled text instead of a tappable link.
    static func rejectedLinkScheme(_ href: String) {
        #if DEBUG
        print("TipTapView: rejected link scheme for href \"\(href)\" — rendering as plain text")
        #endif
    }

    /// The parser's recursion-depth cap (``TipTapBlockParser/maxDepth``) was hit — descent
    /// stopped there instead of continuing, to bound stack usage against pathologically deep
    /// or malformed documents.
    static func depthLimitExceeded(context: String) {
        #if DEBUG
        print("TipTapView: parse depth limit (\(TipTapBlockParser.maxDepth)) exceeded in \(context)")
        #endif
    }
}
