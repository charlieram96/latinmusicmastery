import LMMLocalization
import SwiftUI

/// Looks up a UI string from the feature module's String Catalog by semantic key.
/// (DB content is localized separately via `LMMLocalization` display accessors.)
func lmmString(_ key: String) -> String {
    NSLocalizedString(key, bundle: .module, comment: "")
}

/// A format string from the catalog, ready for `String(format:)`.
func lmmFormat(_ key: String, _ args: CVarArg...) -> String {
    String(format: NSLocalizedString(key, bundle: .module, comment: ""), arguments: args)
}

private struct AppLocaleKey: EnvironmentKey {
    static let defaultValue: AppLocale = .current
}

public extension EnvironmentValues {
    /// The display language for bilingual database content, read by views that call the
    /// `LMMLocalization` display accessors.
    var appLocale: AppLocale {
        get { self[AppLocaleKey.self] }
        set { self[AppLocaleKey.self] = newValue }
    }
}

public extension AppLocale {
    /// Derives the app locale from the device's current language. Spanish → `.es`,
    /// everything else → `.en`. A user-facing language override is a later task.
    static var current: AppLocale {
        Locale.current.language.languageCode?.identifier == "es" ? .es : .en
    }
}
