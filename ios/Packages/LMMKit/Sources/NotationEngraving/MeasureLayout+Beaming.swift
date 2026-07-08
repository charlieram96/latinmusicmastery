import CoreGraphics
import Foundation
import ScoreModel

/// The beaming / tie / tuplet passes of `MeasureLayoutEngine` — everything that consumes the
/// per-event `EventLayout`s captured during note placement to emit stems, beam bars, ties, and
/// tuplet indications. Split out of `MeasureLayout.swift` so each file stays focused.
extension MeasureLayoutEngine {
    // MARK: Beam plan

    /// Beam grouping + per-group unified stem direction for one measure.
    struct BeamPlan {
        let groups: [[Int]]
        let groupOfEvent: [Int?]
        let groupStemUp: [Bool]

        static func make(events: [EventDescriptor], timeSignature: TimeSignature) -> BeamPlan {
            let groups = BeamGrouper.beamGroups(events: events, timeSignature: timeSignature)
            var groupOfEvent = [Int?](repeating: nil, count: events.count)
            for (groupIndex, indices) in groups.enumerated() {
                for eventIndex in indices where eventIndex >= 0 && eventIndex < events.count {
                    groupOfEvent[eventIndex] = groupIndex
                }
            }
            return BeamPlan(
                groups: groups, groupOfEvent: groupOfEvent,
                groupStemUp: groups.map { groupStemPointsUp(events: events, indices: $0) }
            )
        }

        /// The beam group's unified stem direction for an event, or `nil` if it isn't beamed.
        func forcedStemUp(forEvent index: Int) -> Bool? {
            groupOfEvent[index].map { groupStemUp[$0] }
        }

        /// True only when the event is in a group that actually beamed (per `beamedFully`).
        func isBeamed(_ index: Int, beamedFully: [Bool]) -> Bool {
            groupOfEvent[index].map { beamedFully[$0] } ?? false
        }
    }

    /// Unified stem direction for a whole beam group: stem up when the mean staff position of
    /// every notehead in the group is strictly below the middle line (same pivot as a single
    /// note's `stemPointsUp`, applied across the group — VexFlow's `calculateStemDirection`
    /// analogue).
    private static func groupStemPointsUp(events: [EventDescriptor], indices: [Int]) -> Bool {
        let positions = indices.flatMap { events[$0].notes.map(\.staffPosition) }
        guard !positions.isEmpty else { return true }
        let mean = Double(positions.reduce(0, +)) / Double(positions.count)
        return mean < Double(MeasureLayoutMetrics.middleLinePosition)
    }

    /// The beam/tie/tuplet elements, bundled for `assemble`.
    struct RhythmElements {
        let beams: [BeamSegment]
        let ties: [TieShape]
        let tuplets: [TupletShape]
    }

    // MARK: Passes 2–5

    /// Emit stems (+flags for unbeamed notes), beam bars, ties, and tuplet indications from the
    /// placed noteheads. Mutates `elements` (stems) and returns the beam/tie/tuplet arrays.
    static func resolveRhythm(
        events: [EventDescriptor],
        layouts: [Int: EventLayout],
        plan: BeamPlan,
        env: LayoutEnv,
        into elements: inout ElementBucket
    ) -> RhythmElements {
        // Pass 2: stems + flags for the events NOT in a beam group (unchanged from C14).
        for index in events.indices where plan.groupOfEvent[index] == nil {
            if let layout = layouts[index] { appendUnbeamedStem(layout, env: env, into: &elements) }
        }

        // Pass 3: beams + the stems that reach them (no flags — beamed notes drop their flag).
        var beams: [BeamSegment] = []
        var beamedFully = [Bool](repeating: false, count: plan.groups.count)
        for (groupIndex, indices) in plan.groups.enumerated() {
            let laid = indices.compactMap { layouts[$0] }
            guard laid.count == indices.count, laid.count >= 2 else {
                // Totality guard: a group whose events didn't all lay out (stemless, etc.) falls
                // back to plain stems + flags so nothing is dropped.
                laid.forEach { appendUnbeamedStem($0, env: env, into: &elements) }
                continue
            }
            beamedFully[groupIndex] = true
            appendBeamedGroup(laid, stemUp: plan.groupStemUp[groupIndex], env: env, beams: &beams, into: &elements)
        }

        let ties = tieShapes(events: events, layouts: layouts, env: env)
        let tuplets = tupletShapes(events: events, layouts: layouts, plan: plan, beamedFully: beamedFully, env: env)
        return RhythmElements(beams: beams, ties: ties, tuplets: tuplets)
    }

    private static func appendBeamedGroup(
        _ laid: [EventLayout],
        stemUp: Bool,
        env: LayoutEnv,
        beams: inout [BeamSegment],
        into elements: inout ElementBucket
    ) {
        let notes = laid.map {
            BeamGeometry.Note(stemX: $0.stemX, beamSideNoteheadY: $0.beamSideNoteheadY, beamCount: $0.code.beamCount)
        }
        let result = BeamGeometry.layout(notes: notes, stemUp: stemUp, scale: env.scale, defaults: env.defaults)
        beams.append(contentsOf: result.segments)
        let thickness = env.points(env.defaults.stemThickness)
        for (offset, layout) in laid.enumerated() {
            elements.stems.append(LineSegment(
                start: CGPoint(x: layout.stemX, y: layout.stemBaseY),
                end: CGPoint(x: layout.stemX, y: result.stemTips[offset]),
                thickness: thickness
            ))
        }
    }

    // MARK: Ties

    /// Tie arcs for every event flagged `tieToNext`. A tie joins each notehead to the same-pitch
    /// notehead of the next event; if the next event is a rest or the measure ends (no same-pitch
    /// partner in this measure), a short stub is drawn toward the barline — C16 will make ties
    /// system-aware and continue them across the break (documented).
    static func tieShapes(events: [EventDescriptor], layouts: [Int: EventLayout], env: LayoutEnv) -> [TieShape] {
        var result: [TieShape] = []
        for index in events.indices where events[index].tieToNext {
            guard let from = layouts[index] else { continue }
            var drewFull = false
            if index + 1 < events.count, let toLayout = layouts[index + 1] {
                for (position, origin) in from.noteOrigins {
                    guard let target = toLayout.noteOrigins.first(where: { $0.position == position }) else { continue }
                    result.append(TieGeometry.tie(
                        endpoints: TieGeometry.Endpoints(
                            fromCenter: origin, toCenter: target.origin,
                            noteheadWidth: env.noteheadWidth, stemUp: from.stemUp
                        ),
                        scale: env.scale, defaults: env.defaults
                    ))
                    drewFull = true
                }
            }
            if !drewFull {
                // Dangling tie: clip a short stub toward the barline (a phantom partner ~3 spaces
                // to the right). Revisited by C16's system-aware ties.
                for (_, origin) in from.noteOrigins {
                    let phantom = CGPoint(x: origin.x + env.points(3.0), y: origin.y)
                    result.append(TieGeometry.tie(
                        endpoints: TieGeometry.Endpoints(
                            fromCenter: origin, toCenter: phantom,
                            noteheadWidth: env.noteheadWidth, stemUp: from.stemUp
                        ),
                        scale: env.scale, defaults: env.defaults
                    ))
                }
            }
        }
        return result
    }

    // MARK: Tuplets

    /// Tuplet indications for every maximal run of contiguous `triplet` events. The reference
    /// edge (which the bracket clears / the digit sits over) is each note's natural stem tip.
    ///
    /// LIMITATION (C15 carry-forward, documented for C16): "contiguous run of `triplet` events"
    /// is the whole grouping key — two *musically separate* triplet groups that happen to sit
    /// back-to-back with no non-triplet event between them (e.g. two eighth-note triplets filling
    /// beats 2 and 3) collapse into a SINGLE 6-long run here, drawing one bracket/`3` spanning
    /// both instead of two. The corpus authors no `triplet` events at all (see the C15 report),
    /// so this never manifests on real content; a faithful fix needs a per-group tuplet id on the
    /// event (which neither the web descriptor nor `EventDescriptor` currently carries), so it is
    /// left as-is and isolated to this grouping loop rather than guessed at.
    static func tupletShapes(
        events: [EventDescriptor],
        layouts: [Int: EventLayout],
        plan: BeamPlan,
        beamedFully: [Bool],
        env: LayoutEnv
    ) -> [TupletShape] {
        var result: [TupletShape] = []
        var index = 0
        while index < events.count {
            guard events[index].triplet else { index += 1; continue }
            var last = index
            while last + 1 < events.count, events[last + 1].triplet { last += 1 }
            if let shape = tupletShape(
                indices: Array(index...last), layouts: layouts, plan: plan, beamedFully: beamedFully, env: env
            ) {
                result.append(shape)
            }
            index = last + 1
        }
        return result
    }

    private static func tupletShape(
        indices: [Int],
        layouts: [Int: EventLayout],
        plan: BeamPlan,
        beamedFully: [Bool],
        env: LayoutEnv
    ) -> TupletShape? {
        let laid = indices.compactMap { layouts[$0] }
        guard let first = laid.first else { return nil }
        let stemLength = env.points(MeasureLayoutMetrics.stemLengthSpaces)
        let stemUp = first.stemUp
        // Natural stem tip per note (clears the noteheads, ≈ the beam for beamed notes).
        let referenceYs = laid.map { $0.beamSideNoteheadY + (stemUp ? -stemLength : stemLength) }
        let pitched = indices.filter { layouts[$0] != nil }
        let fullyBeamed = !pitched.isEmpty && pitched.allSatisfy { plan.isBeamed($0, beamedFully: beamedFully) }
        return TupletBracket.tuplet(
            run: TupletBracket.Run(
                stemXs: laid.map(\.stemX), referenceYs: referenceYs, stemUp: stemUp, fullyBeamed: fullyBeamed
            ),
            digitGlyph: .tuplet3, digitBBox: env.metrics.boundingBox(for: .tuplet3),
            scale: env.scale, defaults: env.defaults
        )
    }
}
