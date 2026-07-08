#if DEBUG
import LMMData
import LMMDesignSystem
import LMMModels
import PlaySenseCore
import PlaySenseUI
import SwiftUI

/// DEBUG-only bridge from a course EXERCISE class item to the PlaySense stage: resolves the item's
/// `score_document_id` through the ``ScoreRepository`` (D18 read path), runs `scoreToExerciseDefinition`,
/// and hands the resulting ``ExerciseDefinition`` to ``StagePlayerView`` (D24's SpriteKit highway).
/// Gated behind `#if DEBUG` — the full release swap of the "coming soon" card lands with persistence (D26).
struct PlaySenseExerciseLauncher: View {
    let item: ClassItem
    @Environment(AppServices.self) private var services
    @State private var loaded: LoadState<ExerciseDefinition> = .idle

    enum LoadState<T> {
        case idle
        case loading
        case loaded(T)
        case failed(String)
    }

    var body: some View {
        Group {
            switch loaded {
            case .idle, .loading:
                ProgressView().frame(maxWidth: .infinity).padding(LMMSpacing.xl)
            case let .loaded(exercise):
                StagePlayerView(exercise: exercise)
            case let .failed(message):
                VStack(spacing: LMMSpacing.sm) {
                    Image(systemName: "exclamationmark.triangle")
                        .font(.system(size: 28))
                        .foregroundStyle(LMMColor.destructive)
                    Text(message)
                        .font(LMMFont.subheadline)
                        .foregroundStyle(LMMColor.mutedForeground)
                        .multilineTextAlignment(.center)
                }
                .padding(LMMSpacing.xl)
            }
        }
        .task(id: item.id) { await load() }
    }

    private func load() async {
        guard let scoreDocumentId = item.scoreDocumentId else {
            loaded = .failed("This exercise has no attached score.")
            return
        }
        loaded = .loading
        do {
            let loader = ExerciseLoader(scoreRepository: services.score)
            let exercise = try await loader.exercise(
                scoreDocumentId: scoreDocumentId,
                difficulty: .intermediate,
                audioUrl: item.audioUrl,
                id: item.id.uuidString,
                title: item.title
            )
            loaded = .loaded(exercise)
        } catch {
            loaded = .failed("Couldn't load exercise: \(error.localizedDescription)")
        }
    }
}
#endif
