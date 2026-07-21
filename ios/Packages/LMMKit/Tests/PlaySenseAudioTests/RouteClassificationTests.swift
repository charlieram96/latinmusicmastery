import AVFoundation
import XCTest

@testable import PlaySenseAudio

/// Pure route-classification + typed-event mapping. No live session touched.
final class RouteClassificationTests: XCTestCase {

    func testOutputCategoriesForKnownPortTypes() {
        func assertCategory(_ port: AVAudioSession.Port, _ expected: AudioOutputCategory) {
            XCTAssertEqual(RouteClassifier.category(forPortType: port.rawValue), expected)
        }
        assertCategory(.builtInSpeaker, .builtInSpeaker)
        assertCategory(.builtInReceiver, .builtInReceiver)
        assertCategory(.headphones, .wiredHeadphones)
        assertCategory(.usbAudio, .usb)
        assertCategory(.airPlay, .airPlay)
        assertCategory(.carAudio, .carAudio)
        assertCategory(.HDMI, .hdmi)
        XCTAssertEqual(RouteClassifier.category(forPortType: "SomethingUnheardOf"), .other)
    }

    func testBluetoothVariantsAllClassifyAsBluetooth() {
        for port in [AVAudioSession.Port.bluetoothA2DP, .bluetoothHFP, .bluetoothLE] {
            let category = RouteClassifier.category(forPortType: port.rawValue)
            XCTAssertEqual(category, .bluetooth, "\(port.rawValue) should be bluetooth")
            XCTAssertTrue(category.isBluetooth)
        }
        XCTAssertFalse(AudioOutputCategory.wiredHeadphones.isBluetooth)
        XCTAssertFalse(AudioOutputCategory.airPlay.isBluetooth, "AirPlay is wireless but not Bluetooth audio")
    }

    func testRouteInfoPrimaryOutputAndBluetoothDetection() {
        let wired = RouteInfo(
            inputs: [RoutePortInfo(.builtInMic, name: "iPhone Mic")],
            outputs: [RoutePortInfo(.headphones, name: "Wired")]
        )
        XCTAssertEqual(wired.primaryOutputCategory, .wiredHeadphones)
        XCTAssertFalse(wired.isBluetoothOutput)

        let bluetooth = RouteInfo(
            inputs: [RoutePortInfo(.builtInMic, name: "iPhone Mic")],
            outputs: [RoutePortInfo(.bluetoothA2DP, name: "AirPods")]
        )
        XCTAssertEqual(bluetooth.primaryOutputCategory, .bluetooth)
        XCTAssertTrue(bluetooth.isBluetoothOutput)

        // Bluetooth present as a secondary output must still be detected.
        let mixed = RouteInfo(
            inputs: [],
            outputs: [RoutePortInfo(.builtInSpeaker, name: "Speaker"), RoutePortInfo(.bluetoothLE, name: "LE")]
        )
        XCTAssertEqual(mixed.primaryOutputCategory, .builtInSpeaker)
        XCTAssertTrue(mixed.isBluetoothOutput)

        let empty = RouteInfo(inputs: [], outputs: [])
        XCTAssertEqual(empty.primaryOutputCategory, .other)
        XCTAssertFalse(empty.isBluetoothOutput)
    }

    func testRouteChangeReasonMapping() {
        XCTAssertEqual(RouteChangeEvent(reason: .newDeviceAvailable), .newDeviceAvailable)
        XCTAssertEqual(RouteChangeEvent(reason: .oldDeviceUnavailable), .oldDeviceUnavailable)
        XCTAssertEqual(RouteChangeEvent(reason: .categoryChange), .categoryChange)
        XCTAssertEqual(RouteChangeEvent(reason: .override), .override)
        XCTAssertEqual(RouteChangeEvent(reason: .wakeFromSleep), .wokeFromSleep)
        XCTAssertEqual(RouteChangeEvent(reason: .noSuitableRouteForCategory), .noSuitableRouteForCategory)
        XCTAssertEqual(RouteChangeEvent(reason: .routeConfigurationChange), .routeConfigurationChange)
        XCTAssertEqual(RouteChangeEvent(reason: .unknown), .unknown)
    }

    func testInterruptionEventMapping() {
        XCTAssertEqual(InterruptionEvent(type: .began, options: []), .began)
        XCTAssertEqual(InterruptionEvent(type: .ended, options: []), .ended(shouldResume: false))
        XCTAssertEqual(InterruptionEvent(type: .ended, options: .shouldResume), .ended(shouldResume: true))
    }
}
