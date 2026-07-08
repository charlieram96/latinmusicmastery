import LMMData
import SwiftUI

/// Placeholder signed-in screen — just enough to prove the session survived and to sign back
/// out. Task A5 replaces this with the real tab shell.
public struct MainPlaceholderView: View {
    @Environment(AuthService.self) private var authService
    @State private var isSigningOut = false

    public init() {}

    public var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "checkmark.seal.fill")
                .font(.system(size: 44))
                .foregroundStyle(.green)

            Text("Signed in")
                .font(.title2.bold())

            if let email = authService.currentUserEmail {
                Text(email)
                    .foregroundStyle(.secondary)
            }

            Button(role: .destructive) {
                signOut()
            } label: {
                if isSigningOut {
                    ProgressView()
                        .frame(maxWidth: .infinity)
                } else {
                    Text("Sign Out")
                        .frame(maxWidth: .infinity)
                }
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
            .disabled(isSigningOut)
            .padding(.top)
        }
        .padding()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(.systemBackground))
    }

    private func signOut() {
        isSigningOut = true
        Task {
            await authService.signOut()
            isSigningOut = false
        }
    }
}
