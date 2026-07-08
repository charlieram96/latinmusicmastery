import LMMData
import LMMDesignSystem
import LMMLocalization
import LMMModels
import SwiftUI

/// instrument_assembly: percentage-positioned drop zones over a background image, with draggable
/// part chips. Uses SwiftUI's native `.draggable`/`.dropDestination(for: String.self)` (the part
/// id is the payload) rather than a manual gesture-tracking port of the web's dnd-kit setup.
/// Tapping an already-placed part (when not graded) is the "clear affordance" that sends it back
/// to the tray — since a plain tap can't conflict with a drag gesture the way it might on the web.
struct QuizInstrumentAssemblyQuestionView: View {
    let question: QuizQuestion
    let locale: AppLocale
    let answer: QuizAnswer
    let isGraded: Bool
    let onChange: (QuizAnswer) -> Void

    var body: some View {
        let opts = question.displayOptions(locale)
        let zones = opts?.zones ?? []
        let parts = opts?.parts ?? []
        let placement: [String: String] = {
            if case .assembly(let value) = answer { return value }
            return [:]
        }()
        let partById = Dictionary(
            uniqueKeysWithValues: parts.compactMap { part -> (String, QuizOptions.AssemblyPart)? in
                guard let id = part.id else { return nil }
                return (id, part)
            }
        )
        let unplaced = parts.filter { placement[$0.id ?? ""] == nil }

        VStack(alignment: .leading, spacing: LMMSpacing.md) {
            GeometryReader { proxy in
                ZStack(alignment: .topLeading) {
                    background
                    ForEach(Array(zones.enumerated()), id: \.offset) { _, zone in
                        zoneView(zone, canvasSize: proxy.size, parts: parts, placement: placement, partById: partById)
                    }
                }
            }
            .aspectRatio(16.0 / 9.0, contentMode: .fit)
            .background(RoundedRectangle(cornerRadius: LMMRadius.lg, style: .continuous).fill(LMMColor.surfaceSunken))
            .clipShape(RoundedRectangle(cornerRadius: LMMRadius.lg, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: LMMRadius.lg, style: .continuous)
                    .strokeBorder(LMMColor.border, lineWidth: 1)
            )

            if !unplaced.isEmpty {
                VStack(alignment: .leading, spacing: LMMSpacing.xs) {
                    Text(lmmString("quiz.assembly.dragHint"))
                        .font(LMMFont.caption)
                        .foregroundStyle(LMMColor.mutedForeground)
                    QuizFlowLayout(spacing: 8) {
                        ForEach(unplaced, id: \.id) { part in
                            partChip(part, state: .idle)
                                .draggable(part.id ?? "")
                        }
                    }
                }
                .padding(LMMSpacing.sm)
                .background(RoundedRectangle(cornerRadius: LMMRadius.md, style: .continuous).fill(LMMColor.surface))
                .overlay(
                    RoundedRectangle(cornerRadius: LMMRadius.md, style: .continuous)
                        .strokeBorder(LMMColor.border, lineWidth: 1)
                )
            }
        }
    }

    @ViewBuilder
    private var background: some View {
        if let urlString = question.imageUrl, let url = URL(string: urlString) {
            AsyncImage(url: url) { phase in
                if let image = phase.image {
                    image.resizable().scaledToFill()
                } else {
                    Color.clear
                }
            }
        } else {
            Color.clear
        }
    }

    private func zoneView(
        _ zone: QuizOptions.AssemblyZone,
        canvasSize: CGSize,
        parts: [QuizOptions.AssemblyPart],
        placement: [String: String],
        partById: [String: QuizOptions.AssemblyPart]
    ) -> some View {
        let originX = (zone.x ?? 0) / 100 * canvasSize.width
        let originY = (zone.y ?? 0) / 100 * canvasSize.height
        let width = (zone.width ?? 20) / 100 * canvasSize.width
        let height = (zone.height ?? 20) / 100 * canvasSize.height
        let placedHere = parts.filter { placement[$0.id ?? ""] == zone.id }

        return VStack(spacing: 2) {
            Text(zone.label ?? "")
                .font(.system(size: 9, weight: .semibold))
                .textCase(.uppercase)
                .foregroundStyle(LMMColor.mutedForeground)
                .lineLimit(1)
            QuizFlowLayout(spacing: 4) {
                ForEach(placedHere, id: \.id) { part in
                    partChip(part, state: partState(part))
                        .draggable(part.id ?? "")
                        .onTapGesture {
                            guard !isGraded else { return }
                            var next = placement
                            next.removeValue(forKey: part.id ?? "")
                            onChange(.assembly(next))
                        }
                }
            }
        }
        .padding(4)
        .frame(width: max(width, 40), height: max(height, 40), alignment: .center)
        .background(
            RoundedRectangle(cornerRadius: LMMRadius.sm, style: .continuous)
                .strokeBorder(LMMColor.primary.opacity(0.5), style: StrokeStyle(lineWidth: 1.5, dash: [4, 3]))
                .background(
                    RoundedRectangle(cornerRadius: LMMRadius.sm, style: .continuous)
                        .fill(LMMColor.primary.opacity(0.06))
                )
        )
        .position(x: originX + max(width, 40) / 2, y: originY + max(height, 40) / 2)
        .dropDestination(for: String.self) { droppedIds, _ in
            guard !isGraded, let partId = droppedIds.first, let zoneId = zone.id else { return false }
            var next = placement
            next[partId] = zoneId
            onChange(.assembly(next))
            return true
        }
    }

    private func partState(_ part: QuizOptions.AssemblyPart) -> QuizTileState {
        guard isGraded, let id = part.id, let placedZone = currentPlacement[id] else { return .idle }
        return placedZone == part.correctZoneId ? .correct : .incorrect
    }

    private var currentPlacement: [String: String] {
        if case .assembly(let value) = answer { return value }
        return [:]
    }

    private func partChip(_ part: QuizOptions.AssemblyPart, state: QuizTileState) -> some View {
        HStack(spacing: 4) {
            if let urlString = part.imageUrl, let url = URL(string: urlString), !urlString.isEmpty {
                AsyncImage(url: url) { phase in
                    if let image = phase.image {
                        image.resizable().scaledToFit()
                    } else {
                        Color.clear
                    }
                }
                .frame(width: 20, height: 20)
            }
            Text(part.label ?? "")
                .font(.system(size: 11, weight: .medium))
                .lineLimit(1)
        }
        .padding(.horizontal, 6)
        .padding(.vertical, 4)
        .background(
            RoundedRectangle(cornerRadius: LMMRadius.sm, style: .continuous).fill(chipFill(state))
        )
        .overlay(
            RoundedRectangle(cornerRadius: LMMRadius.sm, style: .continuous)
                .strokeBorder(chipBorder(state), lineWidth: 1.5)
        )
    }

    private func chipFill(_ state: QuizTileState) -> Color {
        switch state {
        case .correct: return LMMColor.success.opacity(0.15)
        case .incorrect: return LMMColor.destructive.opacity(0.15)
        default: return LMMColor.surface
        }
    }

    private func chipBorder(_ state: QuizTileState) -> Color {
        switch state {
        case .correct: return LMMColor.success
        case .incorrect: return LMMColor.destructive
        default: return LMMColor.border
        }
    }
}
