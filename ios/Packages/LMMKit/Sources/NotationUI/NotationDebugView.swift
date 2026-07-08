import NotationEngraving
import ScoreModel
import SwiftUI

/// A DEBUG-only screen exercising the full native notation stack on a live device/simulator:
/// two multi-measure documents (a percussion tumbao and a pitched montuno line) in both layout
/// modes, driven through `ScoreView` → `NotationView`. Reachable from a `#if DEBUG` row on the
/// Profile tab so it needs no content wiring.
///
/// The documents are built in code (corpus-shaped, matching the `MeasureSampleView` precedent)
/// rather than loaded from the test-only corpus JSON fixtures, which aren't bundled at runtime.
public struct NotationDebugView: View {
    @State private var mode: StaffLayoutMode = .wrapped
    @State private var sample: DebugSample = .percussion

    public init() {}

    public var body: some View {
        VStack(spacing: 0) {
            Picker("Sample", selection: $sample) {
                ForEach(DebugSample.allCases, id: \.self) { Text($0.title).tag($0) }
            }
            .pickerStyle(.segmented)
            .padding()

            Picker("Mode", selection: $mode) {
                Text("Wrapped").tag(StaffLayoutMode.wrapped)
                Text("Scroll").tag(StaffLayoutMode.scroll)
            }
            .pickerStyle(.segmented)
            .padding(.horizontal)
            .padding(.bottom, 8)

            ScoreView(score: sample.document, trackIndex: 0, mode: mode)
                .id("\(sample.rawValue)-\(mode.rawValue)")
        }
        .navigationTitle("Notation Debug")
    }
}

/// The two debug documents.
public enum DebugSample: String, CaseIterable {
    case percussion
    case pitched

    var title: String { self == .percussion ? "Percussion" : "Pitched" }

    var document: ScoreDocument { self == .percussion ? NotationDebugSamples.percussion : NotationDebugSamples.pitched }
}

/// Corpus-shaped multi-measure sample documents for the debug screen.
enum NotationDebugSamples {
    private static let fourFour = TimeSignature(numerator: 4, denominator: 4)

    /// 8 bars of a conga tumbao (eighth-note strokes + rests) — exercises beams, rests, x/normal
    /// noteheads, and multi-system wrapping.
    static let percussion: ScoreDocument = {
        let bar: [MusicalEvent] = [
            .note(Note(durationQN: 0.5, midi: 62)), .rest(Rest(durationQN: 0.5)),
            .note(Note(durationQN: 0.5, midi: 64)), .note(Note(durationQN: 0.5, midi: 64)),
            .note(Note(durationQN: 0.5, midi: 63)), .rest(Rest(durationQN: 0.5)),
            .note(Note(durationQN: 0.5, midi: 64)), .note(Note(durationQN: 0.5, midi: 64))
        ]
        return document(instrument: .percConga, view: .rhythmGrid, bars: 8, events: bar, title: "Tumbao ×8")
    }()

    /// 8 bars of a pitched montuno-ish line (quarters + beamed eighths) — exercises stems,
    /// beams, ledger lines, and wrapping/scrolling on a treble staff.
    static let pitched: ScoreDocument = {
        let bar: [MusicalEvent] = [
            .note(Note(durationQN: 1, midi: 60)),
            .note(Note(durationQN: 0.5, midi: 64)), .note(Note(durationQN: 0.5, midi: 67)),
            .note(Note(durationQN: 1, midi: 72)),
            .note(Note(durationQN: 0.5, midi: 67)), .note(Note(durationQN: 0.5, midi: 64))
        ]
        return document(instrument: .guitar, view: .staff, bars: 8, events: bar, title: "Montuno ×8")
    }()

    private static func document(
        instrument: Instrument,
        view: DefaultView,
        bars: Int,
        events: [MusicalEvent],
        title: String
    ) -> ScoreDocument {
        let measures = (1...bars).map { Measure(number: $0, voices: [Voice(number: 1, events: events)]) }
        let track = Track(
            index: 0, instrument: instrument, displayName: title, tuning: nil,
            stringMultiplicity: 0, channel: view == .rhythmGrid ? 9 : 0, defaultView: view, measures: measures
        )
        return ScoreDocument(
            title: title, sourceFormat: .native, initialTempo: 120,
            initialTimeSignature: fourFour, initialKeyFifths: 0, tracks: [track]
        )
    }
}

#if DEBUG
#Preview("Notation Debug") {
    NavigationStack { NotationDebugView() }
}
#endif
