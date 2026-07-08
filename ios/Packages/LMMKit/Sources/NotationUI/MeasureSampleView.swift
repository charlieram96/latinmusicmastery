import NotationEngraving
import ScoreModel
import SwiftUI

/// Debug-only view rendering one laid-out measure via `MeasureLayoutEngine` + `drawMeasureFrame`
/// — the task C14 successor to `StaffSampleView` (which drew a static, hand-placed C13 sample).
/// Not wired into any user-facing navigation; it exists for the `#Preview`s below and ad-hoc
/// visual checks while beaming/ties (C15) and systems (C16) build on top.
struct MeasureSampleView: View {
    /// The track whose first measure is drawn (built from a corpus-shaped fixture below).
    var track: Track
    var timeSignature: TimeSignature
    var keyFifths: Int
    var staffSpacePoints: CGFloat = 12

    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        GeometryReader { proxy in
            Image(uiImage: renderedImage(size: proxy.size))
                .resizable()
                .aspectRatio(contentMode: .fit)
        }
        .frame(height: staffSpacePoints * 14)
    }

    private func renderedImage(size: CGSize) -> UIImage {
        let scale = ScaleContext(staffSpacePoints: staffSpacePoints)
        let notationColor: NotationColor = colorScheme == .dark ? .darkDefault : .lightDefault
        let backgroundColor: CGColor = colorScheme == .dark ? .init(gray: 0, alpha: 1) : .init(gray: 1, alpha: 1)

        let measures = EventDescriptorBuilder.extractTrackEvents(
            track: track,
            initialTimeSignature: timeSignature,
            keyFifths: keyFifths
        )
        let events = measures.first?.events ?? []
        let clef = measures.first?.clef ?? .treble
        let context = MeasureContext(
            clef: clef,
            timeSignature: timeSignature,
            showClef: true,
            showTimeSignature: true,
            measureStartQN: measures.first?.cumulativeQN ?? 0
        )

        let renderer = UIGraphicsImageRenderer(size: size)
        return renderer.image { rendererContext in
            let ctx = rendererContext.cgContext
            ctx.setFillColor(backgroundColor)
            ctx.fill(CGRect(origin: .zero, size: size))
            drawMeasureSample(
                events: events,
                context: context,
                in: ctx,
                size: size,
                scale: scale,
                notationColor: notationColor
            )
        }
    }
}

/// Debug view for the C15 rhythm-rich sample measure (beams, secondary stubs, a triplet, a
/// tie) — laid out from `rhythmRichSampleEvents()` and drawn directly, since its triplet/tie
/// content isn't expressible as a plain `Track`.
struct RhythmMeasureSampleView: View {
    var staffSpacePoints: CGFloat = 14
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        GeometryReader { proxy in
            Image(uiImage: renderedImage(size: proxy.size))
                .resizable()
                .aspectRatio(contentMode: .fit)
        }
        .frame(height: staffSpacePoints * 16)
    }

    private func renderedImage(size: CGSize) -> UIImage {
        let scale = ScaleContext(staffSpacePoints: staffSpacePoints)
        let notationColor: NotationColor = colorScheme == .dark ? .darkDefault : .lightDefault
        let backgroundColor: CGColor = colorScheme == .dark ? .init(gray: 0, alpha: 1) : .init(gray: 1, alpha: 1)
        let context = MeasureContext(
            clef: .treble, timeSignature: fourFour, showClef: true, showTimeSignature: true
        )
        let renderer = UIGraphicsImageRenderer(size: size)
        return renderer.image { rendererContext in
            let ctx = rendererContext.cgContext
            ctx.setFillColor(backgroundColor)
            ctx.fill(CGRect(origin: .zero, size: size))
            drawMeasureSample(
                events: rhythmRichSampleEvents(), context: context, in: ctx,
                size: size, scale: scale, notationColor: notationColor
            )
        }
    }
}

// MARK: - Sample tracks (corpus-shaped)

private let fourFour = TimeSignature(numerator: 4, denominator: 4)

private func sampleTrack(instrument: Instrument, channel: Int, view: DefaultView, events: [MusicalEvent]) -> Track {
    Track(
        index: 0,
        instrument: instrument,
        displayName: instrument.rawValue,
        tuning: nil,
        stringMultiplicity: 1,
        channel: channel,
        defaultView: view,
        measures: [Measure(number: 1, voices: [Voice(number: 1, events: events)])]
    )
}

private func pitchedSampleTrack() -> Track {
    // C-major scale fragment (matches guitar_lick_fixture measure 1): quarter notes C4..F4.
    let events: [MusicalEvent] = [60, 62, 64, 65].map { .note(Note(durationQN: 1, midi: $0)) }
    return sampleTrack(instrument: .guitar, channel: 0, view: .staff, events: events)
}

private func percussionSampleTrack() -> Track {
    // Conga tumbao measure 1 (matches conga_tumbao_fixture): eighth-note strokes + rests.
    let events: [MusicalEvent] = [
        .note(Note(durationQN: 0.5, midi: 62)), .rest(Rest(durationQN: 0.5)),
        .note(Note(durationQN: 0.5, midi: 64)), .note(Note(durationQN: 0.5, midi: 64)),
        .note(Note(durationQN: 0.5, midi: 63)), .rest(Rest(durationQN: 0.5)),
        .note(Note(durationQN: 0.5, midi: 64)), .note(Note(durationQN: 0.5, midi: 64))
    ]
    return sampleTrack(instrument: .percConga, channel: 9, view: .rhythmGrid, events: events)
}

#Preview("Measure — pitched (light)") {
    MeasureSampleView(track: pitchedSampleTrack(), timeSignature: fourFour, keyFifths: 0)
        .padding()
}

#Preview("Measure — percussion (light)") {
    MeasureSampleView(track: percussionSampleTrack(), timeSignature: fourFour, keyFifths: 0)
        .padding()
}

#Preview("Measure — pitched (dark)") {
    MeasureSampleView(track: pitchedSampleTrack(), timeSignature: fourFour, keyFifths: 0)
        .padding()
        .background(Color.black)
        .preferredColorScheme(.dark)
}

#Preview("Measure — rhythm (beams/triplet/tie)") {
    RhythmMeasureSampleView()
        .padding()
}
