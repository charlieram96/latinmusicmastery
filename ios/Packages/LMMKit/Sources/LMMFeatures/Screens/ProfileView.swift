import LMMData
import LMMDesignSystem
import SwiftUI

/// The Profile tab: identity, a couple of placeholder rows, and sign-out.
struct ProfileView: View {
    @Environment(AuthService.self) private var auth

    @State private var fullName: String?
    @State private var email: String?
    @State private var isSigningOut = false

    var body: some View {
        ScrollView {
            VStack(spacing: LMMSpacing.lg) {
                identity
                rows
                signOutButton
            }
            .padding(.horizontal, LMMSpacing.screen)
            .padding(.vertical, LMMSpacing.md)
        }
        .background(LMMColor.background)
        .navigationTitle(lmmString("profile.title"))
        .task { await loadProfile() }
    }

    private var identity: some View {
        VStack(spacing: LMMSpacing.sm) {
            ZStack {
                Circle().fill(LMMColor.warmGradient)
                Text(initials)
                    .font(LMMFont.title.weight(.heavy))
                    .foregroundStyle(LMMColor.onPrimary)
            }
            .frame(width: 88, height: 88)

            VStack(spacing: LMMSpacing.xxs) {
                if let fullName, !fullName.isEmpty {
                    Text(fullName)
                        .font(LMMFont.title2)
                        .foregroundStyle(LMMColor.foreground)
                }
                if let email {
                    Text(email)
                        .font(LMMFont.subheadline)
                        .foregroundStyle(LMMColor.mutedForeground)
                }
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.top, LMMSpacing.md)
    }

    private var rows: some View {
        VStack(spacing: 0) {
            row(icon: "gearshape.fill", title: lmmString("profile.settings"))
            Divider().overlay(LMMColor.border)
            row(icon: "questionmark.circle.fill", title: lmmString("profile.help"))
        }
        .background(
            RoundedRectangle(cornerRadius: LMMRadius.md, style: .continuous)
                .fill(LMMColor.surface)
        )
        .overlay(
            RoundedRectangle(cornerRadius: LMMRadius.md, style: .continuous)
                .strokeBorder(LMMColor.border, lineWidth: 1)
        )
    }

    private func row(icon: String, title: String) -> some View {
        HStack(spacing: LMMSpacing.sm) {
            Image(systemName: icon)
                .font(.system(size: 16))
                .foregroundStyle(LMMColor.primary)
                .frame(width: 24)
            Text(title)
                .font(LMMFont.body)
                .foregroundStyle(LMMColor.foreground)
            Spacer()
            Text(lmmString("common.comingSoon"))
                .font(LMMFont.caption)
                .foregroundStyle(LMMColor.mutedForeground)
        }
        .padding(.horizontal, LMMSpacing.md)
        .padding(.vertical, LMMSpacing.sm)
    }

    private var signOutButton: some View {
        Button {
            signOut()
        } label: {
            if isSigningOut {
                ProgressView().frame(maxWidth: .infinity)
            } else {
                Text(lmmString("profile.signOut"))
                    .foregroundStyle(LMMColor.destructive)
            }
        }
        .buttonStyle(.lmmSecondary)
        .disabled(isSigningOut)
    }

    private var initials: String {
        let source = (fullName?.isEmpty == false ? fullName : email) ?? "?"
        let letters = source.split(separator: " ").prefix(2).compactMap { $0.first }
        let joined = String(letters).uppercased()
        return joined.isEmpty ? "?" : joined
    }

    private func loadProfile() async {
        email = auth.currentUserEmail
        let profile = try? await auth.currentProfile()
        fullName = profile?.fullName
        if email == nil { email = profile?.email }
    }

    private func signOut() {
        isSigningOut = true
        Task {
            await auth.signOut()
            isSigningOut = false
        }
    }
}
