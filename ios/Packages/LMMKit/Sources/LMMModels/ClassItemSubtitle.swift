import Foundation

/// One entry of the `class_items.subtitles` jsonb array (web parity: `lib/subtitles/tracks.ts`).
///
/// `ClassItem` carries the column as `JSONValue?` — like `rich_content` — so a single malformed
/// element or a pre-migration backend can never fail the whole catalog decode; `parse` is the
/// tolerant reader that turns it into typed tracks.
public struct ClassItemSubtitle: Equatable, Hashable, Sendable {
    public let lang: String
    public let src: String

    public init(lang: String, src: String) {
        self.lang = lang
        self.src = src
    }

    /// Hard cap per video, mirrored by the `class_items_subtitles_shape` CHECK constraint.
    public static let maxTracks = 9

    /// Drops non-arrays and malformed elements, lowercases/trims codes, dedupes by language
    /// (first wins) and caps at ``maxTracks``.
    public static func parse(_ json: JSONValue?) -> [ClassItemSubtitle] {
        guard case .array(let elements)? = json else { return [] }
        var out: [ClassItemSubtitle] = []
        var seen = Set<String>()
        for element in elements {
            if out.count >= maxTracks { break }
            guard case .object(let fields) = element,
                  case .string(let rawLang)? = fields["lang"],
                  case .string(let src)? = fields["src"],
                  !src.isEmpty
            else { continue }
            let lang = rawLang.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            guard !lang.isEmpty, !seen.contains(lang) else { continue }
            seen.insert(lang)
            out.append(ClassItemSubtitle(lang: lang, src: src))
        }
        return out
    }
}

/// Languages the course builder offers, in picker order. Labels are native names and must stay
/// injective (the player control bar keys its caption menu on label strings). Mirrors
/// `SUBTITLE_LANGUAGES` in `lib/subtitles/srt-to-vtt.ts` — keep the two lists in sync.
public enum SubtitleLanguages {
    public struct Entry: Equatable, Sendable {
        public let code: String
        public let label: String
    }

    public static let all: [Entry] = [
        Entry(code: "en", label: "English"),
        Entry(code: "es", label: "Español"),
        Entry(code: "pt", label: "Português"),
        Entry(code: "fr", label: "Français"),
        Entry(code: "it", label: "Italiano"),
        Entry(code: "de", label: "Deutsch"),
        Entry(code: "nl", label: "Nederlands"),
        Entry(code: "ja", label: "日本語"),
        Entry(code: "zh", label: "中文"),
    ]

    /// Native display name for a code; unknown codes fall back to the code itself.
    public static func label(for code: String) -> String {
        all.first { $0.code == code }?.label ?? code
    }
}
