import LMMDesignSystem
import PlaySenseBLE
import SwiftUI

/// Device-list picker for PlaySense BLE mode select — shown ONLY when a scan finds more than one matching
/// peripheral (`SessionCoordinator.handleBLEDevicesChange` auto-connects a single match without ever
/// presenting this). The web has no equivalent screen of its own: `navigator.bluetooth.requestDevice()`
/// pops the BROWSER's native chooser. iOS has no OS-level picker for an app-scoped `CBCentralManager`
/// scan, so PlaySenseUI owns this one.
public struct DevicePickerSheet: View {
    let devices: [PlaySenseDeviceManager.DiscoveredDevice]
    let onSelect: (PlaySenseDeviceManager.DiscoveredDevice) -> Void

    public init(
        devices: [PlaySenseDeviceManager.DiscoveredDevice],
        onSelect: @escaping (PlaySenseDeviceManager.DiscoveredDevice) -> Void
    ) {
        self.devices = devices
        self.onSelect = onSelect
    }

    public var body: some View {
        VStack(spacing: LMMSpacing.md) {
            Text(lmmString("device.picker.title"))
                .font(LMMFont.headline)
                .foregroundStyle(.white)

            VStack(spacing: LMMSpacing.xs) {
                ForEach(devices) { device in
                    Button {
                        onSelect(device)
                    } label: {
                        HStack(spacing: LMMSpacing.xs) {
                            Image(systemName: "dot.radiowaves.left.and.right")
                            Text(device.name)
                            Spacer()
                        }
                        .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.lmmSecondary)
                }
            }
        }
        .padding(LMMSpacing.lg)
        .frame(maxWidth: 320)
        .background(RoundedRectangle(cornerRadius: LMMRadius.lg, style: .continuous).fill(LMMColor.surface))
        .overlay(
            RoundedRectangle(cornerRadius: LMMRadius.lg, style: .continuous)
                .strokeBorder(LMMColor.border, lineWidth: 1)
        )
    }
}
