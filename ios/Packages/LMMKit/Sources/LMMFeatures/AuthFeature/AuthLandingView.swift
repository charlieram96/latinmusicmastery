import AuthenticationServices
import LMMData
import SwiftUI

/// Signed-out landing screen: wordmark, the three sign-in entry points, and a link to create an
/// account. Google/Apple sign-in aren't configured on the Supabase dashboard yet (external,
/// tracked separately) — failures surface as a plain error message here, never a crash.
public struct AuthLandingView: View {
    @Environment(AuthService.self) private var authService
    @Environment(\.colorScheme) private var colorScheme

    @State private var currentAppleNonce: String?
    @State private var errorMessage: String?
    @State private var isSigningInWithGoogle = false
    @State private var showSignIn = false
    @State private var showSignUp = false

    public init() {}

    public var body: some View {
        VStack(spacing: 24) {
            Spacer()

            VStack(spacing: 8) {
                Text("Latin Music Mastery")
                    .font(.largeTitle.bold())
                    .multilineTextAlignment(.center)
                Text("Learn to play. Feel the clave.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            VStack(spacing: 12) {
                SignInWithAppleButton(.continue) { request in
                    errorMessage = nil
                    let nonce = AppleNonceGenerator.randomNonceString()
                    currentAppleNonce = nonce
                    request.requestedScopes = [.fullName, .email]
                    request.nonce = AppleNonceGenerator.sha256(nonce)
                } onCompletion: { result in
                    handleAppleCompletion(result)
                }
                .signInWithAppleButtonStyle(colorScheme == .dark ? .white : .black)
                .frame(height: 50)

                Button {
                    signInWithGoogle()
                } label: {
                    HStack {
                        if isSigningInWithGoogle {
                            ProgressView()
                        } else {
                            Text("Continue with Google")
                        }
                    }
                    .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
                .controlSize(.large)
                .disabled(isSigningInWithGoogle)

                Button {
                    errorMessage = nil
                    showSignIn = true
                } label: {
                    Text("Sign in with email")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
            }
            .padding(.horizontal)

            if let errorMessage {
                Text(errorMessage)
                    .font(.footnote)
                    .foregroundStyle(.red)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal)
            }

            Button {
                showSignUp = true
            } label: {
                (Text("Don't have an account? ").foregroundStyle(.secondary)
                    + Text("Create account").foregroundStyle(Color.accentColor).bold())
            }
            .padding(.bottom)
        }
        .padding()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(.systemBackground))
        .sheet(isPresented: $showSignIn) {
            SignInView()
        }
        .sheet(isPresented: $showSignUp) {
            SignUpView()
        }
    }

    private func handleAppleCompletion(_ result: Result<ASAuthorization, Error>) {
        switch result {
        case .success(let authorization):
            guard
                let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
                let nonce = currentAppleNonce
            else {
                errorMessage = AuthServiceError.appleSignInFailed.errorDescription
                return
            }
            Task {
                do {
                    try await authService.signInWithApple(credential: credential, nonce: nonce)
                    errorMessage = nil
                } catch {
                    errorMessage = message(for: error)
                }
            }
        case .failure(let error):
            if let authorizationError = error as? ASAuthorizationError, authorizationError.code == .canceled {
                return
            }
            errorMessage = AuthServiceError.appleSignInFailed.errorDescription
        }
    }

    private func signInWithGoogle() {
        errorMessage = nil
        isSigningInWithGoogle = true
        Task {
            defer { isSigningInWithGoogle = false }
            do {
                try await authService.signInWithGoogle()
                errorMessage = nil
            } catch AuthServiceError.cancelled {
                // The user dismissed the sheet themselves — same silent UX as an Apple-cancel.
                return
            } catch {
                errorMessage = message(for: error)
            }
        }
    }

    private func message(for error: Error) -> String {
        (error as? AuthServiceError)?.errorDescription ?? error.localizedDescription
    }
}
