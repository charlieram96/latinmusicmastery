import LMMData
import SwiftUI

/// Full name + email + password + confirm, with basic client-side validation and a
/// "check your email" state once `signUp` succeeds (Supabase requires email confirmation by
/// default, mirroring the web's `app/actions/auth.ts`).
public struct SignUpView: View {
    @Environment(AuthService.self) private var authService
    @Environment(\.dismiss) private var dismiss

    @State private var fullName = ""
    @State private var email = ""
    @State private var password = ""
    @State private var confirmPassword = ""
    @State private var errorMessage: String?
    @State private var isSigningUp = false
    @State private var didSignUp = false

    public init() {}

    public var body: some View {
        NavigationStack {
            if didSignUp {
                confirmationView
            } else {
                form
            }
        }
    }

    private var form: some View {
        Form {
            Section {
                TextField("Full name", text: $fullName)
                    .textContentType(.name)
                TextField("Email", text: $email)
                    .textContentType(.username)
                    .keyboardType(.emailAddress)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                SecureField("Password", text: $password)
                    .textContentType(.newPassword)
                SecureField("Confirm password", text: $confirmPassword)
                    .textContentType(.newPassword)
            }

            if let validationMessage {
                Section {
                    Text(validationMessage)
                        .foregroundStyle(.red)
                }
            }

            Section {
                Button {
                    signUp()
                } label: {
                    if isSigningUp {
                        ProgressView().frame(maxWidth: .infinity)
                    } else {
                        Text("Create Account").frame(maxWidth: .infinity)
                    }
                }
                .disabled(!canSubmit || isSigningUp)
            }
        }
        .navigationTitle("Create Account")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Cancel") { dismiss() }
            }
        }
    }

    private var confirmationView: some View {
        VStack(spacing: 16) {
            Image(systemName: "envelope.badge.fill")
                .font(.system(size: 48))
                .foregroundStyle(Color.accentColor)
            Text("Check your email")
                .font(.title2.bold())
            Text("We sent a confirmation link to \(email). Confirm it, then sign in.")
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
            Button("Done") { dismiss() }
                .buttonStyle(.borderedProminent)
        }
        .padding()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var canSubmit: Bool {
        !fullName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && !email.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && password.count >= 6
            && password == confirmPassword
    }

    private var validationMessage: String? {
        if let errorMessage { return errorMessage }
        if !password.isEmpty, password.count < 6 {
            return "Password must be at least 6 characters."
        }
        if !confirmPassword.isEmpty, password != confirmPassword {
            return "Passwords don't match."
        }
        return nil
    }

    private func signUp() {
        isSigningUp = true
        errorMessage = nil
        Task {
            defer { isSigningUp = false }
            do {
                try await authService.signUp(email: email, password: password, fullName: fullName)
                didSignUp = true
            } catch {
                errorMessage = (error as? AuthServiceError)?.errorDescription ?? error.localizedDescription
            }
        }
    }
}
