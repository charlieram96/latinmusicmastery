import CoreGraphics
import CoreText
import Foundation

/// Errors thrown while loading or querying the bundled Bravura font.
public enum BravuraFontError: Error, Equatable {
    /// `Bravura.otf` wasn't found in the NotationEngraving resource bundle.
    case resourceNotFound
    /// The font data couldn't be parsed into a `CTFontDescriptor`.
    case descriptorCreationFailed
}

/// Loads `Bravura.otf` from the NotationEngraving resource bundle and vends CoreText glyph
/// indices for SMuFL codepoints.
///
/// Loaded via `CTFontManagerCreateFontDescriptorsFromData`, not `CTFontManagerRegisterFontURLs`
/// — the descriptor is built directly from the bundled font's bytes, so the font is never
/// registered into the process-wide font manager. That keeps it a self-contained package
/// resource (no `UIAppFonts`/Info.plist wiring) and makes repeated loads (e.g. across test
/// runs in the same process) side-effect-free.
public final class BravuraFont {
    /// Loads the real, bundled Bravura.otf once per process. Traps if the package's own font
    /// resource is missing or malformed — a packaging defect, not a recoverable runtime state.
    public static let shared: BravuraFont = {
        do {
            return try BravuraFont()
        } catch {
            fatalError("Failed to load bundled Bravura.otf: \(error)")
        }
    }()

    private let descriptor: CTFontDescriptor

    /// Parses `data` as OpenType font data. Pure aside from the CoreText call — no `Bundle`
    /// lookup — so a caller could in principle load a different SMuFL font the same way.
    public init(data: Data) throws {
        guard
            let descriptors = CTFontManagerCreateFontDescriptorsFromData(data as CFData) as? [CTFontDescriptor],
            let first = descriptors.first
        else {
            throw BravuraFontError.descriptorCreationFailed
        }
        descriptor = first
    }

    /// Loads `Bravura.otf` from the NotationEngraving resource bundle.
    public convenience init() throws {
        guard let url = Bundle.module.url(forResource: "Bravura", withExtension: "otf") else {
            throw BravuraFontError.resourceNotFound
        }
        try self.init(data: Data(contentsOf: url))
    }

    /// A `CTFont` instance at the given point size. Per SMuFL convention (see `ScaleContext`),
    /// `size` should be `4 * staffSpacePoints` for glyphs to land at their documented
    /// staff-space metrics.
    public func ctFont(size: CGFloat) -> CTFont {
        CTFontCreateWithFontDescriptor(descriptor, size, nil)
    }

    /// Resolves a glyph's `CGGlyph` index at a representative size (glyph indices are stable
    /// across point sizes for a given font, so the size here only needs to be nonzero).
    /// Returns `nil` if the font has no glyph mapped to this codepoint — every catalog glyph
    /// is asserted to resolve in `GlyphCatalogTests`.
    public func glyphIndex(for codepoint: UnicodeScalar, size: CGFloat = 24) -> CGGlyph? {
        let font = ctFont(size: size)
        var unichar = UniChar(codepoint.value)
        var glyph = CGGlyph()
        let success = withUnsafePointer(to: &unichar) { charPointer in
            withUnsafeMutablePointer(to: &glyph) { glyphPointer in
                CTFontGetGlyphsForCharacters(font, charPointer, glyphPointer, 1)
            }
        }
        return success && glyph != 0 ? glyph : nil
    }
}
