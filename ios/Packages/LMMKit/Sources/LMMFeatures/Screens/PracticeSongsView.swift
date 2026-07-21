import LMMData
import LMMDesignSystem
import PlaySenseCore
import PlaySenseUI
import SwiftUI

/// D27's light "Practice Songs" surface: a Home-reachable destination listing the published
/// `play_sense_songs` catalog (D23's standalone-song `ExerciseLoader` path). `play_sense_songs` has
/// zero rows in prod today, so the empty state IS the shipped experience for now — a proper
/// `EmptyStateView`, not a bare blank screen, so the destination reads as intentional rather than
/// broken. Tapping a song loads its `ExerciseDefinition` (`ExerciseLoader.exercise(for:)`, the same
/// song path `ExerciseLoader` already builds for D23) and launches the real graded stage
/// (`StagePlayerView`) — the song-catalog counterpart of `PlaySenseExerciseLauncher`, which does the
/// same for a course EXERCISE class item.
struct PracticeSongsView: View {
    @Environment(AppServices.self) private var services
    @State private var state: LoadState<[PlaySenseSong]> = .loading

    var body: some View {
        Group {
            switch state {
            case .loading:
                LoadingView()
            case .failed:
                ErrorView(
                    title: lmmString("error.generic.title"),
                    message: lmmString("error.generic.message"),
                    retryTitle: lmmString("error.retry")
                ) { Task { await load() } }
            case let .loaded(songs):
                content(songs)
            }
        }
        .background(LMMColor.background)
        .navigationTitle(lmmString("playSense.songs.title"))
        .task { await load() }
    }

    @ViewBuilder
    private func content(_ songs: [PlaySenseSong]) -> some View {
        if songs.isEmpty {
            EmptyStateView(
                systemImage: "music.note.list",
                title: lmmString("playSense.songs.empty.title"),
                message: lmmString("playSense.songs.empty.message")
            )
        } else {
            ScrollView {
                VStack(spacing: 0) {
                    ForEach(Array(songs.enumerated()), id: \.element.id) { index, song in
                        NavigationLink { PracticeSongStageLauncher(song: song) } label: {
                            PracticeSongRowContent(song: song)
                        }
                        .buttonStyle(.plain)
                        if index < songs.count - 1 {
                            Divider().overlay(LMMColor.border)
                        }
                    }
                }
                .background(
                    RoundedRectangle(cornerRadius: LMMRadius.md, style: .continuous)
                        .fill(LMMColor.surface)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: LMMRadius.md, style: .continuous)
                        .strokeBorder(LMMColor.border, lineWidth: 1)
                )
                .padding(.horizontal, LMMSpacing.screen)
                .padding(.vertical, LMMSpacing.md)
            }
        }
    }

    private func load() async {
        state = .loading
        do {
            let loader = ExerciseLoader(scoreRepository: services.score, songRepository: services.songs)
            state = .loaded(try await loader.publishedSongs())
        } catch {
            state = .failed
        }
    }
}

/// One song row: a note icon, the title, a difficulty pill (`Badge`'s generic `.style` kind — same
/// visual language a course card's style tag uses), and a chevron. Mirrors `ClassRowContent`'s layout.
private struct PracticeSongRowContent: View {
    let song: PlaySenseSong

    var body: some View {
        HStack(spacing: LMMSpacing.sm) {
            Image(systemName: "music.note")
                .font(.system(size: 20))
                .foregroundStyle(LMMColor.primary)
                .frame(width: 24, height: 24)
            Text(song.title)
                .font(LMMFont.body.weight(.medium))
                .foregroundStyle(LMMColor.foreground)
                .lineLimit(2)
                .multilineTextAlignment(.leading)
            Spacer(minLength: LMMSpacing.xs)
            Badge(.style(difficultyLabel))
            Image(systemName: "chevron.right")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(LMMColor.mutedForeground)
        }
        .padding(.horizontal, LMMSpacing.md)
        .padding(.vertical, LMMSpacing.sm)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(song.title). \(difficultyLabel)")
    }

    private var difficultyLabel: String {
        switch song.difficulty {
        case .beginner: return lmmString("playSense.songs.difficulty.beginner")
        case .intermediate: return lmmString("playSense.songs.difficulty.intermediate")
        case .advanced: return lmmString("playSense.songs.difficulty.advanced")
        }
    }
}

/// Loads the standalone song's `ExerciseDefinition` (D23's `ExerciseLoader.exercise(for:)` song path)
/// and hands it to the real stage once ready.
private struct PracticeSongStageLauncher: View {
    let song: PlaySenseSong
    @Environment(AppServices.self) private var services
    @State private var loaded: LoadState<ExerciseDefinition> = .loading

    var body: some View {
        Group {
            switch loaded {
            case .loading:
                LoadingView()
            case let .loaded(exercise):
                StagePlayerView(exercise: exercise, attemptSink: services.attemptSink)
            case .failed:
                VStack(spacing: LMMSpacing.sm) {
                    Image(systemName: "exclamationmark.triangle")
                        .font(.system(size: 28))
                        .foregroundStyle(LMMColor.destructive)
                    Text(lmmString("playSense.songs.loadError"))
                        .font(LMMFont.subheadline)
                        .foregroundStyle(LMMColor.mutedForeground)
                        .multilineTextAlignment(.center)
                }
                .padding(LMMSpacing.xl)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(LMMColor.background)
            }
        }
        .task { await load() }
    }

    private func load() async {
        do {
            let loader = ExerciseLoader(scoreRepository: services.score, songRepository: services.songs)
            loaded = .loaded(try await loader.exercise(for: song))
        } catch {
            loaded = .failed
        }
    }
}
