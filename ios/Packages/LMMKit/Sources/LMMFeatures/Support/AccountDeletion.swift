import Foundation

/// The App Review §5.1.1(v) account-deletion path for v1: the app can't yet delete the account
/// server-side (a Supabase Edge Function is a Stage E task), so it opens a prefilled support email
/// requesting deletion — the reviewer-accepted interim design. The URL construction is factored out
/// here so it can be unit-tested without a running mail client.
enum AccountDeletionRequest {
    /// The published support address (see the web's contact / privacy / terms pages).
    static let supportEmail = "support@latinmusicmastery.com"

    /// Builds a `mailto:` URL to `supportEmail` with the given subject/body percent-encoded into the
    /// query. Returns `nil` only if the components can't form a URL (they always can here).
    /// `URLComponents` already encodes spaces as `%20` and newlines as `%0A` in the query, so no
    /// manual fix-up is needed (and none is done — that would corrupt a literal `+` in the body).
    static func mailtoURL(subject: String, body: String) -> URL? {
        var components = URLComponents()
        components.scheme = "mailto"
        components.path = supportEmail
        components.queryItems = [
            URLQueryItem(name: "subject", value: subject),
            URLQueryItem(name: "body", value: body)
        ]
        return components.url
    }
}
