import Foundation
import LMMModels

/// The single seam every playback URL passes through before it reaches an `AVPlayer`.
///
/// v1 returns the stored `video_url`/`audio_url` verbatim (the `course-videos` bucket is public).
/// When the signed-URL Edge Function lands, only the implementation injected here changes — no
/// player or view code has to move.
public protocol MediaURLResolver: Sendable {
    /// The video URL for an item (the primary media). Throws ``MediaURLError/noVideoURL`` when the
    /// item has none.
    func resolve(_ item: ClassItem) async throws -> URL
    /// The audio URL for an item (used by the EXERCISE / JAM_SESSION audio fallback). Throws
    /// ``MediaURLError/noAudioURL`` when the item has none.
    func resolveAudio(_ item: ClassItem) async throws -> URL
}

public enum MediaURLError: Error, Equatable {
    case noVideoURL
    case noAudioURL
    case malformedURL(String)
}

/// v1 resolver: hands back the stored public URL as-is.
public struct PassthroughMediaURLResolver: MediaURLResolver {
    public init() {}

    public func resolve(_ item: ClassItem) async throws -> URL {
        guard let raw = item.videoUrl, !raw.isEmpty else { throw MediaURLError.noVideoURL }
        guard let url = URL(string: raw) else { throw MediaURLError.malformedURL(raw) }
        return url
    }

    public func resolveAudio(_ item: ClassItem) async throws -> URL {
        guard let raw = item.audioUrl, !raw.isEmpty else { throw MediaURLError.noAudioURL }
        guard let url = URL(string: raw) else { throw MediaURLError.malformedURL(raw) }
        return url
    }
}
