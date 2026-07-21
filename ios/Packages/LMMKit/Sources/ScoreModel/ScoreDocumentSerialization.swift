import Foundation

/// Port of `parseScoreDocument` / `serializeScoreDocument` (`serialization.ts`).
///
/// Structural shape (JSON types, the `note`/`rest`/`chord` discriminator, closed enum
/// values) is already enforced by `Decodable` synthesis / ``ScoreDocument/init(from:)`` —
/// a violation there throws the underlying `DecodingError` directly, same as it would
/// abort a Zod `safeParse` before it ever collects issues. What Swift's type system can't
/// express is Zod's extra numeric/array-shape refinements (`.positive()`, `.min()`,
/// MIDI's `0...127` range, etc.) — those are checked here, after a successful decode, and
/// aggregated into a single ``ScoreDocumentValidationError`` exactly like `safeParse` does.
extension ScoreDocument {
    /// Decode + validate `data` as a `ScoreDocument`. Throws ``ScoreDocumentValidationError``
    /// for an unsupported `schemaVersion` or any semantic-range violation; throws the plain
    /// `DecodingError` for any other structural malformation.
    public static func parse(_ data: Data, decoder: JSONDecoder = JSONDecoder()) throws -> ScoreDocument {
        let document = try decoder.decode(ScoreDocument.self, from: data)
        let issues = document.validationIssues()
        if !issues.isEmpty {
            throw ScoreDocumentValidationError(issues: issues)
        }
        return document
    }

    /// Serialize back to JSON-safe `Data`. Round-tripping through `Codable` is already the
    /// single JSON-safe boundary, so — unlike the TS version's `JSON.parse(JSON.stringify(...))`
    /// no-op-by-round-trip — this is just `JSONEncoder.encode`.
    public func serialized(encoder: JSONEncoder = JSONEncoder()) throws -> Data {
        try encoder.encode(self)
    }

    /// Every semantic (non-structural) violation of the `serialization.ts` Zod schema.
    /// Empty means valid. See the file-level doc comment for what's deliberately *not*
    /// checked here (structural shape) and the ``Track`` doc comment for the deliberate
    /// `stringMultiplicity` leniency. One helper per tree level, mirroring the document's
    /// own nesting (document -> track -> measure -> voice -> event).
    func validationIssues() -> [ScoreDocumentValidationError.Issue] {
        var issues: [ScoreDocumentValidationError.Issue] = []

        checking(&issues, !title.isEmpty, ["title"], "title must not be empty")
        checking(&issues, initialTempo > 0, ["initialTempo"], "initialTempo must be positive")
        checking(
            &issues,
            (-7...7).contains(initialKeyFifths),
            ["initialKeyFifths"],
            "initialKeyFifths must be within -7...7"
        )
        checking(
            &issues,
            initialTimeSignature.numerator > 0 && initialTimeSignature.denominator > 0,
            ["initialTimeSignature"],
            "initialTimeSignature must have a positive numerator and denominator"
        )
        checking(&issues, !tracks.isEmpty, ["tracks"], "tracks must not be empty")

        for (trackIndex, track) in tracks.enumerated() {
            issues.append(contentsOf: track.validationIssues(at: ["tracks", "\(trackIndex)"]))
        }

        return issues
    }
}

extension Track {
    fileprivate func validationIssues(at trackPath: [String]) -> [ScoreDocumentValidationError.Issue] {
        var issues: [ScoreDocumentValidationError.Issue] = []

        checking(&issues, index >= 0, trackPath + ["index"], "index must be >= 0")
        checking(&issues, !displayName.isEmpty, trackPath + ["displayName"], "displayName must not be empty")
        if let channel {
            checking(&issues, (0...15).contains(channel), trackPath + ["channel"], "channel must be within 0...15")
        }

        for (measureIndex, measure) in measures.enumerated() {
            issues.append(contentsOf: measure.validationIssues(at: trackPath + ["measures", "\(measureIndex)"]))
        }

        return issues
    }
}

extension Measure {
    fileprivate func validationIssues(at measurePath: [String]) -> [ScoreDocumentValidationError.Issue] {
        var issues: [ScoreDocumentValidationError.Issue] = []

        checking(&issues, number > 0, measurePath + ["number"], "number must be positive")
        if let timeSignature {
            checking(
                &issues,
                timeSignature.numerator > 0 && timeSignature.denominator > 0,
                measurePath + ["timeSignature"],
                "timeSignature must have a positive numerator and denominator"
            )
        }
        if let tempoChange {
            checking(&issues, tempoChange > 0, measurePath + ["tempoChange"], "tempoChange must be positive")
        }
        if let keyFifths {
            checking(
                &issues, (-7...7).contains(keyFifths), measurePath + ["keyFifths"], "keyFifths must be within -7...7"
            )
        }
        checking(&issues, !voices.isEmpty, measurePath + ["voices"], "voices must not be empty")

        for (voiceIndex, voice) in voices.enumerated() {
            issues.append(contentsOf: voice.validationIssues(at: measurePath + ["voices", "\(voiceIndex)"]))
        }

        return issues
    }
}

extension Voice {
    fileprivate func validationIssues(at voicePath: [String]) -> [ScoreDocumentValidationError.Issue] {
        var issues: [ScoreDocumentValidationError.Issue] = []

        checking(&issues, number > 0, voicePath + ["number"], "number must be positive")

        for (eventIndex, event) in events.enumerated() {
            issues.append(contentsOf: event.validationIssues(at: voicePath + ["events", "\(eventIndex)"]))
        }

        return issues
    }
}

extension MusicalEvent {
    fileprivate func validationIssues(at eventPath: [String]) -> [ScoreDocumentValidationError.Issue] {
        var issues: [ScoreDocumentValidationError.Issue] = []
        checking(&issues, durationQN > 0, eventPath + ["durationQN"], "durationQN must be positive")

        switch self {
        case .note(let note):
            checking(&issues, (0...127).contains(note.midi), eventPath + ["midi"], "midi must be within 0...127")
            if let fingering = note.fingering {
                issues.append(contentsOf: fingeringIssues(fingering, at: eventPath + ["fingering"]))
            }
        case .rest:
            break
        case .chord(let chord):
            checking(&issues, chord.notes.count >= 2, eventPath + ["notes"], "chord must have at least 2 notes")
            for (noteIndex, chordNote) in chord.notes.enumerated() {
                let notePath = eventPath + ["notes", "\(noteIndex)"]
                checking(
                    &issues, (0...127).contains(chordNote.midi), notePath + ["midi"], "midi must be within 0...127"
                )
                if let fingering = chordNote.fingering {
                    issues.append(contentsOf: fingeringIssues(fingering, at: notePath + ["fingering"]))
                }
            }
        }

        return issues
    }
}

/// Appends an issue at `path` with `message` when `condition` is false. Shared by every
/// `validationIssues(at:)` level so each reads as a flat list of the Zod refinements it
/// mirrors, rather than a pyramid of `if`/`else` blocks.
private func checking(
    _ issues: inout [ScoreDocumentValidationError.Issue],
    _ condition: @autoclosure () -> Bool,
    _ path: [String],
    _ message: String
) {
    if !condition() { issues.append(.init(path: path, message: message)) }
}

private func fingeringIssues(_ fingering: Fingering, at path: [String]) -> [ScoreDocumentValidationError.Issue] {
    var issues: [ScoreDocumentValidationError.Issue] = []
    if fingering.string <= 0 {
        issues.append(.init(path: path + ["string"], message: "string must be positive"))
    }
    if fingering.fret < 0 {
        issues.append(.init(path: path + ["fret"], message: "fret must be >= 0"))
    }
    if let finger = fingering.finger, !(0...5).contains(finger) {
        issues.append(.init(path: path + ["finger"], message: "finger must be within 0...5"))
    }
    return issues
}
