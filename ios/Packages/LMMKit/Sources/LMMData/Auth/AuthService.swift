import AuthenticationServices
import Foundation
import LMMModels
import Observation
import Supabase

/// Thin, observable facade over `SupabaseClient.auth`.
///
/// `state` is driven entirely by `authStateChanges` (observed once, for the app's whole
/// lifetime), so every sign-in path — password, Google OAuth, Sign in with Apple — converges on
/// the same source of truth. Call sites never set `state` themselves; they just call a method
/// and either it throws a typed `AuthServiceError` or the state stream eventually reflects the
/// new session.
@Observable
@MainActor
public final class AuthService {
    /// Registered in `project.yml`'s `CFBundleURLTypes`, and (once the controller configures the
    /// Supabase dashboard) in the project's allowed redirect URLs.
    public static let oauthRedirectURL = URL(string: "lmm://auth-callback")!

    public private(set) var state: AuthState = .loading

    private let client: SupabaseClient
    // `Task.cancel()` is safe to call from any thread, so this can be read from `deinit`, which
    // (unlike the rest of this `@MainActor` class) runs nonisolated. `@ObservationIgnored`
    // because `@Observable`'s tracked-storage transform can't be combined with `nonisolated`.
    @ObservationIgnored
    private nonisolated(unsafe) var authStateTask: Task<Void, Never>?

    public init(client: SupabaseClient) {
        self.client = client
        observeAuthState()
    }

    deinit {
        authStateTask?.cancel()
    }

    /// The signed-in user's email, for display only — may be stale immediately after a fresh
    /// sign-in. Re-fetch via ``currentProfile()`` for anything that must be current.
    public var currentUserEmail: String? {
        client.auth.currentUser?.email
    }

    public func signIn(email: String, password: String) async throws {
        do {
            try await client.auth.signIn(email: email, password: password)
        } catch {
            throw AuthServiceError.map(error)
        }
    }

    /// Mirrors the web's `app/actions/auth.ts` `signup`: `fullName` lands in the same
    /// `full_name` user-metadata key the `profiles` trigger reads.
    public func signUp(email: String, password: String, fullName: String) async throws {
        do {
            try await client.auth.signUp(
                email: email,
                password: password,
                data: ["full_name": .string(fullName)]
            )
        } catch {
            throw AuthServiceError.map(error)
        }
    }

    /// Google sign-in via `ASWebAuthenticationSession` (supabase-swift drives the browser sheet).
    /// The Supabase dashboard's redirect-URL allowlist isn't configured yet (external, tracked
    /// separately), so this throws a clean `AuthServiceError` until then — it never crashes.
    public func signInWithGoogle() async throws {
        do {
            try await client.auth.signInWithOAuth(
                provider: .google,
                redirectTo: Self.oauthRedirectURL
            )
        } catch {
            throw AuthServiceError.map(error)
        }
    }

    /// Apple's provider isn't enabled in the Supabase dashboard yet (external, tracked
    /// separately), so this throws a clean `AuthServiceError` until then — it never crashes.
    public func signInWithApple(
        credential: ASAuthorizationAppleIDCredential,
        nonce: String
    ) async throws {
        guard
            let tokenData = credential.identityToken,
            let idToken = String(data: tokenData, encoding: .utf8)
        else {
            throw AuthServiceError.appleSignInFailed
        }

        do {
            try await client.auth.signInWithIdToken(
                credentials: .init(provider: .apple, idToken: idToken, nonce: nonce)
            )
        } catch {
            throw AuthServiceError.map(error)
        }
    }

    public func signOut() async {
        try? await client.auth.signOut()
    }

    /// Completes an OAuth (Google) redirect from `onOpenURL`. This is a secondary, defensive
    /// route: the primary resolution is the awaited `signInWithOAuth` call inside
    /// `signInWithGoogle()`, which already surfaces failures to its caller as a typed
    /// `AuthServiceError`. By the time this redirect reaches `onOpenURL`, that call has
    /// generally already resolved (successfully or not), so `session(from:)` failing here isn't
    /// a distinct failure mode worth surfacing again — it's swallowed with `try?` after the SDK
    /// logs it, and the user simply stays wherever `state` already has them, since a failed
    /// exchange never produces a session.
    public func handle(url: URL) {
        Task {
            try? await client.auth.session(from: url)
        }
    }

    /// Fetches the `profiles` row for the current session's user. Tolerates the row not
    /// existing yet — the trigger that creates it can lag slightly behind a first OAuth
    /// login — by retrying once after a short delay, and returns `nil` (never throws) if it's
    /// still missing after that.
    public func currentProfile() async throws -> Profile? {
        guard case .signedIn(let userId) = state else { return nil }

        if let profile = try await fetchProfile(userId: userId) {
            return profile
        }

        try? await Task.sleep(nanoseconds: 500_000_000)
        return try await fetchProfile(userId: userId)
    }

    private func fetchProfile(userId: UUID) async throws -> Profile? {
        let profiles: [Profile] = try await client
            .from("profiles")
            .select()
            .eq("id", value: userId)
            .limit(1)
            .execute()
            .value
        return profiles.first
    }

    private func observeAuthState() {
        authStateTask = Task { [weak self, client] in
            for await (_, session) in client.auth.authStateChanges {
                guard let self else { return }
                if let session {
                    self.state = .signedIn(userId: session.user.id)
                } else {
                    self.state = .signedOut
                }
            }
        }
    }
}
