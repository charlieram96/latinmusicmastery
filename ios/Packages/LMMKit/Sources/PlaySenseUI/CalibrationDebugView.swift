#if DEBUG
import LMMDesignSystem
import PlaySenseAudio
import SwiftUI

/// DEBUG-only harness for D22: launches the real `CalibrationWizardView` and lists/clears whatever
/// `CalibrationStore` currently holds across every (source, route) calibrated so far (same pattern as
/// `PlaySenseAudioDebugView`, reached from a `#if DEBUG` row on the Profile tab).
public struct CalibrationDebugView: View {
    @State private var records: [CalibrationRecord] = []

    public init() {}

    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: LMMSpacing.md) {
                NavigationLink {
                    // Defaults to `sourceType: .mic` — the `.ble` wizard path D25 fixed (it used to
                    // silently calibrate against the mic even when asked for BLE) is currently UNREACHABLE
                    // from this production debug row, or any other live UI, since nothing passes
                    // `sourceType: .ble` here. It becomes reachable once D26/D27 wire a real BLE-mode
                    // calibration entry point into the live session.
                    CalibrationWizardView()
                } label: {
                    Text("Run calibration wizard").frame(maxWidth: .infinity)
                }
                .buttonStyle(.lmmPrimary)

                Text("Stored calibrations")
                    .font(LMMFont.headline)
                    .foregroundStyle(LMMColor.foreground)

                if records.isEmpty {
                    Text("No calibration stored yet.")
                        .font(LMMFont.subheadline)
                        .foregroundStyle(LMMColor.mutedForeground)
                } else {
                    VStack(spacing: 0) {
                        ForEach(Array(records.enumerated()), id: \.offset) { index, record in
                            recordRow(record)
                            if index < records.count - 1 {
                                Divider().overlay(LMMColor.border)
                            }
                        }
                    }
                    .background(
                        RoundedRectangle(cornerRadius: LMMRadius.md, style: .continuous).fill(LMMColor.surface)
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: LMMRadius.md, style: .continuous)
                            .strokeBorder(LMMColor.border, lineWidth: 1)
                    )

                    Button("Clear all") {
                        CalibrationStore.clearAll()
                        refresh()
                    }
                    .buttonStyle(.lmmSecondary)
                }
            }
            .padding(LMMSpacing.screen)
        }
        .background(LMMColor.background)
        .navigationTitle("Calibration Debug")
        .onAppear { refresh() }
    }

    private func recordRow(_ record: CalibrationRecord) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: LMMSpacing.xxs) {
                Text("\(record.sourceType.rawValue.uppercased()) · \(record.routeKey)")
                    .font(.system(.footnote, design: .monospaced))
                    .foregroundStyle(LMMColor.foreground)
                    .lineLimit(1)
                Text(String(
                    format: "%.1fms offset · %.1fms IQR · %d samples",
                    record.offsetMs, record.iqrMs, record.sampleCount
                ))
                .font(LMMFont.caption)
                .foregroundStyle(LMMColor.mutedForeground)
            }
            Spacer()
            Button("Clear") {
                CalibrationStore.clear(sourceType: record.sourceType, routeKey: record.routeKey)
                refresh()
            }
            .buttonStyle(.lmmSecondary)
            .fixedSize()
        }
        .padding(LMMSpacing.sm)
    }

    private func refresh() {
        records = CalibrationStore.allRecords()
    }
}
#endif
