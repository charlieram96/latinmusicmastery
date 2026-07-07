import SwiftUI

/// Temporary root screen shown by the app target until real feature flows land in later tasks.
public struct RootPlaceholderView: View {
    public init() {}

    public var body: some View {
        VStack(spacing: 12) {
            Text("Latin Music Mastery")
                .font(.title)
                .bold()
            Text("Coming soon")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .padding()
    }
}
