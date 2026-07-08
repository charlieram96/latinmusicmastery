import LMMModels

/// PLACEHOLDER for the full TipTap renderer (Task B8). Extracts plain-text paragraphs from a
/// ProseMirror `rich_content` document so lesson notes are at least readable today. B8 swaps this
/// one function for a real rich renderer without touching the class viewer.
enum RichContentText {
    /// Returns the document's block-level text as paragraphs (empty when there's no prose).
    static func paragraphs(from content: JSONValue?) -> [String] {
        guard let content else { return [] }
        var blocks: [String] = []
        collectBlocks(content, into: &blocks)
        return blocks.filter { !$0.isEmpty }
    }

    /// Block nodes (paragraph, heading, list_item, …) become one paragraph each; their inline
    /// text children are concatenated.
    private static func collectBlocks(_ node: JSONValue, into blocks: inout [String]) {
        guard case .object(let dict) = node else {
            if case .array(let array) = node {
                array.forEach { collectBlocks($0, into: &blocks) }
            }
            return
        }

        let type = dict["type"].flatMap { value -> String? in
            if case .string(let name) = value { return name }
            return nil
        }

        if let type, blockTypes.contains(type) {
            let text = inlineText(of: dict["content"])
            blocks.append(text.trimmingCharacters(in: .whitespacesAndNewlines))
            return
        }

        // Not a block node itself (e.g. the top-level `doc`) — recurse into its content.
        if let content = dict["content"] {
            collectBlocks(content, into: &blocks)
        }
    }

    /// Concatenates the `text` of inline descendants.
    private static func inlineText(of node: JSONValue?) -> String {
        guard let node else { return "" }
        switch node {
        case .array(let array):
            return array.map { inlineText(of: $0) }.joined()
        case .object(let dict):
            if case .string(let text)? = dict["text"] {
                return text
            }
            return inlineText(of: dict["content"])
        default:
            return ""
        }
    }

    private static let blockTypes: Set<String> = [
        "paragraph", "heading", "blockquote", "listItem", "list_item", "codeBlock", "code_block"
    ]
}
