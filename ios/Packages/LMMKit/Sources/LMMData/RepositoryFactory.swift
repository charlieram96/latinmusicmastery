import PlaySenseCore
import Supabase

/// A bundle of the app's live repositories, all sharing one `ResponseCache` and one
/// `SessionUserProvider`. Built from `SupabaseService` so the feature layer never has to
/// import the Supabase SDK directly.
public struct LiveRepositories: Sendable {
    public let catalog: CatalogRepository
    public let progress: ProgressRepository
    public let entitlements: EntitlementsRepository
    public let quiz: QuizRepository
    public let score: ScoreRepository
    public let cache: ResponseCache
    public let mediaResolver: MediaURLResolver
    /// Plain read/write access to `play_sense_attempts`/`play_sense_attempt_events` (D26).
    public let attempts: AttemptRepository
    /// The injected `SessionCoordinator.attemptSink` — an `OfflineAttemptQueue` wrapping
    /// `attempts` with an on-disk retry queue (D26).
    public let attemptSink: PlaySenseAttemptSink
    /// Reads the published `play_sense_songs` catalog for the D27 "Practice Songs" surface.
    public let songs: PlaySenseSongRepository

    public init(
        catalog: CatalogRepository,
        progress: ProgressRepository,
        entitlements: EntitlementsRepository,
        quiz: QuizRepository,
        score: ScoreRepository,
        cache: ResponseCache,
        mediaResolver: MediaURLResolver = PassthroughMediaURLResolver(),
        attempts: AttemptRepository,
        attemptSink: PlaySenseAttemptSink,
        songs: PlaySenseSongRepository
    ) {
        self.catalog = catalog
        self.progress = progress
        self.entitlements = entitlements
        self.quiz = quiz
        self.score = score
        self.cache = cache
        self.mediaResolver = mediaResolver
        self.attempts = attempts
        self.attemptSink = attemptSink
        self.songs = songs
    }
}

public extension SupabaseService {
    /// Constructs the live repositories wired to this service's shared client.
    func makeLiveRepositories() -> LiveRepositories {
        let cache = ResponseCache()
        let session = SupabaseSessionUserProvider(client: client)
        let attempts = LiveAttemptRepository(client: client, sessionUserProvider: session)
        let attemptQueue = OfflineAttemptQueue(repository: attempts, store: FileAttemptQueueStore())
        return LiveRepositories(
            catalog: LiveCatalogRepository(client: client, sessionUserProvider: session, cache: cache),
            progress: LiveProgressRepository(client: client, sessionUserProvider: session, cache: cache),
            entitlements: LiveEntitlementsRepository(client: client, sessionUserProvider: session),
            quiz: LiveQuizRepository(client: client, cache: cache),
            score: LiveScoreRepository(client: client, cache: cache),
            cache: cache,
            mediaResolver: PassthroughMediaURLResolver(),
            attempts: attempts,
            attemptSink: attemptQueue,
            songs: LivePlaySenseSongRepository(client: client, cache: cache)
        )
    }
}
