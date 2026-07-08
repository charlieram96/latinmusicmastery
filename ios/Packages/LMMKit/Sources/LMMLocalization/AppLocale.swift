import Foundation

// swiftlint:disable identifier_name
/// The viewer's chosen display language for bilingual database content. Mirrors the web's
/// `Locale` type (`lib/i18n/index.ts`: `'en' | 'es'`).
public enum AppLocale: String, Equatable, Hashable, Sendable, CaseIterable {
    case en
    case es
}
// swiftlint:enable identifier_name
