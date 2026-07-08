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
            if let error = coordinator.errorMessage {
                Text(error)
                    .font(LMMFont.caption).foregroundStyle(LMMColor.destructive).multilineTextAlignment(.center)
            }
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
