import Foundation

/// Port of `Instrument` (`components/playsense-studio/shared/score-model/types.ts`).
/// A closed union in the web app (Zod `z.enum`) — an unrecognized raw value is a genuine
/// decode failure here too (`DecodingError`), same as it would fail Zod validation there.
public enum Instrument: String, Codable, Equatable, Hashable, Sendable, CaseIterable {
    case guitar
    case bass
    case tres
    case cuatro
    case tiple
    case ukulele
    case mandolin
    case piano
    case staff
    case percKit = "perc-kit"
    case percConga = "perc-conga"
    case percBongo = "perc-bongo"
    case percTimbal = "perc-timbal"
    case percClave = "perc-clave"
}

/// Port of `DefaultView` (same source file as ``Instrument``).
public enum DefaultView: String, Codable, Equatable, Hashable, Sendable, CaseIterable {
    case staff
    case tab
    case fretboard
    case rhythmGrid = "rhythm-grid"
    case pdf
}

/// Port of `SourceFormat` (same source file as ``Instrument``).
public enum SourceFormat: String, Codable, Equatable, Hashable, Sendable, CaseIterable {
    case musicxml
    case midi
    case pdf
    case image
    case native
}
