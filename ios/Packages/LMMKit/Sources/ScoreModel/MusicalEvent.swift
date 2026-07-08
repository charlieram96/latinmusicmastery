import Foundation

/// Port of `NoteBase['articulation']`.
public enum ArticulationType: String, Codable, Equatable, Hashable, Sendable, CaseIterable {
    case staccato
    case accent
    case tenuto
}

/// Port of the inline `fingering` shape on `Note` and `Chord['notes'][number]`.
public struct Fingering: Codable, Equatable, Hashable, Sendable {
    /// 1-based string index, low to high.
    public var string: Int
    /// Fret number; 0 = open string.
    public var fret: Int
    public var finger: Int?

    public init(string: Int, fret: Int, finger: Int? = nil) {
        self.string = string
        self.fret = fret
        self.finger = finger
    }
}

/// Port of one entry of `Chord['notes']`.
public struct ChordNote: Codable, Equatable, Hashable, Sendable {
    public var midi: Int
    public var spellingHint: String?
    public var fingering: Fingering?
    public var tieToNext: Bool?

    public init(midi: Int, spellingHint: String? = nil, fingering: Fingering? = nil, tieToNext: Bool? = nil) {
        self.midi = midi
        self.spellingHint = spellingHint
        self.fingering = fingering
        self.tieToNext = tieToNext
    }
}

/// Port of `Note` (`NoteBase` flattened in, matching the TS `interface Note extends NoteBase`).
public struct Note: Equatable, Hashable, Sendable {
    public var durationQN: Double
    public var dotted: Bool?
    public var triplet: Bool?
    public var tieToNext: Bool?
    public var slurToNext: Bool?
    public var articulation: ArticulationType?
    public var midi: Int
    public var spellingHint: String?
    public var fingering: Fingering?

    public init(
        durationQN: Double,
        dotted: Bool? = nil,
        triplet: Bool? = nil,
        tieToNext: Bool? = nil,
        slurToNext: Bool? = nil,
        articulation: ArticulationType? = nil,
        midi: Int,
        spellingHint: String? = nil,
        fingering: Fingering? = nil
    ) {
        self.durationQN = durationQN
        self.dotted = dotted
        self.triplet = triplet
        self.tieToNext = tieToNext
        self.slurToNext = slurToNext
        self.articulation = articulation
        self.midi = midi
        self.spellingHint = spellingHint
        self.fingering = fingering
    }
}

/// Port of `Rest` (`NoteBase` flattened in).
public struct Rest: Equatable, Hashable, Sendable {
    public var durationQN: Double
    public var dotted: Bool?
    public var triplet: Bool?
    public var tieToNext: Bool?
    public var slurToNext: Bool?
    public var articulation: ArticulationType?

    public init(
        durationQN: Double,
        dotted: Bool? = nil,
        triplet: Bool? = nil,
        tieToNext: Bool? = nil,
        slurToNext: Bool? = nil,
        articulation: ArticulationType? = nil
    ) {
        self.durationQN = durationQN
        self.dotted = dotted
        self.triplet = triplet
        self.tieToNext = tieToNext
        self.slurToNext = slurToNext
        self.articulation = articulation
    }
}

/// Port of `Chord` (`NoteBase` flattened in).
public struct Chord: Equatable, Hashable, Sendable {
    public var durationQN: Double
    public var dotted: Bool?
    public var triplet: Bool?
    public var tieToNext: Bool?
    public var slurToNext: Bool?
    public var articulation: ArticulationType?
    public var notes: [ChordNote]

    public init(
        durationQN: Double,
        dotted: Bool? = nil,
        triplet: Bool? = nil,
        tieToNext: Bool? = nil,
        slurToNext: Bool? = nil,
        articulation: ArticulationType? = nil,
        notes: [ChordNote]
    ) {
        self.durationQN = durationQN
        self.dotted = dotted
        self.triplet = triplet
        self.tieToNext = tieToNext
        self.slurToNext = slurToNext
        self.articulation = articulation
        self.notes = notes
    }
}

/// Port of `MusicalEvent = Note | Rest | Chord`, discriminated on the `kind` field exactly
/// as the TS union is (`'note' | 'rest' | 'chord'`). Unlike a nested-payload Swift enum, the
/// wire shape keeps every field flat on one JSON object (`{"kind":"note","durationQN":1,...}`),
/// so encode/decode are hand-written against a single shared `CodingKeys` rather than
/// synthesized — see ``MusicalEvent/init(from:)`` / ``MusicalEvent/encode(to:)``.
public enum MusicalEvent: Equatable, Hashable, Sendable {
    case note(Note)
    case rest(Rest)
    case chord(Chord)

    /// Discriminator mirroring `MusicalEvent['kind']`.
    public enum Kind: String, Codable, Equatable, Hashable, Sendable {
        case note
        case rest
        case chord
    }

    public var kind: Kind {
        switch self {
        case .note: return .note
        case .rest: return .rest
        case .chord: return .chord
        }
    }

    /// The shared `NoteBase.durationQN` — present on every event kind, so layout code
    /// (measure occupancy, score-time math) never needs to switch on `kind` just to read it.
    public var durationQN: Double {
        switch self {
        case .note(let note): return note.durationQN
        case .rest(let rest): return rest.durationQN
        case .chord(let chord): return chord.durationQN
        }
    }

    public var dotted: Bool? {
        switch self {
        case .note(let note): return note.dotted
        case .rest(let rest): return rest.dotted
        case .chord(let chord): return chord.dotted
        }
    }

    public var triplet: Bool? {
        switch self {
        case .note(let note): return note.triplet
        case .rest(let rest): return rest.triplet
        case .chord(let chord): return chord.triplet
        }
    }

    public var tieToNext: Bool? {
        switch self {
        case .note(let note): return note.tieToNext
        case .rest(let rest): return rest.tieToNext
        case .chord(let chord): return chord.tieToNext
        }
    }

    public var slurToNext: Bool? {
        switch self {
        case .note(let note): return note.slurToNext
        case .rest(let rest): return rest.slurToNext
        case .chord(let chord): return chord.slurToNext
        }
    }

    public var articulation: ArticulationType? {
        switch self {
        case .note(let note): return note.articulation
        case .rest(let rest): return rest.articulation
        case .chord(let chord): return chord.articulation
        }
    }
}

extension MusicalEvent: Codable {
    private enum CodingKeys: String, CodingKey {
        case kind
        case durationQN
        case dotted
        case triplet
        case tieToNext
        case slurToNext
        case articulation
        case midi
        case spellingHint
        case fingering
        case notes
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let kind = try container.decode(Kind.self, forKey: .kind)
        let durationQN = try container.decode(Double.self, forKey: .durationQN)
        let dotted = try container.decodeIfPresent(Bool.self, forKey: .dotted)
        let triplet = try container.decodeIfPresent(Bool.self, forKey: .triplet)
        let tieToNext = try container.decodeIfPresent(Bool.self, forKey: .tieToNext)
        let slurToNext = try container.decodeIfPresent(Bool.self, forKey: .slurToNext)
        let articulation = try container.decodeIfPresent(ArticulationType.self, forKey: .articulation)

        switch kind {
        case .note:
            let midi = try container.decode(Int.self, forKey: .midi)
            let spellingHint = try container.decodeIfPresent(String.self, forKey: .spellingHint)
            let fingering = try container.decodeIfPresent(Fingering.self, forKey: .fingering)
            self = .note(Note(
                durationQN: durationQN,
                dotted: dotted,
                triplet: triplet,
                tieToNext: tieToNext,
                slurToNext: slurToNext,
                articulation: articulation,
                midi: midi,
                spellingHint: spellingHint,
                fingering: fingering
            ))
        case .rest:
            self = .rest(Rest(
                durationQN: durationQN,
                dotted: dotted,
                triplet: triplet,
                tieToNext: tieToNext,
                slurToNext: slurToNext,
                articulation: articulation
            ))
        case .chord:
            let notes = try container.decode([ChordNote].self, forKey: .notes)
            self = .chord(Chord(
                durationQN: durationQN,
                dotted: dotted,
                triplet: triplet,
                tieToNext: tieToNext,
                slurToNext: slurToNext,
                articulation: articulation,
                notes: notes
            ))
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(kind, forKey: .kind)
        try container.encode(durationQN, forKey: .durationQN)
        try container.encodeIfPresent(dotted, forKey: .dotted)
        try container.encodeIfPresent(triplet, forKey: .triplet)
        try container.encodeIfPresent(tieToNext, forKey: .tieToNext)
        try container.encodeIfPresent(slurToNext, forKey: .slurToNext)
        try container.encodeIfPresent(articulation, forKey: .articulation)

        switch self {
        case .note(let note):
            try container.encode(note.midi, forKey: .midi)
            try container.encodeIfPresent(note.spellingHint, forKey: .spellingHint)
            try container.encodeIfPresent(note.fingering, forKey: .fingering)
        case .rest:
            break
        case .chord(let chord):
            try container.encode(chord.notes, forKey: .notes)
        }
    }
}
