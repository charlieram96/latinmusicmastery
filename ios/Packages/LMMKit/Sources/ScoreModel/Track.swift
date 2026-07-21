import Foundation

/// Port of `Track` (`components/playsense-studio/shared/score-model/types.ts`).
///
/// `stringMultiplicity` is intentionally left unconstrained here even though the web
/// serializer's Zod schema clamps it to `1...3` — `lib/playsense-studio/instruments.ts`
/// sets it to `0` for unfretted instruments (piano, staff, every `perc-*` kit), which is
/// exactly the shape production `parsed_score` rows use for those tracks. Decoding
/// leniently (any `Int`) keeps every real corpus document decodable; see the C12 task
/// brief note on this discrepancy between the two web-side sources of truth.
public struct Track: Equatable, Hashable, Sendable {
    public var index: Int
    public var instrument: Instrument
    public var displayName: String
    /// Open-string note names, low-to-high (e.g. `["E2","A2","D3","G3","B3","E4"]`
    /// for guitar). `nil` for unpitched (percussion) tracks.
    public var tuning: [String]?
    /// 1 = single course, 2 = double (tres), 3 = triple (tiple); 0 for unfretted tracks.
    public var stringMultiplicity: Int
    /// MIDI channel if originated from MIDI; `nil` otherwise.
    public var channel: Int?
    public var defaultView: DefaultView
    public var measures: [Measure]

    public init(
        index: Int,
        instrument: Instrument,
        displayName: String,
        tuning: [String]?,
        stringMultiplicity: Int,
        channel: Int?,
        defaultView: DefaultView,
        measures: [Measure]
    ) {
        self.index = index
        self.instrument = instrument
        self.displayName = displayName
        self.tuning = tuning
        self.stringMultiplicity = stringMultiplicity
        self.channel = channel
        self.defaultView = defaultView
        self.measures = measures
    }
}

extension Track: Codable {
    private enum CodingKeys: String, CodingKey {
        case index
        case instrument
        case displayName
        case tuning
        case stringMultiplicity
        case channel
        case defaultView
        case measures
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        index = try container.decode(Int.self, forKey: .index)
        instrument = try container.decode(Instrument.self, forKey: .instrument)
        displayName = try container.decode(String.self, forKey: .displayName)
        // `tuning`/`channel` are required-but-nullable in the TS model (`string[] | null` /
        // `number | null`), unlike the true optional/absent-capable fields elsewhere (e.g.
        // `ScoreDocument.composer`). Decoding leniently with `decodeIfPresent` tolerates a
        // key that's flat-out missing too, in case an older writer ever omitted it.
        tuning = try container.decodeIfPresent([String].self, forKey: .tuning)
        stringMultiplicity = try container.decode(Int.self, forKey: .stringMultiplicity)
        channel = try container.decodeIfPresent(Int.self, forKey: .channel)
        defaultView = try container.decode(DefaultView.self, forKey: .defaultView)
        measures = try container.decode([Measure].self, forKey: .measures)
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(index, forKey: .index)
        try container.encode(instrument, forKey: .instrument)
        try container.encode(displayName, forKey: .displayName)
        // Deliberately `encode`, not `encodeIfPresent`: these two are required-but-nullable
        // in the TS model, so a `nil` here must round-trip to an explicit JSON `null` (what
        // `JSON.stringify` produces for a JS `null` property) rather than an omitted key
        // (what it produces for `undefined` — which these fields are never assigned).
        try container.encode(tuning, forKey: .tuning)
        try container.encode(stringMultiplicity, forKey: .stringMultiplicity)
        try container.encode(channel, forKey: .channel)
        try container.encode(defaultView, forKey: .defaultView)
        try container.encode(measures, forKey: .measures)
    }
}
