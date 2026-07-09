import LMMDesignSystem
import PlaySenseBLE
import SwiftUI

/// D25's PlaySense BLE mode-select + connecting-device screens. Split into its own file (an extension, not
/// a nested type) purely to keep `StagePlayerView`'s primary declaration under SwiftLint's
/// `type_body_length`/`file_length` caps — same reason `CalibrationWizardView`'s `.failure`/`.interrupted`
/// content lives in `CalibrationWizardView+Errors.swift`; no behavioral significance.
extension StagePlayerView {

    // MARK: - Mode select (real, interactive; shown only when `startMode == nil`)

    var modeSelectOverlay: some View {
        VStack(spacing: LMMSpacing.lg) {
            Spacer()
            VStack(spacing: LMMSpacing.sm) {
                Text(exercise.title)
                    .font(LMMFont.title2).foregroundStyle(.white)
                    .multilineTextAlignment(.center)
                Text("Choose your input").font(LMMFont.caption).foregroundStyle(.white.opacity(0.6))
            }
            // Fix round 1 (D25's review, finding 2): a BLE connect failure bounces back to `.modeSelect`
            // (`SessionCoordinator.handleBLEStatusChange`'s `.error` branch sets `errorMessage` THEN
            // `deviceConnectFailed()`) — this used to render nowhere, so the failure was silently swallowed.
            // Same `setupOverlay` styling (StagePlayerView.swift). Cleared on the next mode pick/retry by
            // `SessionCoordinator.selectMode(_:)`.
            if let error = coordinator.errorMessage {
                Text(error).font(LMMFont.caption).foregroundStyle(LMMColor.destructive).multilineTextAlignment(.center)
            }
            VStack(spacing: LMMSpacing.xs) {
                Button("Headphones") { chooseMicMode(.headphones) }.buttonStyle(.lmmPrimary)
                Button("Speaker-safe") { chooseMicMode(.speakerSafe) }.buttonStyle(.lmmSecondary)
                Button("PlaySense (BLE)") { choosePlaysenseMode() }.buttonStyle(.lmmSecondary)
            }
            Spacer()
        }
        .padding(LMMSpacing.screen)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(.black.opacity(0.45))
    }

    /// Mirrors `setUpIfNeeded`'s bypass for the two mic modes: `selectMode` alone only reaches
    /// `.calibrationCheck` (no wizard is wired into the live session for any source type yet — see
    /// `SessionCoordinator.beginBLEModeSelect`'s doc comment), so `calibrationResolved()` advances the rest
    /// of the way to `.ready`.
    func chooseMicMode(_ mode: SessionAudioMode) {
        coordinator.selectMode(mode)
        coordinator.calibrationResolved()
    }

    func choosePlaysenseMode() {
        #if DEBUG
        if debugForceMultipleDevices {
            coordinator.debugShowPlaysenseDevicePicker()
            return
        }
        #endif
        coordinator.selectMode(.playsense)
    }

    // MARK: - Connecting device (BLE scan/connect/subscribe + device picker)

    var connectingDeviceOverlay: some View {
        VStack(spacing: LMMSpacing.lg) {
            Spacer()
            if coordinator.bleDiscoveredDevices.count > 1 {
                DevicePickerSheet(devices: coordinator.bleDiscoveredDevices) { device in
                    coordinator.selectBLEDevice(device)
                }
            } else {
                ProgressView().tint(.white)
                Text(connectingStatusText)
                    .font(LMMFont.subheadline).foregroundStyle(.white.opacity(0.8))
            }
            // D27 ledger cleanup: this overlay does NOT render `coordinator.errorMessage` — it can't ever be
            // non-nil while this overlay is showing. `handleBLEStatusChange`'s `.error` case sets
            // `errorMessage` and calls `machine.deviceConnectFailed()` synchronously, in the same call, which
            // moves `machine.phase` away from `.connectingDevice` before SwiftUI's next render; `overlay`
            // (`StagePlayerView.swift`) switches on that same phase, so by the time a render happens with the
            // new `errorMessage`, `.connectingDevice`'s branch (this overlay) is no longer selected —
            // `modeSelectOverlay` (where phase lands instead) is what actually renders it, and does. Verified
            // by grepping every `errorMessage =` assignment: the BLE flow's only write site is the one above.
            // Fix round 1 (D25's review, finding 3): the scan/connect flow previously had no escape hatch —
            // stuck on a real device that's slow/never found meant no way back to `.modeSelect` short of
            // leaving the screen entirely. Stops the scan (`SessionCoordinator.cancelBLEConnect()`) rather
            // than reporting a failure.
            Button("Cancel") { coordinator.cancelBLEConnect() }.buttonStyle(.lmmSecondary)
            Spacer()
        }
        .padding(LMMSpacing.screen)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(.black.opacity(0.45))
    }

    var connectingStatusText: String {
        switch coordinator.bleConnectionStatus {
        case .scanning: return "Searching for PlaySense device…"
        case .connecting: return "Connecting…"
        case .reconnecting: return "Reconnecting…"
        default: return "Connecting to PlaySense…"
        }
    }
}
