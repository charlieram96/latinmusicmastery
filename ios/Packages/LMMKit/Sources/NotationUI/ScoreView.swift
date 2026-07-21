import NotationEngraving
import ScoreModel
import SwiftUI

/// SwiftUI façade over the UIKit ``NotationView`` — loads a track of a `ScoreDocument` in a
/// wrapped or scroll layout. `onSeek` is a placeholder wired in C18 (cursor + click-to-seek);
/// it is carried on the coordinator now so callers can adopt the final signature early.
public struct ScoreView: UIViewRepresentable {
    private let score: ScoreDocument
    private let trackIndex: Int
    private let mode: StaffLayoutMode
    private let onSeek: ((Double) -> Void)?

    public init(
        score: ScoreDocument,
        trackIndex: Int = 0,
        mode: StaffLayoutMode = .wrapped,
        onSeek: ((Double) -> Void)? = nil
    ) {
        self.score = score
        self.trackIndex = trackIndex
        self.mode = mode
        self.onSeek = onSeek
    }

    public func makeCoordinator() -> Coordinator {
        Coordinator(onSeek: onSeek)
    }

    public func makeUIView(context: Context) -> NotationView {
        let view = NotationView()
        context.coordinator.view = view
        view.load(score: score, trackIndex: trackIndex, mode: mode)
        context.coordinator.loaded = Identity(score: score, trackIndex: trackIndex, mode: mode)
        return view
    }

    public func updateUIView(_ uiView: NotationView, context: Context) {
        context.coordinator.onSeek = onSeek
        // Reload only when the content identity changes (cheap value comparison; scores are small).
        if context.coordinator.loaded != Identity(score: score, trackIndex: trackIndex, mode: mode) {
            uiView.load(score: score, trackIndex: trackIndex, mode: mode)
            context.coordinator.loaded = Identity(score: score, trackIndex: trackIndex, mode: mode)
        }
    }

    /// What the coordinator compares to decide whether a reload is needed.
    struct Identity: Equatable {
        let score: ScoreDocument
        let trackIndex: Int
        let mode: StaffLayoutMode
    }

    public final class Coordinator {
        weak var view: NotationView?
        var onSeek: ((Double) -> Void)?
        var loaded: Identity?

        init(onSeek: ((Double) -> Void)?) {
            self.onSeek = onSeek
        }
    }
}
