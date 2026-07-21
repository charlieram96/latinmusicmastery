import Foundation

/// Port of the `[number, number]` tuple shape used for `initialTimeSignature` and
/// `Measure.timeSignature` in `components/playsense-studio/shared/score-model/types.ts`
/// (e.g. `[4, 4]`). Decodes from / encodes to a bare 2-element JSON array, matching the
/// TS tuple wire shape exactly (no `{numerator, denominator}` object wrapper).
public struct TimeSignature: Equatable, Hashable, Sendable {
    public var numerator: Int
    public var denominator: Int

    public init(numerator: Int, denominator: Int) {
        self.numerator = numerator
        self.denominator = denominator
    }
}

extension TimeSignature: Codable {
    public init(from decoder: Decoder) throws {
        var container = try decoder.unkeyedContainer()
        guard let count = container.count, count == 2 else {
            throw DecodingError.dataCorruptedError(
                in: container,
                debugDescription: "TimeSignature must be a 2-element array, got \(container.count ?? 0) elements"
            )
        }
        numerator = try container.decode(Int.self)
        denominator = try container.decode(Int.self)
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.unkeyedContainer()
        try container.encode(numerator)
        try container.encode(denominator)
    }
}
