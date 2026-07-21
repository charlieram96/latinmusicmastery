import AuthenticationServices
import Supabase
import XCTest

@testable import LMMData

/// `AuthServiceError.map` translates supabase-swift's `AuthError` (and transport failures)
/// into typed, user-presentable cases. Every case here is constructed directly from the SDK's
/// real `AuthError` enum (no mocking needed — it's a plain synthesizable value type), so these
/// exercise the actual mapping logic against the actual error surface.
final class AuthServiceErrorMappingTests: XCTestCase {
    func testMapsInvalidCredentialsErrorCode() {
        let sdkError = AuthError.api(
            message: "Invalid login credentials",
            errorCode: .invalidCredentials,
            underlyingData: Data(),
            underlyingResponse: Self.response(status: 400)
        )
        XCTAssertEqual(AuthServiceError.map(sdkError), .invalidCredentials)
    }

    func testMapsEmailNotConfirmedErrorCode() {
        let sdkError = AuthError.api(
            message: "Email not confirmed",
            errorCode: .emailNotConfirmed,
            underlyingData: Data(),
            underlyingResponse: Self.response(status: 400)
        )
        XCTAssertEqual(AuthServiceError.map(sdkError), .emailNotConfirmed)
    }

    func testMapsEmailExistsErrorCodeToEmailAlreadyInUse() {
        let sdkError = AuthError.api(
            message: "User already registered",
            errorCode: .emailExists,
            underlyingData: Data(),
            underlyingResponse: Self.response(status: 422)
        )
        XCTAssertEqual(AuthServiceError.map(sdkError), .emailAlreadyInUse)
    }

    func testMapsWeakPasswordCaseWithReasons() {
        let sdkError = AuthError.weakPassword(message: "Password too weak", reasons: ["length", "characters"])
        XCTAssertEqual(AuthServiceError.map(sdkError), .weakPassword(reasons: ["length", "characters"]))
    }

    func testMapsUnrecognizedErrorCodeToUnknownWithServerMessage() {
        let sdkError = AuthError.api(
            message: "Something odd happened",
            errorCode: .unexpectedFailure,
            underlyingData: Data(),
            underlyingResponse: Self.response(status: 500)
        )
        XCTAssertEqual(AuthServiceError.map(sdkError), .unknown(message: "Something odd happened"))
    }

    func testMapsURLErrorToNetwork() {
        let urlError = URLError(.notConnectedToInternet)
        XCTAssertEqual(AuthServiceError.map(urlError), .network)
    }

    /// Cancelling the Google sign-in `ASWebAuthenticationSession` sheet surfaces as this system
    /// error, not as a Supabase `AuthError` — it must map to `.cancelled`, not fall through to
    /// `.unknown`, so callers can treat it as a silent no-op.
    func testMapsWebAuthenticationSessionCancelToCancelled() {
        let cancelledError = NSError(
            domain: ASWebAuthenticationSessionErrorDomain,
            code: ASWebAuthenticationSessionError.canceledLogin.rawValue
        )
        XCTAssertEqual(AuthServiceError.map(cancelledError), .cancelled)
    }

    func testAllCasesProvideNonEmptyLocalizedDescription() {
        let cases: [AuthServiceError] = [
            .invalidCredentials,
            .emailNotConfirmed,
            .emailAlreadyInUse,
            .weakPassword(reasons: ["length"]),
            .weakPassword(reasons: []),
            .network,
            .appleSignInFailed,
            .cancelled,
            .unknown(message: "some server message")
        ]
        for authCase in cases {
            XCTAssertFalse((authCase.errorDescription ?? "").isEmpty, "\(authCase) has no description")
        }
    }

    private static func response(status: Int) -> HTTPURLResponse {
        HTTPURLResponse(
            url: URL(string: "https://example.supabase.co/auth/v1/token")!,
            statusCode: status,
            httpVersion: nil,
            headerFields: nil
        )!
    }
}
