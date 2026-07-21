// Single-letter geometry/time variables (x, y, t, dt, i, rx, ry, sx, sy, …) are ported 1:1 from
// the web glass-highway reference, where they read clearest; identifier_name is scoped off here.
// swiftlint:disable identifier_name
import Foundation
import PlaySenseCore

// Port of `components/play-sense/glass-highway/LaneLayout.ts`.
//
// Pure-geometry lane abstraction — nothing here touches SpriteKit; renderers ask the layout where
// things go. Two implementations: ``PadLaneLayout`` (evenly-spaced percussion / capped melodic lanes)
// and ``PianoLaneLayout`` (88 lanes mapped onto real keyboard geometry).

public enum LaneKind: String, Sendable { case pads, piano }

/// Where notes, receptors and effects sit for a given exercise.
public protocol LaneLayout: AnyObject {
    var kind: LaneKind { get }
    var laneCount: Int { get }
    /// Recompute X positions for a new stage width.
    func resize(width: Double)
    /// Map an exercise event to its lane index.
    func laneForEvent(_ event: ExerciseEvent?) -> Int
    func laneCenterX(_ lane: Int) -> Double
    func noteWidth(_ lane: Int) -> Double
    func laneColor(_ lane: Int) -> UInt32
    func laneLabel(_ lane: Int) -> String
}

private let noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

func midiToNoteName(_ midi: Int) -> String {
    let octave = Int(floor(Double(midi) / 12)) - 1
    return "\(noteNames[((midi % 12) + 12) % 12])\(octave)"
}

private let noteNamesMidi: [String: Int] = [
    "C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3, "E": 4, "F": 5,
    "F#": 6, "Gb": 6, "G": 7, "G#": 8, "Ab": 8, "A": 9, "A#": 10, "Bb": 10, "B": 11
]

/// Port of `noteNameToMidi` — e.g. "C4" → 60, "Eb3" → 51.
public func noteNameToMidi(_ name: String) -> Int? {
    guard let match = try? NSRegularExpression(pattern: "^([A-Ga-g][b#]?)(-?\\d+)$")
        .firstMatch(in: name, range: NSRange(name.startIndex..., in: name)) else { return nil }
    guard let letterRange = Range(match.range(at: 1), in: name),
          let octaveRange = Range(match.range(at: 2), in: name) else { return nil }
    let letter = String(name[letterRange])
    let key = letter.prefix(1).uppercased() + letter.dropFirst()
    guard let semi = noteNamesMidi[key], let octave = Int(name[octaveRange]) else { return nil }
    return (octave + 1) * 12 + semi
}

private func capitalizeFirst(_ s: String) -> String {
    s.isEmpty ? s : s.prefix(1).uppercased() + s.dropFirst()
}

// MARK: - Pads

/// Fraction of stage width the pad lanes span (centered).
private let padSpan = 0.82
/// Note pill width as a fraction of the lane width.
private let padNoteWidth = 0.58
private let maxMelodicLanes = 8

public final class PadLaneLayout: LaneLayout {
    public let kind: LaneKind = .pads
    public let laneCount: Int

    private let surfaces: [String]
    private let labels: [String]
    private let colors: [UInt32]
    private var width: Double = 0

    public init(surfaces: [String], labels: [String], colors: [UInt32]) {
        self.surfaces = surfaces
        self.labels = labels
        self.colors = colors
        self.laneCount = surfaces.count
    }

    public func resize(width: Double) { self.width = width }

    public func laneForEvent(_ event: ExerciseEvent?) -> Int {
        guard let event else { return 0 }
        if let surface = event.surface, let idx = surfaces.firstIndex(of: surface) { return idx }
        if let name = event.expectedNoteName {
            if let idx = surfaces.firstIndex(of: name) { return idx }
            if let pitch = event.expectedPitch { return closestPitchedLane(pitch) }
        }
        if let idx = surfaces.firstIndex(of: event.technique.rawValue) { return idx }
        return 0
    }

    public func laneCenterX(_ lane: Int) -> Double {
        let span = width * padSpan
        let left = (width - span) / 2
        let laneWidth = span / Double(laneCount)
        return left + laneWidth * (Double(lane) + 0.5)
    }

    public func noteWidth(_ lane: Int) -> Double {
        let laneWidth = (width * padSpan) / Double(laneCount)
        return min(laneWidth * padNoteWidth, 96)
    }

    public func laneColor(_ lane: Int) -> UInt32 {
        lane >= 0 && lane < colors.count ? colors[lane] : HighwayPalette.defaultLaneColor
    }

    public func laneLabel(_ lane: Int) -> String {
        lane >= 0 && lane < labels.count ? labels[lane] : ""
    }

    private func closestPitchedLane(_ midiPitch: Int) -> Int {
        var bestIdx = 0
        var bestDist = Int.max
        for (i, surface) in surfaces.enumerated() {
            guard let lanePitch = noteNameToMidi(surface) else { continue }
            let d = abs(lanePitch - midiPitch)
            if d < bestDist { bestDist = d; bestIdx = i }
        }
        return bestIdx
    }
}

// MARK: - Piano

public let pianoLowMidi = 21 // A0
public let pianoHighMidi = 108 // C8
public let pianoWhiteCount = 52
private let blackPitchClasses: Set<Int> = [1, 3, 6, 8, 10]
/// Black key width as a fraction of a white key.
public let blackKeyRatio = 0.62
/// Classic visual offsets so black keys cluster in 2s and 3s (fraction of white width).
private let blackOffset: [Int: Double] = [1: -0.12, 3: 0.12, 6: -0.12, 8: 0, 10: 0.12]

public func isBlackKey(_ midi: Int) -> Bool {
    blackPitchClasses.contains(((midi % 12) + 12) % 12)
}

/// Count of white keys strictly below this midi note, starting from A0.
private func whiteIndexOf(_ midi: Int) -> Int {
    var count = 0
    var m = pianoLowMidi
    while m < midi { if !isBlackKey(m) { count += 1 }; m += 1 }
    return count
}

// Precomputed white index per midi (88 entries) — cheap, done once at load.
private let whiteIndex: [Int] = (pianoLowMidi...pianoHighMidi).map { whiteIndexOf($0) }

public final class PianoLaneLayout: LaneLayout {
    public let kind: LaneKind = .piano
    public let laneCount = pianoHighMidi - pianoLowMidi + 1 // 88

    private var width: Double = 0
    private var whiteW: Double = 0

    public init() {}

    public func resize(width: Double) {
        self.width = width
        self.whiteW = width / Double(pianoWhiteCount)
    }

    public func laneForEvent(_ event: ExerciseEvent?) -> Int {
        guard let event else { return 0 }
        var midi = event.expectedPitch
        if midi == nil, let name = event.expectedNoteName { midi = noteNameToMidi(name) }
        guard let value = midi else { return 0 }
        return min(max(value, pianoLowMidi), pianoHighMidi) - pianoLowMidi
    }

    public func midiForLane(_ lane: Int) -> Int { lane + pianoLowMidi }

    public func laneCenterX(_ lane: Int) -> Double {
        let midi = lane + pianoLowMidi
        if isBlackKey(midi) {
            let boundary = whiteIndex[lane]
            let offset = blackOffset[((midi % 12) + 12) % 12] ?? 0
            return (Double(boundary) + offset * 0.5) * whiteW
        }
        return (Double(whiteIndex[lane]) + 0.5) * whiteW
    }

    public func noteWidth(_ lane: Int) -> Double {
        let midi = lane + pianoLowMidi
        return isBlackKey(midi)
            ? max(whiteW * blackKeyRatio * 0.9, 2)
            : max(whiteW * 0.86, 3)
    }

    public func laneColor(_ lane: Int) -> UInt32 {
        isBlackKey(lane + pianoLowMidi) ? HighwayPalette.pianoBlackNoteColor : HighwayPalette.pianoWhiteNoteColor
    }

    public func laneLabel(_ lane: Int) -> String {
        let midi = lane + pianoLowMidi
        let name = midiToNoteName(midi)
        return name.hasPrefix("C") && !name.hasPrefix("C#") ? name : ""
    }

    public func whiteKeyWidth() -> Double { whiteW }
}

// MARK: - Factory

// The branchy instrument dispatch mirrors the web factory 1:1; splitting it would only obscure parity.
// swiftlint:disable cyclomatic_complexity function_body_length
/// Build the right layout for an exercise (port of `createLaneLayout`).
public func createLaneLayout(_ exercise: ExerciseDefinition) -> LaneLayout {
    if exercise.instrument == .piano { return PianoLaneLayout() }

    // Percussion with PlaySense piezo mapping
    if let mapping = getPlaySenseMapping(exercise.instrument.rawValue) {
        // Object.values(piezoMap) iterates in numeric-key order for integer keys.
        let surfaces = mapping.piezoMap.sorted { $0.key < $1.key }.map { $0.value }
        return PadLaneLayout(
            surfaces: surfaces,
            labels: surfaces.map { $0.uppercased() },
            colors: surfaces.map { HighwayPalette.laneColors[$0] ?? HighwayPalette.defaultLaneColor }
        )
    }

    let category = getInstrumentCategory(exercise.instrument)

    // Percussion without PlaySense mapping — unique surfaces/techniques
    if category == .percussion {
        var seen = Set<String>()
        var techniques: [String] = []
        for e in exercise.events {
            let key = e.surface ?? e.technique.rawValue
            if seen.insert(key).inserted { techniques.append(key) }
        }
        let surfaces = techniques.isEmpty ? ["open", "slap", "mute"] : techniques
        return PadLaneLayout(
            surfaces: surfaces,
            labels: surfaces.map { $0.uppercased() },
            colors: surfaces.map { HighwayPalette.laneColors[$0] ?? HighwayPalette.defaultLaneColor }
        )
    }

    // Pitched / melodic (non-piano) — one lane per unique note, capped at 8
    var uniqueByName: [(name: String, pitch: Int)] = []
    var seenNames = Set<String>()
    for e in exercise.events {
        let name = e.expectedNoteName ?? (e.expectedPitch.map { midiToNoteName($0) })
        guard let name else { continue }
        if seenNames.insert(name).inserted { uniqueByName.append((name, e.expectedPitch ?? 0)) }
    }
    var surfaces: [String]
    if uniqueByName.isEmpty {
        surfaces = ["low", "mid", "high"]
    } else {
        surfaces = uniqueByName.sorted { $0.pitch < $1.pitch }.map { $0.name }
        if surfaces.count > maxMelodicLanes {
            let step = Int(ceil(Double(surfaces.count) / Double(maxMelodicLanes)))
            surfaces = surfaces.enumerated().filter { $0.offset % step == 0 }.map { $0.element }
            surfaces = Array(surfaces.prefix(maxMelodicLanes))
        }
    }

    var labels = surfaces.map { capitalizeFirst($0) }
    if exercise.instrument == .violin {
        let strings = HighwayPalette.violinOpenStrings
        labels = surfaces.indices.map { strings[$0 % strings.count] }
    } else if exercise.instrument == .guitar || exercise.instrument == .bass {
        let palette = exercise.instrument == .guitar ? HighwayPalette.guitarOpenStrings : ["E", "A", "D", "G"]
        labels = surfaces.indices.map { palette[$0 % palette.count] }
    }

    let palette = HighwayPalette.melodicLaneColors
    let colors = surfaces.indices.map { palette[$0 % palette.count] }
    return PadLaneLayout(surfaces: surfaces, labels: labels, colors: colors)
}
// swiftlint:enable cyclomatic_complexity function_body_length

// swiftlint:enable identifier_name
