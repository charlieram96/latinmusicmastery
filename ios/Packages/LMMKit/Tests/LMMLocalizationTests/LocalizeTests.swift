import XCTest

@testable import LMMLocalization

/// Unit tests for `Localize.pick`/`pickValue` — the pure overlay logic mirroring
/// `lib/i18n/localize.ts`'s `pick`/`hasValue`.
final class LocalizeTests: XCTestCase {
    // MARK: - String overlay (en non-optional)

    func testEsWinsWhenLocaleEsAndEsPresent() {
        XCTAssertEqual(Localize.pick(.es, "Hello", "Hola"), "Hola")
    }

    func testEnWinsWhenLocaleEn_evenIfEsPresent() {
        XCTAssertEqual(Localize.pick(.en, "Hello", "Hola"), "Hello")
    }

    func testEsBlankFallsBackToEn_wholeStringWhitespace() {
        XCTAssertEqual(Localize.pick(.es, "Hello", "   "), "Hello")
    }

    func testEsEmptyStringFallsBackToEn() {
        XCTAssertEqual(Localize.pick(.es, "Hello", ""), "Hello")
    }

    func testEsNilFallsBackToEn() {
        XCTAssertEqual(Localize.pick(.es, "Hello", nil), "Hello")
    }

    // MARK: - String overlay (en optional)

    func testOptionalEsWinsWhenPresent() {
        XCTAssertEqual(Localize.pick(.es, "desc-en", "desc-es"), "desc-es")
    }

    func testOptionalEnNilAndEsNilReturnsNil() {
        XCTAssertNil(Localize.pick(.es, Optional<String>.none, nil))
    }

    func testOptionalEnPassthroughWhenEsBlank() {
        XCTAssertEqual(Localize.pick(.es, Optional("desc-en"), "  "), "desc-en")
    }

    func testOptionalEnNilFallsBackToNilWhenEsAlsoBlank() {
        XCTAssertNil(Localize.pick(.es, Optional<String>.none, "  "))
    }

    // MARK: - Generic (non-string) overlay

    func testPickValueEsWinsWhenNonNil_regardlessOfEmptiness() {
        // Mirrors hasValue's "objects/arrays are always truthy" rule: an empty array still wins.
        let enValue = ["a", "b"]
        let esValue: [String] = []
        XCTAssertEqual(Localize.pickValue(.es, enValue, esValue), esValue)
    }

    func testPickValueFallsBackToEnWhenEsNil() {
        let enValue = ["a", "b"]
        let esValue: [String]? = nil
        XCTAssertEqual(Localize.pickValue(.es, enValue, esValue), enValue)
    }

    func testPickValueIgnoresEsWhenLocaleEn() {
        let enValue = ["a"]
        let esValue = ["b"]
        XCTAssertEqual(Localize.pickValue(.en, enValue, esValue), enValue)
    }

    func testPickValueBothNilReturnsNil() {
        let enValue: [String]? = nil
        let esValue: [String]? = nil
        XCTAssertNil(Localize.pickValue(.es, enValue, esValue))
    }
}
