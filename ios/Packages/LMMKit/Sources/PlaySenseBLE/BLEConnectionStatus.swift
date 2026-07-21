import Foundation

/// Port of `PlaysenseConnectionStatus` (`playsense-context.tsx`), with `scanning` added: the web's
/// `navigator.bluetooth.requestDevice()` shows the BROWSER's own device picker (no separate "scanning"
/// state the app can observe), while CoreBluetooth scanning is entirely app-driven, so iOS needs a
/// distinct status for "scan in flight, no device chosen yet" before `connecting` (a specific peripheral
/// is being connected to).
public enum BLEConnectionStatus: String, Equatable, Sendable, CaseIterable {
    case disconnected
    case scanning
    case connecting
    case connected
    case reconnecting
    case error
}

/// User-presentable copy for CoreBluetooth-level failures, mirroring the web's error-string style
/// (`playsense-context.tsx`'s `setError(...)` calls) even though Web Bluetooth doesn't expose the same
/// granularity (the browser handles adapter-off/unauthorized internally before `requestDevice` ever
/// resolves). `PlaySenseDeviceManager.errorMessage` is set to one of these alongside `connectionStatus =
/// .error`, the same two-field split the web uses (`connectionStatus` + separate `error: string | null`).
public enum PlaySenseBLEErrorMessage {
    public static let bluetoothPoweredOff = "Turn on Bluetooth to connect to your PlaySense device."
    public static let bluetoothUnauthorized =
        "Bluetooth access is required to connect to your PlaySense device. Enable it in Settings."
    public static let bluetoothUnsupported = "This device doesn't support Bluetooth Low Energy."
    public static let noDeviceFound = "No PlaySense device found."
    /// Verbatim port of `playsense-context.tsx`'s `onDisconnected` catch-block message — the ONE string
    /// the web and iOS share byte-for-byte, since both implement literally the same "one auto-reconnect
    /// attempt, then give up" semantics.
    public static let reconnectFailed = "PlaySense device disconnected and could not reconnect."
    /// Port of `connect()`'s catch-block fallback (`err instanceof Error ? err.message : 'Failed to
    /// connect to PlaySense device'`) for the case CoreBluetooth hands back no useful error description.
    public static let connectFailedFallback = "Failed to connect to PlaySense device."
}
