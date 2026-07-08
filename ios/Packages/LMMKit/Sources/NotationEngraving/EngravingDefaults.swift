import Foundation

/// The subset of SMuFL's `engravingDefaults` (staff-space line-thickness constants) this
/// engraving engine currently draws with. All values are in staff spaces. More fields
/// (`hairpinThickness`, `tupletBracketThickness`, ...) can be added here as later tasks need
/// them — see the full list in `bravura_metadata.json`'s `engravingDefaults` object.
public struct EngravingDefaults: Equatable {
    public let staffLineThickness: StaffSpaces
    public let stemThickness: StaffSpaces
    public let beamThickness: StaffSpaces
    public let legerLineThickness: StaffSpaces
    public let legerLineExtension: StaffSpaces
    public let thinBarlineThickness: StaffSpaces

    public init(
        staffLineThickness: StaffSpaces,
        stemThickness: StaffSpaces,
        beamThickness: StaffSpaces,
        legerLineThickness: StaffSpaces,
        legerLineExtension: StaffSpaces,
        thinBarlineThickness: StaffSpaces
    ) {
        self.staffLineThickness = staffLineThickness
        self.stemThickness = stemThickness
        self.beamThickness = beamThickness
        self.legerLineThickness = legerLineThickness
        self.legerLineExtension = legerLineExtension
        self.thinBarlineThickness = thinBarlineThickness
    }
}
