// Single-letter geometry/time variables (x, y, t, dt, i, rx, ry, sx, sy, …) are ported 1:1 from
// the web glass-highway reference, where they read clearest; identifier_name is scoped off here.
// swiftlint:disable identifier_name
import PlaySenseCore
import SpriteKit

// Port of `components/play-sense/glass-highway/GlassApp.ts` as an `SKScene`.
//
// Mirrors GlassApp's contract exactly: per-frame mutable inputs (playheadProgress / currentScore /
// currentCombo / currentAccuracy / metronomeBeat / isHighwayPaused) and imperative calls
// (`configure(exercise:)`, `triggerHitEffect(eventIndex:grade:)`, `triggerMiss(eventIndex:)`,
// `closestEventIndex()`). SpriteKit's own render loop (`update(_:)`) replaces Pixi's ticker; a thin
// `HighwayBridge` in PlaySenseUI feeds these from the D23 `SessionCoordinator` each display frame.
//
// Layer order (bottom → top), preserved from GlassApp:
//   background + lanes → reflections → sunk misses → under-glass effects → glass band + hit line →
//   notes → receptors → effects → HUD.
public final class HighwayScene: SKScene {

    // MARK: Per-frame inputs (set by the bridge)
    public var playheadProgress: Double = 0
    public var currentScore: Double = 0
    public var currentCombo: Int = 0
    public var currentAccuracy: Double = 100
    public var metronomeBeat: Int = 0
    /// When true: the scene still renders (ambient), but notes don't scroll and the HUD freezes.
    public var isHighwayPaused = false

    // MARK: Collaborators
    private var style = GlassStyle()
    private let textures = TextureBank()
    private let sceneBg: SceneBackground
    private let noteField: NoteField
    private let effects: Effects
    private let hud = Hud()
    private var receptors: ReceptorRenderer?
    private var layout: LaneLayout?

    private let showHud: Bool
    private var exerciseDuration: Double = 0
    private var lastUpdate: TimeInterval = 0

    private let receptorLayer = SKNode()

    public init(size: CGSize, showHud: Bool = false) {
        self.showHud = showHud
        self.sceneBg = SceneBackground(style: style)
        self.noteField = NoteField(textures: textures, style: style)
        self.effects = Effects(textures: textures, style: style)
        super.init(size: size)
        self.scaleMode = .resizeFill
        self.anchorPoint = CGPoint(x: 0, y: 1) // web space: y grows downward from the top edge
        self.backgroundColor = highwayColor(HighwayPalette.bgBottom)

        // Assemble the layer stack via zPosition.
        add(sceneBg.backgroundNode, z: 0)
        add(noteField.reflectionContainer, z: 1)
        add(noteField.belowGlassContainer, z: 2)
        add(effects.underGlassContainer, z: 3)
        add(sceneBg.glassNode, z: 4)
        add(noteField.container, z: 5)
        add(receptorLayer, z: 6)
        add(effects.container, z: 7)
        if showHud { add(hud.container, z: 8) }

        // Wire miss-crossing → ripple / red seep / MISS flash (GlassApp's onMissCross).
        noteField.onMissCross = { [weak self] x, lane in
            self?.effects.triggerMissCross(x: x)
            self?.receptors?.flash(lane: lane, grade: .miss)
        }
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    private func add(_ node: SKNode, z: CGFloat) {
        node.zPosition = z
        addChild(node)
    }

    // MARK: - GlassApp contract

    /// Initialize with an exercise (re-callable — swaps the instrument's receptors + layout).
    public func configure(exercise: ExerciseDefinition) {
        exerciseDuration = getExerciseDuration(exercise)
        let layout = createLaneLayout(exercise)
        self.layout = layout

        if let old = receptors { old.container.removeFromParent() }
        let receptors = createReceptors(layout: layout, style: style)
        receptorLayer.addChild(receptors.container)
        self.receptors = receptors

        sceneBg.setLayout(layout)
        noteField.initialize(exercise: exercise, layout: layout)
        applyLayout()
    }

    /// Find the unjudged note closest to the hit line (GlassApp.getClosestEventIndex).
    public func closestEventIndex() -> Int? {
        let elapsed = playheadProgress * exerciseDuration
        return noteField.closestEventIndex(elapsedSec: elapsed)
    }

    /// A note was hit — fire its choreography and receptor flash.
    public func triggerHitEffect(eventIndex: Int, grade: HitGradeKind) {
        guard let layout else { return }
        let lane = noteField.laneForEvent(eventIndex)
        let color = noteField.colorForEvent(eventIndex)
        noteField.markHit(eventIndex)
        effects.triggerHit(x: layout.laneCenterX(lane), grade: grade, color: color)
        receptors?.flash(lane: lane, grade: grade)
    }

    /// A miss was detected — the note falls through the glass (the cross effect fires on crossing).
    public func triggerMiss(eventIndex: Int) {
        noteField.markMissed(eventIndex)
    }

    // MARK: - Layout / resize

    public override func didChangeSize(_ oldSize: CGSize) {
        super.didChangeSize(oldSize)
        applyLayout()
    }

    private func applyLayout() {
        let w = Double(size.width), h = Double(size.height)
        guard w > 0, h > 0 else { return }
        layout?.resize(width: w)
        sceneBg.resize(width: w, height: h)
        let hitY = sceneBg.hitLineY
        noteField.resize(width: w, height: h, hitY: hitY)
        effects.resize(hitY: hitY)
        if let layout, let receptors { receptors.resize(layout: layout, hitY: hitY, width: w, height: h) }
        if showHud { hud.resize(width: w, height: h) }
    }

    // MARK: - Render loop

    public override func update(_ currentTime: TimeInterval) {
        let dt = lastUpdate == 0 ? 1.0 / 60 : min(currentTime - lastUpdate, 1.0 / 20)
        lastUpdate = currentTime

        let elapsed = isHighwayPaused ? 0 : playheadProgress * exerciseDuration
        let score = isHighwayPaused ? 0 : Int(currentScore.rounded())
        let combo = isHighwayPaused ? 0 : currentCombo

        sceneBg.update(dt)
        if isHighwayPaused {
            noteField.clearVisible()
        } else {
            noteField.update(elapsedSec: elapsed, nowSec: currentTime)
        }
        receptors?.update(dt)
        effects.update(dt)
        if showHud { hud.update(score: score, combo: combo, dt: dt) }
    }
}

// swiftlint:enable identifier_name
