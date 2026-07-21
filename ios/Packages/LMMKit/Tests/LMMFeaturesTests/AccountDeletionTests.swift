import XCTest

@testable import LMMFeatures

/// Covers the App Review §5.1.1(v) deletion path's URL construction (finding 1). No mail client is
/// launched — just the `mailto:` URL the Profile screen hands to `openURL`.
final class AccountDeletionTests: XCTestCase {
    func testMailtoURLTargetsSupportAddress() throws {
        let url = try XCTUnwrap(
            AccountDeletionRequest.mailtoURL(subject: "Account deletion request", body: "hello")
        )
        XCTAssertEqual(url.scheme, "mailto")
        // The recipient is the `mailto:` path (everything before the `?`).
        let recipient = url.absoluteString.prefix(while: { $0 != "?" })
        XCTAssertEqual(recipient, "mailto:support@latinmusicmastery.com")
        XCTAssertEqual(url.absoluteString.hasPrefix("mailto:support@latinmusicmastery.com?"), true)
    }

    func testMailtoURLEncodesSubjectBodyAndSpaces() throws {
        let url = try XCTUnwrap(
            AccountDeletionRequest.mailtoURL(
                subject: "Account deletion request",
                body: "Please delete my account.\n\nAccount email: user@example.com\n"
            )
        )
        // `mailto:` is an opaque URL, so `URL.query` is nil — read the query via URLComponents.
        let components = try XCTUnwrap(URLComponents(url: url, resolvingAgainstBaseURL: false))
        let query = try XCTUnwrap(components.percentEncodedQuery)
        XCTAssertTrue(query.contains("subject=Account%20deletion%20request"), query)
        // Spaces are `%20` (not `+`), newlines are encoded, and the account email survives.
        XCTAssertFalse(query.contains("+"), "spaces must encode as %20, not +: \(query)")
        XCTAssertTrue(query.contains("user@example.com") || query.contains("user%40example.com"), query)
        XCTAssertTrue(query.contains("%0A"), "newlines should be percent-encoded: \(query)")

        // Round-trips back to the original body through URLComponents decoding.
        let bodyItem = components.queryItems?.first { $0.name == "body" }
        XCTAssertEqual(bodyItem?.value, "Please delete my account.\n\nAccount email: user@example.com\n")
    }
}
