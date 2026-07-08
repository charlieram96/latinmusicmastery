import Foundation
import LMMModels

/// Shared TipTap/ProseMirror JSON fixture documents for ``TipTapParsingTests`` and
/// ``TipTapViewSnapshotTests``. Mirrors the bounded node/mark set the admin course-studio
/// editor (`components/admin/tiptap-editor.tsx`: StarterKit + Image + Youtube + Link) can
/// actually produce — see `TipTapView.swift` for the full inventory.
enum TipTapFixtures {
    static func doc(_ json: String) -> JSONValue {
        // swiftlint:disable:next force_try
        try! JSONDecoder().decode(JSONValue.self, from: Data(json.utf8))
    }

    /// Nested list: a bullet item containing its own paragraph plus a nested, non-default-start
    /// ordered list — exercises recursive list-item parsing.
    static let nestedLists = doc("""
    {
      "type": "doc",
      "content": [
        {
          "type": "bulletList",
          "content": [
            {
              "type": "listItem",
              "content": [
                { "type": "paragraph", "content": [{ "type": "text", "text": "Top" }] },
                {
                  "type": "orderedList",
                  "attrs": { "start": 2 },
                  "content": [
                    {
                      "type": "listItem",
                      "content": [
                        { "type": "paragraph", "content": [{ "type": "text", "text": "Nested A" }] }
                      ]
                    },
                    {
                      "type": "listItem",
                      "content": [
                        { "type": "paragraph", "content": [{ "type": "text", "text": "Nested B" }] }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    }
    """)

    /// Combined + isolated marks within one paragraph: bold, then a plain run, then
    /// italic+strike combined on a single text node (as ProseMirror actually emits combos).
    static let marksCombos = doc("""
    {
      "type": "doc",
      "content": [
        {
          "type": "paragraph",
          "content": [
            { "type": "text", "text": "Bold", "marks": [{ "type": "bold" }] },
            { "type": "text", "text": " and " },
            { "type": "text", "text": "italic-strike", "marks": [{ "type": "italic" }, { "type": "strike" }] }
          ]
        }
      ]
    }
    """)

    /// A node type the admin editor's StarterKit config *can* technically produce (`codeBlock`)
    /// but which is deliberately out of B8's bounded rendering scope — the canonical
    /// "unknown node" graceful-degradation fixture.
    static let unknownNode = doc("""
    { "type": "doc", "content": [
      { "type": "codeBlock", "content": [{ "type": "text", "text": "let x = 1" }] }
    ] }
    """)

    /// A tappable link mark.
    static let link = doc("""
    { "type": "doc", "content": [
      { "type": "paragraph", "content": [
        {
          "type": "text",
          "text": "Visit our site",
          "marks": [{ "type": "link", "attrs": { "href": "https://latinmusicmastery.com" } }]
        }
      ]}
    ]}
    """)

    /// A `link` mark carrying the app's own `lmm://` deep-link scheme — CMS-authored content is
    /// untrusted input and shouldn't be able to mint a new tappable deep link into the app, so
    /// this must degrade to plain (non-tappable) text.
    static let linkWithAppSchemeHref = doc("""
    { "type": "doc", "content": [
      { "type": "paragraph", "content": [
        {
          "type": "text",
          "text": "Suspicious deep link",
          "marks": [{ "type": "link", "attrs": { "href": "lmm://admin/grant-access" } }]
        }
      ]}
    ]}
    """)

    /// A `link` mark carrying a `javascript:` href — must also degrade to plain text.
    static let linkWithJavascriptHref = doc("""
    { "type": "doc", "content": [
      { "type": "paragraph", "content": [
        {
          "type": "text",
          "text": "Suspicious script link",
          "marks": [{ "type": "link", "attrs": { "href": "javascript:alert(1)" } }]
        }
      ]}
    ]}
    """)

    /// A text node carrying a mark type this renderer doesn't style (`underline`, which the
    /// admin editor's extension config can never actually emit, and `code`, which it can) —
    /// both should degrade to unstyled text without error.
    static let unknownMarks = doc("""
    { "type": "doc", "content": [
      { "type": "paragraph", "content": [
        { "type": "text", "text": "Underlined? ", "marks": [{ "type": "underline" }] },
        { "type": "text", "text": "Coded?", "marks": [{ "type": "code" }] }
      ]}
    ]}
    """)

    /// An `image` node missing `attrs.src`, alongside a valid paragraph — the malformed node
    /// should be dropped (silently in terms of output, but logged) while the valid sibling
    /// content still renders.
    static let malformedImageMissingSrc = doc("""
    { "type": "doc", "content": [
      { "type": "image", "attrs": { "alt": "no src here" } },
      { "type": "paragraph", "content": [{ "type": "text", "text": "Still here" }] }
    ]}
    """)

    /// A `youtube` node missing `attrs.src`, alongside a valid paragraph.
    static let malformedYoutubeMissingSrc = doc("""
    { "type": "doc", "content": [
      { "type": "youtube", "attrs": { "start": 0 } },
      { "type": "paragraph", "content": [{ "type": "text", "text": "Still here" }] }
    ]}
    """)

    /// A pathologically deep nested list — 80 levels of `bulletList` > `listItem`, well past the
    /// parser's recursion-depth guard (``TipTapBlockParser/maxDepth`` = 50) — proving the parser
    /// degrades gracefully instead of overflowing the stack on a crafted or corrupted document.
    static let deeplyNestedLists: JSONValue = {
        let depth = 80
        let oneLevel = #"{"type":"bulletList","content":[{"type":"listItem","content":["#
        let opening = String(repeating: oneLevel, count: depth)
        let innermost = #"{"type":"paragraph","content":[{"type":"text","text":"Bottom"}]}"#
        let closing = String(repeating: "]}]}", count: depth)
        return doc(#"{"type":"doc","content":["# + opening + innermost + closing + "]}")
    }()

    /// Nodes whose shapes don't match what any real TipTap/ProseMirror document would produce —
    /// a numeric `type`, a node with no `type` at all, `content`/`marks`/`attrs` holding the
    /// wrong JSON kind entirely — mixed in around one valid paragraph. Proves the parser's
    /// pattern-matching guards degrade each garbage shape instead of crashing, while the valid
    /// sibling content still comes through.
    static let garbageShapedNodes = doc("""
    { "type": "doc", "content": [
      { "type": 42, "content": "not-an-array" },
      { "content": [ "just-a-string", 5, true, null,
        { "type": "paragraph", "content": [ { "type": "text", "text": "Ignored, wrong shape" } ] }
      ]},
      {
        "type": "paragraph",
        "attrs": "oops-not-an-object",
        "content": [ { "type": "text", "text": "Survives", "marks": "not-an-array-either" } ]
      }
    ]}
    """)

    /// `hardBreak` inside a single paragraph becomes a literal newline in the rendered text.
    static let hardBreak = doc("""
    { "type": "doc", "content": [
      { "type": "paragraph", "content": [
        { "type": "text", "text": "Line one" },
        { "type": "hardBreak" },
        { "type": "text", "text": "Line two" }
      ]}
    ]}
    """)

    /// A heading level outside the admin toolbar's 1–3 range (defensive: some future or pasted
    /// content could carry `level: 5`) — clamped to the nearest supported level.
    static let outOfRangeHeadingLevel = doc("""
    { "type": "doc", "content": [
      { "type": "heading", "attrs": { "level": 5 }, "content": [{ "type": "text", "text": "Whoa" }] }
    ]}
    """)

    static let image = doc("""
    { "type": "doc", "content": [
      { "type": "image", "attrs": { "src": "https://cdn.example.com/pic.jpg", "alt": "A photo" } }
    ]}
    """)

    static let youtube = doc("""
    { "type": "doc", "content": [
      {
        "type": "youtube",
        "attrs": { "src": "https://www.youtube.com/watch?v=dQw4w9WgXcQ", "start": 0, "width": 640, "height": 480 }
      }
    ]}
    """)

    /// A visually representative doc for the snapshot test: heading, marked-up paragraph, a
    /// bullet list, a blockquote, and a horizontal rule. Deliberately excludes `image`/`youtube`
    /// (their `AsyncImage`/network-backed thumbnails would make the snapshot non-deterministic).
    static let representative = doc("""
    {
      "type": "doc",
      "content": [
        { "type": "heading", "attrs": { "level": 2 }, "content": [{ "type": "text", "text": "Warm-up" }] },
        {
          "type": "paragraph",
          "content": [
            { "type": "text", "text": "Play the " },
            { "type": "text", "text": "cáscara", "marks": [{ "type": "bold" }] },
            { "type": "text", "text": " pattern " },
            { "type": "text", "text": "slowly", "marks": [{ "type": "italic" }] },
            { "type": "text", "text": " at first — see the " },
            {
              "type": "text",
              "text": "reference chart",
              "marks": [{ "type": "link", "attrs": { "href": "https://latinmusicmastery.com/charts" } }]
            },
            { "type": "text", "text": "." }
          ]
        },
        {
          "type": "bulletList",
          "content": [
            {
              "type": "listItem",
              "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Right hand only" }] }]
            },
            {
              "type": "listItem",
              "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Both hands together" }] }]
            }
          ]
        },
        {
          "type": "blockquote",
          "content": [
            {
              "type": "paragraph",
              "content": [{ "type": "text", "text": "Feel the clave before you play it." }]
            }
          ]
        },
        { "type": "horizontalRule" }
      ]
    }
    """)
}
