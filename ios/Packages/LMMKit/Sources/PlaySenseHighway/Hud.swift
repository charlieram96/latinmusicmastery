// Single-letter geometry/time variables (x, y, t, dt, i, rx, ry, sx, sy, …) are ported 1:1 from
// the web glass-highway reference, where they read clearest; identifier_name is scoped off here.
// swiftlint:disable identifier_name
import SpriteKit
import UIKit

// Port of `components/play-sense/glass-highway/Hud.ts`.
//
// Minimal in-canvas HUD: a thin, large score centered at the top and a small COMBO line under it.
// On iOS the SwiftUI `StagePlayerView` overlay owns the primary chrome (matching the web's DOM/canvas
// split), so ``HighwayScene`` keeps this off by default; it stays a faithful port for `showHud`.

final class Hud {
    let container = SKNode()

    private let score = SKLabelNode()
    private let combo = SKLabelNode()
    private var lastCombo = 0
    private var comboPop = 0.0
    private var width: Double = 0

    init() {
        score.fontName = "HelveticaNeue-Thin"
        score.fontSize = 34
        score.fontColor = highwayColor(0xFFF6E6)
        score.horizontalAlignmentMode = .center
        score.verticalAlignmentMode = .top
        score.text = "0"

        combo.fontName = "HelveticaNeue-Bold"
        combo.fontSize = 11
        combo.fontColor = highwayColor(0xF7C878)
        combo.horizontalAlignmentMode = .center
        combo.verticalAlignmentMode = .top
        combo.alpha = 0.85
        combo.isHidden = true

        container.addChild(score)
        container.addChild(combo)
    }

    func resize(width: Double, height: Double) {
        self.width = width
        let scale = max(22, min(36, width * 0.045)) / 34
        score.setScale(scale)
        score.position = CGPoint(x: width / 2, y: -16)
        combo.position = CGPoint(x: width / 2, y: -(16 + 34 * scale + 6))
    }

    func update(score: Int, combo: Int, dt: Double) {
        self.score.text = NumberFormatter.localizedString(from: NSNumber(value: score), number: .decimal)
        self.score.position.x = width / 2
        self.combo.position.x = width / 2

        if combo > lastCombo { comboPop = 1 }
        lastCombo = combo
        comboPop = max(0, comboPop - dt * 4)

        if combo > 1 {
            self.combo.text = "COMBO ×\(combo)"
            self.combo.isHidden = false
            self.combo.setScale(1 + comboPop * 0.18)
        } else {
            self.combo.isHidden = true
        }
    }
}

// swiftlint:enable identifier_name
