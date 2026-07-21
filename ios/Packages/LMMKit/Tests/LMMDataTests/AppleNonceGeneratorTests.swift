import XCTest

@testable import LMMData

/// `AppleNonceGenerator` backs Sign in with Apple's replay-protection nonce: a random raw
/// string sent to Supabase's `signInWithIdToken`, and a SHA-256 hash of it attached to the
/// `ASAuthorizationAppleIDRequest`. All of this is pure and network-free, so it's fully
/// unit-testable.
final class AppleNonceGeneratorTests: XCTestCase {
    func testRandomNonceStringDefaultLengthIs32() {
        XCTAssertEqual(AppleNonceGenerator.randomNonceString().count, 32)
    }

    func testRandomNonceStringRespectsRequestedLength() {
        XCTAssertEqual(AppleNonceGenerator.randomNonceString(length: 8).count, 8)
    }

    func testRandomNonceStringUsesOnlyAllowedCharset() {
        let allowed = Set("0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._")
        let nonce = AppleNonceGenerator.randomNonceString(length: 256)
        XCTAssertTrue(nonce.allSatisfy(allowed.contains))
    }

    func testRandomNonceStringIsNotConstantAcrossCalls() {
        let first = AppleNonceGenerator.randomNonceString()
        let second = AppleNonceGenerator.randomNonceString()
        XCTAssertNotEqual(first, second)
    }

    func testSHA256OfEmptyStringMatchesKnownVector() {
        XCTAssertEqual(
            AppleNonceGenerator.sha256(""),
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        )
    }

    func testSHA256OfKnownStringMatchesKnownVector() {
        XCTAssertEqual(
            AppleNonceGenerator.sha256("abc"),
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        )
    }
}
