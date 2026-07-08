import CoreBluetooth
import XCTest

@testable import PlaySenseBLE

final class PlaySenseBLEReadingDecoderTests: XCTestCase {

    // MARK: - Decode

    func testDecodesValidReading() throws {
        let json = #"{"piezos":[0,120,0],"mic":45}"#
        let reading = try XCTUnwrap(PlaySenseBLEReadingDecoder.decode(Data(json.utf8)))
        XCTAssertEqual(reading.piezos, [0, 120, 0])
        XCTAssertEqual(reading.mic, 45)
        XCTAssertNil(reading.t)
    }

    func testMalformedJSONIsIgnored() {
        let json = "{not valid json"
        XCTAssertNil(PlaySenseBLEReadingDecoder.decode(Data(json.utf8)))
    }

    func testMissingPiezosIsIgnored() {
        let json = #"{"mic":10}"#
        XCTAssertNil(PlaySenseBLEReadingDecoder.decode(Data(json.utf8)))
    }

    func testNonArrayPiezosIsIgnored() {
        let json = #"{"piezos":"nope","mic":1}"#
        XCTAssertNil(PlaySenseBLEReadingDecoder.decode(Data(json.utf8)))
    }

    func testMultiPiezoReadingDecodesAllChannels() throws {
        let json = #"{"piezos":[50,0,80,0,0,0]}"#
        let reading = try XCTUnwrap(PlaySenseBLEReadingDecoder.decode(Data(json.utf8)))
        XCTAssertEqual(reading.piezos, [50, 0, 80, 0, 0, 0])
        XCTAssertEqual(reading.mic, 0, "missing mic defaults to 0, mirrors `Number(data.mic) || 0`")
    }

    func testOptionalTFieldDecodesWhenPresent() throws {
        let json = #"{"piezos":[10],"t":123.456}"#
        let reading = try XCTUnwrap(PlaySenseBLEReadingDecoder.decode(Data(json.utf8)))
        XCTAssertEqual(reading.t, 123.456)
    }

    func testOptionalTFieldIsNilWhenAbsent() throws {
        let json = #"{"piezos":[10]}"#
        let reading = try XCTUnwrap(PlaySenseBLEReadingDecoder.decode(Data(json.utf8)))
        XCTAssertNil(reading.t)
    }

    func testZeroPiezosStillDecodes() throws {
        // The decoder itself doesn't judge "is this a hit" — that's BLEOnsetSource's job (BLEOnsetSourceTests
        // covers "zero piezos → no onset events").
        let json = #"{"piezos":[0,0,0]}"#
        let reading = try XCTUnwrap(PlaySenseBLEReadingDecoder.decode(Data(json.utf8)))
        XCTAssertEqual(reading.piezos, [0, 0, 0])
    }

    func testNonNumericMicDoesNotFailTheWholeDecode() throws {
        // `Number(data.mic) || 0` in the web coerces ANY non-numeric mic to 0 without dropping the whole
        // reading; a strict Decodable struct would reject this key's type mismatch entirely, so the
        // JSONSerialization-based decoder is exercised here specifically.
        let json = #"{"piezos":[10],"mic":"garbage"}"#
        let reading = try XCTUnwrap(PlaySenseBLEReadingDecoder.decode(Data(json.utf8)))
        XCTAssertEqual(reading.piezos, [10])
        XCTAssertEqual(reading.mic, 0)
    }

    // MARK: - Device filter

    func testMatchesExactPeripheralName() {
        XCTAssertTrue(PlaySenseBLEProtocol.matches(name: "PlaySense", advertisementData: [:]))
    }

    func testMatchesAdvertisedLocalNameWhenPeripheralNameIsNil() {
        let adData: [String: Any] = [CBAdvertisementDataLocalNameKey: "PlaySense"]
        XCTAssertTrue(PlaySenseBLEProtocol.matches(name: nil, advertisementData: adData))
    }

    func testMatchesAdvertisedServiceUUIDEvenWithNonMatchingName() {
        let adData: [String: Any] = [CBAdvertisementDataServiceUUIDsKey: [PlaySenseBLEProtocol.serviceUUID]]
        XCTAssertTrue(PlaySenseBLEProtocol.matches(name: "SomeOtherDevice", advertisementData: adData))
    }

    func testDoesNotMatchUnrelatedDevice() {
        let adData: [String: Any] = [CBAdvertisementDataServiceUUIDsKey: [CBUUID(string: "FFFF")]]
        XCTAssertFalse(PlaySenseBLEProtocol.matches(name: "SomeOtherDevice", advertisementData: adData))
    }
}
