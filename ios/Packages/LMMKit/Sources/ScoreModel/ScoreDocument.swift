import Foundation

/// Port of `ScoreDocument` (`components/playsense-studio/shared/score-model/types.ts`) —
/// the normalized internal representation every renderer, player, and editor in PlaySense
/// Studio treats as the source of truth. A thin subset of MusicXML's information model:
/// just enough to render staff/tab/fretboard/percussion and round-trip the features Latin
/// music courses actually use.
public struct ScoreDocument: Equatable, Hashable, Sendable {
    /// The only schema version this app understands. Any other value is a hard decode
    /// failure raised from ``init(from:)`` — mirrors `serialization.ts`'s forward-only
    /// migration gate, which as of schema v1 has nothing to migrate from.
    public static let supportedSchemaVersion = 1

    public var schemaVersion: Int
    public var title: String
    public var composer: String?
    public var sourceFormat: SourceFormat
    /// Initial tempo in BPM (quarter-note BPM). Tempo changes live in `measures[].tempoChange`.
    public var initialTempo: Double
    public var initialTimeSignature: TimeSignature
    /// Concert key signature, MusicXML "fifths" (-7..+7; negative = flats, positive = sharps).
    public var initialKeyFifths: Int
    public var tracks: [Track]

    public init(
        title: String,
        composer: String? = nil,
        sourceFormat: SourceFormat,
        initialTempo: Double,
        initialTimeSignature: TimeSignature,
        initialKeyFifths: Int,
        tracks: [Track]
    ) {
        self.schemaVersion = Self.supportedSchemaVersion
        self.title = title
        self.composer = composer
        self.sourceFormat = sourceFormat
        self.initialTempo = initialTempo
        self.initialTimeSignature = initialTimeSignature
        self.initialKeyFifths = initialKeyFifths
        self.tracks = tracks
    }
}

extension ScoreDocument: Codable {
    private enum CodingKeys: String, CodingKey {
        case schemaVersion
        case title
        case composer
        case sourceFormat
        case initialTempo
        case initialTimeSignature
        case initialKeyFifths
        case tracks
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)

        // Check schemaVersion FIRST and hard-fail before decoding anything else — an
        // unrecognized version means the rest of the shape may not even match this app's
        // model, so there is nothing useful to report except "update the app".
        let schemaVersion = try container.decode(Int.self, forKey: .schemaVersion)
        guard schemaVersion == Self.supportedSchemaVersion else {
            throw ScoreDocumentValidationError(
                path: ["schemaVersion"],
                message: "Unknown schemaVersion: \(schemaVersion)"
            )
        }

        self.schemaVersion = schemaVersion
        title = try container.decode(String.self, forKey: .title)
        composer = try container.decodeIfPresent(String.self, forKey: .composer)
        sourceFormat = try container.decode(SourceFormat.self, forKey: .sourceFormat)
        initialTempo = try container.decode(Double.self, forKey: .initialTempo)
        initialTimeSignature = try container.decode(TimeSignature.self, forKey: .initialTimeSignature)
        initialKeyFifths = try container.decode(Int.self, forKey: .initialKeyFifths)
        tracks = try container.decode([Track].self, forKey: .tracks)
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(schemaVersion, forKey: .schemaVersion)
        try container.encode(title, forKey: .title)
        try container.encodeIfPresent(composer, forKey: .composer)
        try container.encode(sourceFormat, forKey: .sourceFormat)
        try container.encode(initialTempo, forKey: .initialTempo)
        try container.encode(initialTimeSignature, forKey: .initialTimeSignature)
        try container.encode(initialKeyFifths, forKey: .initialKeyFifths)
        try container.encode(tracks, forKey: .tracks)
    }
}
