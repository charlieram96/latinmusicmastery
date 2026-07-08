import CryptoKit
import Foundation

/// Generates the random nonce (and its SHA-256 hash) Sign in with Apple's replay-protection
/// needs: the raw nonce is sent to Supabase's `signInWithIdToken`, while its hash is what gets
/// attached to the `ASAuthorizationAppleIDRequest`. Pure and network-free by design.
public enum AppleNonceGenerator {
    private static let charset = Array(
        "0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._"
    )

    /// A cryptographically random string drawn from an unreserved-URL-safe charset.
    ///
    /// Uses Swift's standard `randomElement()` (backed by a CSPRNG on Apple platforms) rather
    /// than hand-rolling `SecRandomCopyBytes`, so there's no failure path to `fatalError` on —
    /// auth code must never crash.
    public static func randomNonceString(length: Int = 32) -> String {
        precondition(length > 0, "length must be positive")
        return String((0..<length).compactMap { _ in charset.randomElement() })
    }

    /// Hex-encoded SHA-256 digest of `input`.
    public static func sha256(_ input: String) -> String {
        let digest = SHA256.hash(data: Data(input.utf8))
        return digest.map { String(format: "%02x", $0) }.joined()
    }
}
