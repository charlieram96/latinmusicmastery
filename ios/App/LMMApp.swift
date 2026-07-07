import LMMFeatures
import SwiftUI

/// Runtime configuration read from the app's Info.plist, which in turn is populated from
/// `App/Config/{Debug,Release}.xcconfig` by XcodeGen.
struct AppConfig {
    let supabaseURL: URL
    let supabaseAnonKey: String

    static func loadFromInfoPlist() -> AppConfig {
        guard
            let info = Bundle.main.infoDictionary,
            let urlString = info["SUPABASE_URL"] as? String,
            !urlString.isEmpty,
            let url = URL(string: urlString),
            let anonKey = info["SUPABASE_ANON_KEY"] as? String,
            !anonKey.isEmpty
        else {
            fatalError(
                "Missing or blank SUPABASE_URL / SUPABASE_ANON_KEY in Info.plist. " +
                "Check App/Config/Debug.xcconfig and App/Config/Release.xcconfig."
            )
        }
        return AppConfig(supabaseURL: url, supabaseAnonKey: anonKey)
    }
}

@main
struct LMMApp: App {
    let config = AppConfig.loadFromInfoPlist()

    var body: some Scene {
        WindowGroup {
            RootPlaceholderView()
        }
    }
}
