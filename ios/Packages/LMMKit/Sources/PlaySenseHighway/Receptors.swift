// Single-letter geometry/time variables (x, y, t, dt, i, rx, ry, sx, sy, …) are ported 1:1 from
// the web glass-highway reference, where they read clearest; identifier_name is scoped off here.
// swiftlint:disable identifier_name
import PlaySenseCore
import SpriteKit
import UIKit

// Port of `components/play-sense/glass-highway/Receptors.ts`.
//
// What lanes land on. ``GlassPads`` — etched glass pads tinted per surface with uppercase labels;
// ``PianoKeyboard`` — a real 88-key keyboard under the hit line, keys light up. Both expose
// `flash(lane:grade:)` and a per-frame `update(dt:)` that decays flashes. Coordinate convention:
// scene y = `-webY` (see ``SceneBackground``).

public protocol ReceptorRenderer: AnyObject {
    var container: SKNode { get }
    func resize(layout: LaneLayout, hitY: Double, width: Double, height: Double)
    func flash(lane: Int, grade: HitGradeKind)
    func update(_ dt: Double)
    func setStyle(_ style: GlassStyle)
}

private struct FlashState {
    let node: SKShapeNode
    var energy: Double
    var color: UInt32
}

func receptorFont(size: CGFloat, weight: UIFont.Weight = .semibold) -> UIFont {
    UIFont.systemFont(ofSize: size, weight: weight)
}

// MARK: - Etched glass pads

public final class GlassPads: ReceptorRenderer {
    public let container = SKNode()

    private let padsNode = SKNode()
    private var labels: [SKLabelNode] = []
    private var flashes: [FlashState] = []
    private var style: GlassStyle
    private var layout: LaneLayout?
    private var hitY: Double = 0
    private var padH: Double = 0

    public init(style: GlassStyle) {
        self.style = style
        container.addChild(padsNode)
    }

    public func setStyle(_ style: GlassStyle) { self.style = style; if layout != nil { redraw() } }

    public func resize(layout: LaneLayout, hitY: Double, width: Double, height: Double) {
        self.layout = layout
        self.hitY = hitY
        self.padH = min(34, (height - hitY) * 0.34)
        redraw()
    }

    private func redraw() {
        guard let layout else { return }
        padsNode.removeAllChildren()

        // Rebuild labels + flash overlays when the lane count changes.
        if labels.count != layout.laneCount {
            labels.forEach { $0.removeFromParent() }
            flashes.forEach { $0.node.removeFromParent() }
            labels = []
            flashes = []
            for _ in 0..<layout.laneCount {
                let label = SKLabelNode()
                label.verticalAlignmentMode = .center
                label.horizontalAlignmentMode = .center
                container.addChild(label)
                labels.append(label)

                let flash = SKShapeNode()
                flash.isHidden = true
                flash.blendMode = .add
                flash.lineWidth = 2
                container.addChild(flash)
                flashes.append(FlashState(node: flash, energy: 0, color: 0xFFFFFF))
            }
        }

        let yTop = hitY + 10 // web-space top of pad
        for i in 0..<layout.laneCount {
            let cx = layout.laneCenterX(i)
            let w = layout.noteWidth(i) * 1.25
            let color = layout.laneColor(i)
            let rect = CGRect(x: cx - w / 2, y: -(yTop + padH), width: w, height: padH)

            let pad = SKShapeNode(rect: rect, cornerRadius: 7)
            pad.fillColor = highwayColor(color, alpha: style.padFillAlpha)
            pad.strokeColor = highwayColor(color, alpha: style.padStrokeAlpha)
            pad.lineWidth = 1
            padsNode.addChild(pad)

            let edge = SKShapeNode(rect: CGRect(x: cx - w / 2 + 2, y: -(yTop + 5), width: w - 4, height: 3),
                                   cornerRadius: 2)
            edge.fillColor = UIColor(white: 1, alpha: 0.07)
            edge.strokeColor = .clear
            padsNode.addChild(edge)

            let label = labels[i]
            configureLabel(label, text: layout.laneLabel(i), maxWidth: w - 8)
            label.position = CGPoint(x: cx, y: -(yTop + padH / 2))
            label.alpha = 0.55
        }
    }

    private func configureLabel(_ label: SKLabelNode, text: String, maxWidth: Double) {
        label.text = text
        label.fontName = "HelveticaNeue-Bold"
        label.fontSize = 10
        label.fontColor = highwayColor(0xFFF6E6)
        label.xScale = 1
        label.yScale = 1
        let width = label.frame.width
        if width > maxWidth, width > 0 {
            let scale = max(0.6, maxWidth / width)
            label.xScale = scale
            label.yScale = scale
        }
    }

    public func flash(lane: Int, grade: HitGradeKind) {
        guard let layout, lane >= 0, lane < flashes.count else { return }
        let color = grade == .miss ? HighwayPalette.missRed : (HighwayPalette.gradeColors[grade] ?? 0xFFFFFF)
        flashes[lane].energy = 1
        flashes[lane].color = color
        let cx = layout.laneCenterX(lane)
        let w = layout.noteWidth(lane) * 1.25
        let yTop = hitY + 10
        let node = flashes[lane].node
        node.path = UIBezierPath(roundedRect: CGRect(x: cx - w / 2, y: -(yTop + padH), width: w, height: padH),
                                 cornerRadius: 7).cgPath
        node.fillColor = highwayColor(color)
        node.strokeColor = highwayColor(color, alpha: 0.8)
    }

    public func update(_ dt: Double) {
        for i in flashes.indices {
            if flashes[i].energy <= 0 { flashes[i].node.isHidden = true; continue }
            flashes[i].energy = max(0, flashes[i].energy - dt * 4)
            flashes[i].node.isHidden = false
            flashes[i].node.alpha = style.padFlashAlpha * flashes[i].energy * flashes[i].energy
        }
    }
}

// MARK: - 88-key piano keyboard

private let whiteKeyColor: UInt32 = 0xF1ECE6
private let whiteKeyShadow: UInt32 = 0xB9B0A4
private let blackKeyColor: UInt32 = 0x14100D
private let blackKeyHi: UInt32 = 0x3A3027

public final class PianoKeyboard: ReceptorRenderer {
    public let container = SKNode()

    private let boardNode = SKNode()
    private var lights: [FlashState] = []
    private var style: GlassStyle
    private var layout: PianoLaneLayout?
    private var hitY: Double = 0
    private var kbH: Double = 0

    public init(style: GlassStyle) {
        self.style = style
        container.addChild(boardNode)
    }

    public func setStyle(_ style: GlassStyle) { self.style = style; if layout != nil { redraw() } }

    public func resize(layout: LaneLayout, hitY: Double, width: Double, height: Double) {
        guard let piano = layout as? PianoLaneLayout else { return }
        self.layout = piano
        self.hitY = hitY
        self.kbH = min(110, max(48, (height - hitY) * 0.74))
        redraw()
    }

    private func rect(cx: Double, w: Double, top: Double, h: Double) -> CGRect {
        CGRect(x: cx - w / 2, y: -(top + h), width: w, height: h)
    }

    private func redraw() {
        guard let layout else { return }
        boardNode.removeAllChildren()
        let yTop = hitY + 6
        let whiteW = layout.whiteKeyWidth()
        let detailed = whiteW >= 6

        // White keys.
        for lane in 0..<layout.laneCount where !isBlackKey(layout.midiForLane(lane)) {
            let cx = layout.laneCenterX(lane)
            let w = whiteW - (detailed ? 1 : 0.5)
            let key = SKShapeNode(rect: rect(cx: cx, w: w, top: yTop, h: kbH), cornerRadius: detailed ? 2.5 : 0)
            key.fillColor = highwayColor(whiteKeyColor)
            key.strokeColor = .clear
            boardNode.addChild(key)
            if detailed {
                let lip = SKShapeNode(rect: rect(cx: cx, w: w, top: yTop + kbH - 4, h: 4), cornerRadius: 2)
                lip.fillColor = highwayColor(whiteKeyShadow, alpha: 0.6)
                lip.strokeColor = .clear
                boardNode.addChild(lip)
            }
        }

        // Black keys on top.
        let blackH = kbH * 0.62
        for lane in 0..<layout.laneCount where isBlackKey(layout.midiForLane(lane)) {
            let cx = layout.laneCenterX(lane)
            let w = max(layout.noteWidth(lane) / 0.9, 2)
            let key = SKShapeNode(rect: rect(cx: cx, w: w, top: yTop, h: blackH), cornerRadius: detailed ? 2 : 0)
            key.fillColor = highwayColor(blackKeyColor)
            key.strokeColor = .clear
            boardNode.addChild(key)
            if detailed {
                let hi = SKShapeNode(rect: rect(cx: cx, w: w - 2, top: yTop + 1, h: blackH * 0.25), cornerRadius: 1.5)
                hi.fillColor = highwayColor(blackKeyHi, alpha: 0.7)
                hi.strokeColor = .clear
                boardNode.addChild(hi)
            }
        }

        // Per-key light overlays.
        if lights.count != layout.laneCount {
            lights.forEach { $0.node.removeFromParent() }
            lights = []
            for _ in 0..<layout.laneCount {
                let node = SKShapeNode()
                node.isHidden = true
                node.blendMode = .add
                node.strokeColor = .clear
                container.addChild(node)
                lights.append(FlashState(node: node, energy: 0, color: 0xFFFFFF))
            }
        }
    }

    public func flash(lane: Int, grade: HitGradeKind) {
        guard let layout, lane >= 0, lane < lights.count else { return }
        let color = grade == .miss ? HighwayPalette.missRed : layout.laneColor(lane)
        lights[lane].energy = 1
        lights[lane].color = color
        let yTop = hitY + 6
        let midi = layout.midiForLane(lane)
        let black = isBlackKey(midi)
        let h = black ? kbH * 0.62 : kbH
        let w = black ? max(layout.noteWidth(lane) / 0.9, 2) : layout.whiteKeyWidth() - 1
        let cx = layout.laneCenterX(lane)
        lights[lane].node.path = UIBezierPath(roundedRect: rect(cx: cx, w: w, top: yTop, h: h), cornerRadius: 2).cgPath
        lights[lane].node.fillColor = highwayColor(color)
    }

    public func update(_ dt: Double) {
        for i in lights.indices {
            if lights[i].energy <= 0 { lights[i].node.isHidden = true; continue }
            lights[i].energy = max(0, lights[i].energy - dt * 3.2)
            lights[i].node.isHidden = false
            lights[i].node.alpha = style.keyLightAlpha * lights[i].energy * lights[i].energy
        }
    }
}

public func createReceptors(layout: LaneLayout, style: GlassStyle) -> ReceptorRenderer {
    layout.kind == .piano ? PianoKeyboard(style: style) : GlassPads(style: style)
}

// swiftlint:enable identifier_name
