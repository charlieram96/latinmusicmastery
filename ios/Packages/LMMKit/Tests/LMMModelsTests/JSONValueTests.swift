import XCTest

@testable import LMMModels

/// `JSONValue` backs schemaless jsonb columns (`rich_content` and friends). It must
/// decode any legal JSON shape and round-trip through re-encoding without loss.
final class JSONValueTests: XCTestCase {
    func testDecodesNestedTipTapDocument() throws {
        let value = try FixtureLoader.decode(JSONValue.self, from: "rich_content.synthetic.json")

        guard case .object(let root) = value else {
            return XCTFail("Expected a top-level object")
        }
        XCTAssertEqual(root["type"], .string("doc"))
        guard case .array(let content) = root["content"] else {
            return XCTFail("Expected \"content\" to decode as an array")
        }
        XCTAssertEqual(content.count, 2)
        XCTAssertEqual(root["meta"], .null)
    }

    func testRoundTripsThroughReencoding() throws {
        let original = try FixtureLoader.decode(JSONValue.self, from: "rich_content.synthetic.json")

        let reencoded = try JSONEncoder().encode(original)
        let decodedAgain = try JSONDecoder().decode(JSONValue.self, from: reencoded)

        XCTAssertEqual(original, decodedAgain)
    }

    func testHandlesScalarCasesDirectly() throws {
        let decoder = JSONDecoder()
        XCTAssertEqual(try decoder.decode(JSONValue.self, from: Data("\"hello\"".utf8)), .string("hello"))
        XCTAssertEqual(try decoder.decode(JSONValue.self, from: Data("42.5".utf8)), .number(42.5))
        XCTAssertEqual(try decoder.decode(JSONValue.self, from: Data("true".utf8)), .bool(true))
        XCTAssertEqual(try decoder.decode(JSONValue.self, from: Data("null".utf8)), .null)
    }
}
