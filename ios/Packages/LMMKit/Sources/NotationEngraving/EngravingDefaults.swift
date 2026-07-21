import Foundation

/// The subset of SMuFL's `engravingDefaults` (staff-space line-thickness constants) this
/// engraving engine currently draws with. All values are in staff spaces. More fields
/// (`hairpinThickness`, `tupletBracketThickness`, ...) can be added here as later tasks need
/// them — see the full list in `bravura_metadata.json`'s `engravingDefaults` object.
public struct EngravingDefaults: Equatable {
    public let staffLineThickness: StaffSpaces
    public let stemThickness: StaffSpaces
    public let beamThickness: StaffSpaces
    /// Vertical gap between the near edges of two stacked beams (primary → secondary), staff
    /// spaces. SMuFL's `beamSpacing`.
    public let beamSpacing: StaffSpaces
    public let legerLineThickness: StaffSpaces
    public let legerLineExtension: StaffSpaces
    public let thinBarlineThickness: StaffSpaces
    /// Thickness of a tuplet bracket, staff spaces. SMuFL's `tupletBracketThickness`.
    public let tupletBracketThickness: StaffSpaces
    /// Thickness at the fat middle of a tie/slur, staff spaces. SMuFL's `tieMidpointThickness`.
    public let tieMidpointThickness: StaffSpaces

    public init(
        staffLineThickness: StaffSpaces,
        stemThickness: StaffSpaces,
        beamThickness: StaffSpaces,
        beamSpacing: StaffSpaces,
        legerLineThickness: StaffSpaces,
        legerLineExtension: StaffSpaces,
        thinBarlineThickness: StaffSpaces,
        tupletBracketThickness: StaffSpaces,
        tieMidpointThickness: StaffSpaces
    ) {
        self.staffLineThickness = staffLineThickness
        self.stemThickness = stemThickness
        self.beamThickness = beamThickness
        self.beamSpacing = beamSpacing
        self.legerLineThickness = legerLineThickness
        self.legerLineExtension = legerLineExtension
        self.thinBarlineThickness = thinBarlineThickness
        self.tupletBracketThickness = tupletBracketThickness
        self.tieMidpointThickness = tieMidpointThickness
    }
}
