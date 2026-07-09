import Foundation

/// Looks up a user-facing string from PlaySenseUI's own String Catalog by semantic key.
/// Mirrors `LMMFeatures`' `lmmString`/`lmmFormat` pattern (this target ships its own
/// `Localizable.xcstrings`, so it resolves against *this* module's bundle, not LMMFeatures').
///
/// `bundleOverride` is a test-only seam: `PlaySenseUITests` points it at the compiled `es.lproj`
/// so a snapshot can pin one Spanish rendering deterministically, without depending on the
/// simulator's device language (which the `.module` bundle caches on first lookup).
var playSenseLocalizationBundleOverride: Bundle?

func lmmString(_ key: String) -> String {
    NSLocalizedString(key, bundle: playSenseLocalizationBundleOverride ?? .module, comment: "")
}

/// A format string from the catalog, ready for `String(format:)`.
func lmmFormat(_ key: String, _ args: CVarArg...) -> String {
    let bundle = playSenseLocalizationBundleOverride ?? .module
    return String(format: NSLocalizedString(key, bundle: bundle, comment: ""), arguments: args)
}

/// Test seam: PlaySenseUI's own resource bundle, where the String Catalog's compiled `.lproj`
/// folders live. A snapshot test resolves `es.lproj` from here to pin a Spanish rendering.
var playSenseModuleBundle: Bundle { .module }
