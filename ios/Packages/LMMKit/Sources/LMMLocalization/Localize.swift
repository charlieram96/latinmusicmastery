import Foundation

// swiftlint:disable identifier_name
/// Non-mutating overlay logic mirroring `lib/i18n/localize.ts`'s `pick`/`hasValue`.
///
/// The web's `pick` rewrites rows in place at the data-fetch boundary (`localizeRow`,
/// `localizeSectionTree`, …) so render sites keep reading `row.title` unchanged. The iOS models
/// are immutable `Codable` structs, so instead of mutating anything, callers compute a display
/// value on demand via a `display*(_:)` accessor (see `DisplayAccessors.swift`) that calls into
/// ``pick(_:_:_:)`` / ``pickValue(_:_:_:)`` below. Same overlay semantics, just read as a
/// computed property instead of an in-place field rewrite.
public enum Localize {
    /// String overlay where the English value is canonical (never nil): the ES value wins only
    /// when `locale == .es` and it is non-blank once trimmed. Mirrors `hasValue`'s string branch
    /// in `lib/i18n/localize.ts` (`v.trim().length > 0`).
    public static func pick(_ locale: AppLocale, _ en: String, _ es: String?) -> String {
        guard locale == .es, let trimmed = nonBlank(es) else { return en }
        return trimmed
    }

    /// String overlay where the English value may itself be nil (e.g. `description`). Same
    /// ES-wins rule as above; falls back to `en` (nil or not) otherwise.
    public static func pick(_ locale: AppLocale, _ en: String?, _ es: String?) -> String? {
        guard locale == .es, let trimmed = nonBlank(es) else { return en }
        return trimmed
    }

    /// Overlay for non-string values (e.g. `QuizOptions` JSON). Mirrors `hasValue`'s
    /// "objects/arrays are always truthy" rule: `es` wins whenever `locale == .es` and it is
    /// non-nil — no blankness check applies here, unlike the string overloads above.
    public static func pickValue<T>(_ locale: AppLocale, _ en: T?, _ es: T?) -> T? {
        guard locale == .es, let es else { return en }
        return es
    }

    /// `hasValue`'s string branch: nil and all-whitespace strings are both "empty".
    private static func nonBlank(_ string: String?) -> String? {
        guard let string, !string.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            return nil
        }
        return string
    }
}
// swiftlint:enable identifier_name
