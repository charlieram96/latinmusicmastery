import AVFoundation
import Foundation

/// A testable snapshot of one audio port, decoupled from `AVAudioSessionPortDescription` (which can
/// only be constructed by the live session). `portType` holds an `AVAudioSession.Port` raw value.
public struct RoutePortInfo: Equatable, Sendable {
    public let portType: String
    public let portName: String

    public init(portType: String, portName: String) {
        self.portType = portType
        self.portName = portName
    }

    public init(_ port: AVAudioSession.Port, name: String) {
        self.init(portType: port.rawValue, portName: name)
    }
}

/// Coarse category of an output route, sufficient for D20's "is this route latency-safe for grading?"
/// question. The blocking UX itself lands in D23; here we only classify.
public enum AudioOutputCategory: String, Equatable, Sendable {
    case builtInSpeaker
    case builtInReceiver
    case wiredHeadphones
    case usb
    case bluetooth
    case airPlay
    case carAudio
    case hdmi
    case other

    /// Bluetooth audio adds unpredictable latency and (for HFP) degrades mic capture — D23 blocks it
    /// during graded takes, with a practice-mode escape hatch.
    public var isBluetooth: Bool { self == .bluetooth }
}

/// A snapshot of the current route's inputs and outputs.
public struct RouteInfo: Equatable, Sendable {
    public let inputs: [RoutePortInfo]
    public let outputs: [RoutePortInfo]

    public init(inputs: [RoutePortInfo], outputs: [RoutePortInfo]) {
        self.inputs = inputs
        self.outputs = outputs
    }

    /// The category of the primary (first) output port, or `.other` if there is none.
    public var primaryOutputCategory: AudioOutputCategory {
        guard let first = outputs.first else { return .other }
        return RouteClassifier.category(forPortType: first.portType)
    }

    /// True if ANY output port is a Bluetooth audio route.
    public var isBluetoothOutput: Bool {
        outputs.contains { RouteClassifier.category(forPortType: $0.portType).isBluetooth }
    }
}

/// Pure mapping from `AVAudioSession.Port` raw values to `AudioOutputCategory`.
public enum RouteClassifier {
    public static func category(forPortType portType: String) -> AudioOutputCategory {
        switch portType {
        case AVAudioSession.Port.builtInSpeaker.rawValue: return .builtInSpeaker
        case AVAudioSession.Port.builtInReceiver.rawValue: return .builtInReceiver
        case AVAudioSession.Port.headphones.rawValue: return .wiredHeadphones
        case AVAudioSession.Port.usbAudio.rawValue: return .usb
        case AVAudioSession.Port.bluetoothA2DP.rawValue,
             AVAudioSession.Port.bluetoothHFP.rawValue,
             AVAudioSession.Port.bluetoothLE.rawValue:
            return .bluetooth
        case AVAudioSession.Port.airPlay.rawValue: return .airPlay
        case AVAudioSession.Port.carAudio.rawValue: return .carAudio
        case AVAudioSession.Port.HDMI.rawValue: return .hdmi
        default: return .other
        }
    }
}

// MARK: - Typed session events

/// Why the route changed, mapped from `AVAudioSession.RouteChangeReason`.
public enum RouteChangeEvent: Equatable, Sendable {
    case newDeviceAvailable
    case oldDeviceUnavailable
    case categoryChange
    case override
    case wokeFromSleep
    case noSuitableRouteForCategory
    case routeConfigurationChange
    case unknown

    public init(reason: AVAudioSession.RouteChangeReason) {
        switch reason {
        case .newDeviceAvailable: self = .newDeviceAvailable
        case .oldDeviceUnavailable: self = .oldDeviceUnavailable
        case .categoryChange: self = .categoryChange
        case .override: self = .override
        case .wakeFromSleep: self = .wokeFromSleep
        case .noSuitableRouteForCategory: self = .noSuitableRouteForCategory
        case .routeConfigurationChange: self = .routeConfigurationChange
        case .unknown: self = .unknown
        @unknown default: self = .unknown
        }
    }
}

/// Whether an audio interruption began or ended (and whether the system suggests resuming).
public enum InterruptionEvent: Equatable, Sendable {
    case began
    case ended(shouldResume: Bool)

    public init?(type: AVAudioSession.InterruptionType, options: AVAudioSession.InterruptionOptions) {
        switch type {
        case .began: self = .began
        case .ended: self = .ended(shouldResume: options.contains(.shouldResume))
        @unknown default: return nil
        }
    }
}

/// The union of session events the controller surfaces to callers.
public enum AudioSessionEvent: Equatable, Sendable {
    case routeChanged(RouteChangeEvent, route: RouteInfo)
    case interruption(InterruptionEvent)
    case mediaServicesReset
}
