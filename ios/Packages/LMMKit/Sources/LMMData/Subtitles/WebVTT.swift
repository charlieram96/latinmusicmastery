import Foundation

/// One parsed subtitle cue: a time window and its (possibly multi-line) text.
public struct SubtitleCue: Equatable, Sendable {
    public let start: TimeInterval
    public let end: TimeInterval
    public let text: String

    public init(start: TimeInterval, end: TimeInterval, text: String) {
        self.start = start
        self.end = end
        self.text = text
    }
}

/// A minimal WebVTT parser, sized to the output of `lib/subtitles/srt-to-vtt.ts`:
/// a `WEBVTT` header, blank-line-separated cue blocks, optional numeric cue identifiers, and
/// `HH:MM:SS.mmm --> HH:MM:SS.mmm` timing lines (with optional cue-setting suffixes).
///
/// Deliberately tolerant: it accepts both the WebVTT dot and the SRT comma millisecond
/// separators, skips `NOTE`/`STYLE`/`REGION` blocks and malformed cues, and never throws — a
/// garbled sidecar yields the cues it could parse rather than failing playback.
public enum WebVTTParser {
    public static func parse(_ raw: String) -> [SubtitleCue] {
        // Normalize newlines and strip a leading BOM (srt-to-vtt does the same before emitting).
        let normalized = raw
            .replacingOccurrences(of: "\u{FEFF}", with: "")
            .replacingOccurrences(of: "\r\n", with: "\n")
            .replacingOccurrences(of: "\r", with: "\n")

        // Blocks are separated by one or more blank lines.
        let blocks = normalized.components(separatedBy: "\n\n")
        var cues: [SubtitleCue] = []

        for block in blocks {
            let trimmed = block.trimmingCharacters(in: .whitespacesAndNewlines)
            if trimmed.isEmpty { continue }

            var lines = trimmed.components(separatedBy: "\n")

            // Skip the header and non-cue blocks.
            let firstUpper = lines[0].uppercased()
            if firstUpper.hasPrefix("WEBVTT") || firstUpper.hasPrefix("NOTE")
                || firstUpper.hasPrefix("STYLE") || firstUpper.hasPrefix("REGION") {
                continue
            }

            // An optional cue identifier occupies the first line when it has no timing arrow.
            if !lines[0].contains("-->"), lines.count > 1 {
                lines.removeFirst()
            }

            guard let timingLine = lines.first, timingLine.contains("-->") else { continue }
            guard let (start, end) = parseTiming(timingLine) else { continue }

            let text = lines.dropFirst().joined(separator: "\n").trimmingCharacters(in: .whitespacesAndNewlines)
            if text.isEmpty { continue }

            cues.append(SubtitleCue(start: start, end: end, text: text))
        }

        return cues
    }

    /// The cue text active at `seconds`, or `nil` when between cues. Cues are assumed
    /// non-overlapping and ordered, matching real subtitle sidecars; the first match wins.
    public static func activeCue(at seconds: TimeInterval, in cues: [SubtitleCue]) -> String? {
        cues.first { seconds >= $0.start && seconds < $0.end }?.text
    }

    // MARK: - Timing

    private static func parseTiming(_ line: String) -> (TimeInterval, TimeInterval)? {
        // Split on the arrow; the right side may carry cue settings (e.g. "line:-3 align:start").
        let parts = line.components(separatedBy: "-->")
        guard parts.count == 2 else { return nil }

        let startToken = parts[0].trimmingCharacters(in: .whitespaces)
        let endToken = parts[1]
            .trimmingCharacters(in: .whitespaces)
            .components(separatedBy: .whitespaces)
            .first ?? ""

        guard let start = parseTimestamp(startToken), let end = parseTimestamp(endToken) else {
            return nil
        }
        return (start, end)
    }

    /// Parses `HH:MM:SS.mmm`, `MM:SS.mmm`, or the comma-separated SRT variants into seconds.
    private static func parseTimestamp(_ token: String) -> TimeInterval? {
        let unified = token.replacingOccurrences(of: ",", with: ".")
        let hmsAndMillis = unified.components(separatedBy: ".")
        let hms = hmsAndMillis[0]
        let millis = hmsAndMillis.count > 1 ? Double("0." + hmsAndMillis[1]) ?? 0 : 0

        let segments = hms.components(separatedBy: ":").map { Double($0) }
        guard segments.allSatisfy({ $0 != nil }) else { return nil }
        let values = segments.compactMap { $0 }

        switch values.count {
        case 3: return values[0] * 3600 + values[1] * 60 + values[2] + millis
        // Defensive only: `lib/subtitles/srt-to-vtt.ts` always emits HH:MM:SS, so this hour-less
        // MM:SS.mmm branch exists solely to tolerate a hand-authored or third-party sidecar.
        case 2: return values[0] * 60 + values[1] + millis
        case 1: return values[0] + millis
        default: return nil
        }
    }
}
