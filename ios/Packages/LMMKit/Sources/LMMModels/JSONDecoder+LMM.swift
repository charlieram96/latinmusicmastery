import Foundation

extension JSONDecoder {
    /// Shared decoder for PostgREST responses.
    ///
    /// PostgREST (Supabase) returns timestamps as ISO-8601 with microsecond fractional
    /// seconds and a `+00:00` offset (e.g. `2026-06-22T19:44:46.364587+00:00`), but some
    /// columns come back without fractional seconds. This decoder tolerates both.
    public static let lmm: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let string = try container.decode(String.self)
            if let date = LMMDateParser.date(from: string) {
                return date
            }
            throw DecodingError.dataCorruptedError(
                in: container,
                debugDescription: "Unrecognized ISO-8601 date: \(string)"
            )
        }
        return decoder
    }()
}

/// Tolerant ISO-8601 parsing shared by `JSONDecoder.lmm`.
enum LMMDateParser {
    /// `ISO8601DateFormatter` is documented thread-safe, so shared instances are fine.
    private static let fractional: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    private static let plain: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()

    static func date(from string: String) -> Date? {
        fractional.date(from: string) ?? plain.date(from: string)
    }
}
