import AVFoundation
import Foundation

/// Owns AVAudioSession policy for PlaySense: category/mode configuration, mic-permission flow, route
/// inspection, and typed route/interruption events.
///
/// Policy (from the approved plan §Audio): `.playAndRecord` + `.measurement` mode + `.defaultToSpeaker`
/// with NO Bluetooth options — we deliberately do not opt Bluetooth in as an input/output route, so the
/// system prefers the built-in mic/speaker for low, predictable latency. Bluetooth *output* can still
/// appear (A2DP) and is detected via `currentRouteInfo.isBluetoothOutput`; D23 turns that into blocking
/// UX with a practice-mode escape hatch.
@MainActor
public final class AudioSessionController {

    /// Desired session parameters (readback of the actuals happens after `configure`).
    public struct DesiredConfig: Equatable, Sendable {
        public var preferredSampleRate: Double
        public var preferredIOBufferDuration: TimeInterval

        public init(preferredSampleRate: Double = 48_000, preferredIOBufferDuration: TimeInterval = 0.005) {
            self.preferredSampleRate = preferredSampleRate
            self.preferredIOBufferDuration = preferredIOBufferDuration
        }
    }

    /// The negotiated session parameters as reported back by the OS after activation.
    public struct ActualConfig: Equatable, Sendable {
        public let sampleRate: Double
        public let ioBufferDuration: TimeInterval
        public let inputLatency: TimeInterval
        public let outputLatency: TimeInterval
    }

    private let session: AVAudioSession
    private var observers: [NSObjectProtocol] = []

    /// Callback invoked (on the main actor) for every route/interruption/reset event.
    public var onEvent: ((AudioSessionEvent) -> Void)?

    public init(session: AVAudioSession = .sharedInstance()) {
        self.session = session
    }

    deinit {
        for observer in observers {
            NotificationCenter.default.removeObserver(observer)
        }
    }

    // MARK: - Configuration

    /// Configure and activate the session for graded play. Returns the OS-negotiated actuals.
    @discardableResult
    public func configure(_ config: DesiredConfig = DesiredConfig()) throws -> ActualConfig {
        try session.setCategory(.playAndRecord, mode: .measurement, options: [.defaultToSpeaker])
        try session.setPreferredSampleRate(config.preferredSampleRate)
        try session.setPreferredIOBufferDuration(config.preferredIOBufferDuration)
        try session.setActive(true)
        startObserving()
        return currentActualConfig()
    }

    /// Deactivate the session and stop observing route/interruption notifications.
    public func deactivate() {
        stopObserving()
        try? session.setActive(false, options: [.notifyOthersOnDeactivation])
    }

    /// The session parameters the OS actually granted.
    public func currentActualConfig() -> ActualConfig {
        ActualConfig(
            sampleRate: session.sampleRate,
            ioBufferDuration: session.ioBufferDuration,
            inputLatency: session.inputLatency,
            outputLatency: session.outputLatency
        )
    }

    // MARK: - Microphone permission

    /// Current record-permission state without prompting.
    public var recordPermission: AVAudioApplication.recordPermission {
        AVAudioApplication.shared.recordPermission
    }

    /// Request microphone permission, returning the grant result. Safe to call when already
    /// determined (the system resolves immediately).
    public func requestMicrophonePermission() async -> Bool {
        await withCheckedContinuation { continuation in
            AVAudioApplication.requestRecordPermission { granted in
                continuation.resume(returning: granted)
            }
        }
    }

    // MARK: - Route inspection

    /// A snapshot of the live route as testable value types.
    public var currentRouteInfo: RouteInfo {
        Self.routeInfo(from: session.currentRoute)
    }

    /// Convert an `AVAudioSessionRouteDescription` to the pure `RouteInfo` model.
    public static func routeInfo(from route: AVAudioSessionRouteDescription) -> RouteInfo {
        RouteInfo(
            inputs: route.inputs.map { RoutePortInfo(portType: $0.portType.rawValue, portName: $0.portName) },
            outputs: route.outputs.map { RoutePortInfo(portType: $0.portType.rawValue, portName: $0.portName) }
        )
    }

    // MARK: - Notifications

    private func startObserving() {
        guard observers.isEmpty else { return }
        let center = NotificationCenter.default

        observers.append(center.addObserver(
            forName: AVAudioSession.routeChangeNotification, object: session, queue: .main
        ) { [weak self] note in
            MainActor.assumeIsolated { self?.handleRouteChange(note) }
        })

        observers.append(center.addObserver(
            forName: AVAudioSession.interruptionNotification, object: session, queue: .main
        ) { [weak self] note in
            MainActor.assumeIsolated { self?.handleInterruption(note) }
        })

        observers.append(center.addObserver(
            forName: AVAudioSession.mediaServicesWereResetNotification, object: session, queue: .main
        ) { [weak self] _ in
            MainActor.assumeIsolated { self?.onEvent?(.mediaServicesReset) }
        })
    }

    private func stopObserving() {
        for observer in observers {
            NotificationCenter.default.removeObserver(observer)
        }
        observers.removeAll()
    }

    private func handleRouteChange(_ note: Notification) {
        let unknownRaw = AVAudioSession.RouteChangeReason.unknown.rawValue
        let raw = note.userInfo?[AVAudioSessionRouteChangeReasonKey] as? UInt ?? unknownRaw
        let reason = AVAudioSession.RouteChangeReason(rawValue: raw) ?? .unknown
        onEvent?(.routeChanged(RouteChangeEvent(reason: reason), route: currentRouteInfo))
    }

    private func handleInterruption(_ note: Notification) {
        guard
            let raw = note.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
            let type = AVAudioSession.InterruptionType(rawValue: raw)
        else { return }
        let optionsRaw = note.userInfo?[AVAudioSessionInterruptionOptionKey] as? UInt ?? 0
        let options = AVAudioSession.InterruptionOptions(rawValue: optionsRaw)
        guard let event = InterruptionEvent(type: type, options: options) else { return }
        onEvent?(.interruption(event))
    }
}
