import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
import type { ExerciseDefinition, ExerciseGrid, HitGrade } from '@/lib/play-sense/types'
import { gridBeats, gridLoopSeconds } from '@/lib/play-sense/grid'
import { APPROACH_SECONDS, FAR_Z, HIT_Z, RUNWAY_WIDTH, changedJudgments, createStageModel, firstVisibleNote, type StageFrame, type StageLane, type StageNote } from './model'
import { STAGE_THEMES, type StageThemeId } from './themes'
import { box, buildDrum, buildEnvironment, buildPad, disposeObject, glowTexture, labelSprite, lightMaterial, material } from './objects'
import { block, contactShadow, cylinder, metal, rod, textured } from './craft'
import { buildMiami, createComposer, createHitFx, createShatter, laneLightTexture, NOTE_LAYOUT, noteCore, noteHead, notePool, tunnelTexture, DECK_TOP } from './miami'
import { colorNoteEmission, entranceGlow, noteChevronGeometry, noteGemGeometry, noteTrailTexture, strikeAura } from './note-geometry'
import { observeFrameResize } from './frame-resize'

interface SkinRipple { hit: { value: number }; color: { value: THREE.Color }; power: { value: number } }
interface Receptor { object: THREE.Object3D; glow: THREE.Sprite; energy: number; homeY: number; aura: ReturnType<typeof strikeAura>; skin?: SkinRipple }

/** Layers laid on the deck win the depth test without z-fighting, on any GPU's depth precision. */
function decal(material: THREE.Material) {
  material.polygonOffset = true; material.polygonOffsetFactor = -2; material.polygonOffsetUnits = -4
}

/** Rings of light travel across a struck drum skin; the shader reads its own object-space radius. */
function addSkinRipple(material: THREE.MeshStandardMaterial, clock: { value: number }, radius: number): SkinRipple {
  const ripple: SkinRipple = { hit: { value: -10 }, color: { value: new THREE.Color() }, power: { value: 0 } }
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, { psClock: clock, psHitTime: ripple.hit, psHitColor: ripple.color, psHitPower: ripple.power, psRadius: { value: radius } })
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 psSkin; varying vec3 psRadial;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\npsSkin = position;\npsRadial = normalize(normalMatrix * normalize(vec3(position.x, 0., position.z) + 1e-5));')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 psSkin; varying vec3 psRadial;
        uniform float psClock; uniform float psHitTime; uniform vec3 psHitColor; uniform float psHitPower; uniform float psRadius;
        // Travelling membrane wave: returns (height, slope) of two decaying rings.
        vec2 psWave(float r, float age) {
          float a = (r - age * 1.6) / .085, b = (r - (age - .12) * 1.3) / .06;
          float fade = max(0., 1. - age / .9); fade *= fade;
          float h = exp(-a * a) + exp(-b * b) * .5 * step(.12, age);
          float slope = (-2. * a * exp(-a * a) / .085 - step(.12, age) * b * exp(-b * b) / .06) * fade;
          return vec2(h * fade, slope);
        }`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        float psAgeN = psClock - psHitTime;
        if (psAgeN >= 0. && psAgeN < .9) {
          // Bend the lit normal along the wave so the skin visibly flexes under the light.
          vec2 psW = psWave(length(psSkin.xz) / psRadius, psAgeN);
          normal = normalize(normal - psRadial * psW.y * .012 * psHitPower);
        }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float psAge = psClock - psHitTime;
        if (psAge >= 0. && psAge < .9) {
          float psR = length(psSkin.xz) / psRadius;
          float psCore = exp(-psR * psR * 10.) * exp(-psAge * 9.);
          totalEmissiveRadiance += psHitColor * (psWave(psR, psAge).x * (1. - smoothstep(.9, 1.02, psR)) * .75 + psCore * .7) * psHitPower;
        }`)
  }
  material.customProgramCacheKey = () => 'playsense-skin-ripple-v2'
  material.needsUpdate = true
  return ripple
}
interface Burst { mesh: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>; age: number; active: boolean; size: number; upright: boolean }
interface Spark { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; lane: number }
export interface StageRendererOptions {
  theme: StageThemeId
  reducedMotion: boolean
  quality: 'standard' | 'low'
  readFrame: () => StageFrame
  onError: (message: string) => void
  explore?: boolean
}

// `gridBeats`/`gridLoopSeconds` walk every measure of the grid; a graded
// owner's `exercise.grid` object is stable for the renderer's lifetime, so
// cache the derived beat list by grid identity instead of rebuilding it on
// every animation frame.
const gridBeatsCache = new WeakMap<ExerciseGrid, { beats: ReturnType<typeof gridBeats>; loopLen: number }>()

function cachedGridBeats(grid: ExerciseGrid): { beats: ReturnType<typeof gridBeats>; loopLen: number } {
  let cached = gridBeatsCache.get(grid)
  if (!cached) {
    cached = { beats: gridBeats(grid), loopLen: gridLoopSeconds(grid) }
    gridBeatsCache.set(grid, cached)
  }
  return cached
}

/**
 * Every beat-line position (in engine seconds, downbeat flag) whose time
 * falls within `[windowStart, windowEnd]`, following the grid across as many
 * loop passes as the window spans. Pure so it can be tested without a GPU
 * context; the renderer turns each entry into a line's z-position and
 * brightness.
 *
 * Before bar 1 (negative time, the count-in) the lines are spaced at bar 1's
 * beat length with bar 1's downbeat pattern — matching `gridCountIn` —
 * never the wrapped tail of a previous loop pass, which can be a different
 * tempo or meter.
 */
export function beatLinePositions(
  grid: ExerciseGrid,
  windowStart: number,
  windowEnd: number
): { seconds: number; downbeat: boolean }[] {
  if (windowEnd < windowStart) return []
  const { beats, loopLen } = cachedGridBeats(grid)
  if (loopLen <= 0 || beats.length === 0) return []
  const out: { seconds: number; downbeat: boolean }[] = []

  if (windowStart < 0) {
    const beatSec0 = grid.beatQN[0] * grid.secPerQN[0]
    const beatsPerBar0 = Math.round((grid.measureStartQN[1] - grid.measureStartQN[0]) / grid.beatQN[0])
    const cappedEnd = Math.min(windowEnd, 0)
    const kMin = Math.ceil(windowStart / beatSec0)
    const kMax = Math.min(-1, Math.floor(cappedEnd / beatSec0))
    for (let k = kMin; k <= kMax; k++) {
      const seconds = k * beatSec0
      const downbeat = ((k % beatsPerBar0) + beatsPerBar0) % beatsPerBar0 === 0
      out.push({ seconds, downbeat })
    }
  }

  if (windowEnd >= 0) {
    const start = Math.max(windowStart, 0)
    const firstLoop = Math.floor(start / loopLen)
    const lastLoop = Math.floor(windowEnd / loopLen)
    for (let loop = firstLoop; loop <= lastLoop; loop++) {
      for (const beat of beats) {
        const seconds = loop * loopLen + beat.seconds
        if (seconds >= start && seconds <= windowEnd) out.push({ seconds, downbeat: beat.downbeat })
      }
    }
  }

  return out
}

/** Owns a single GPU context. Audio time is read directly; it never grades notes. */
export class StageRenderer {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(47, 1, 0.1, 160)
  private clock = 0
  private composer: EffectComposer | null = null
  private bloom: UnrealBloomPass | null = null
  private viewport: ReturnType<typeof observeFrameResize>
  private resizedLastFrame = false
  private frameId = 0
  private destroyed = false
  private inView = true
  private visibilityObserver: IntersectionObserver
  private previousTime = 0
  private attempt = -1
  private judgments = new Map<number, HitGrade>()
  private lastResults: readonly { eventIndex: number; grade: HitGrade }[] | null = null
  private lanes: StageLane[]
  private notes: StageNote[]
  private notesByIndex: Map<number, StageNote>
  private heads: THREE.InstancedMesh
  private cores: THREE.InstancedMesh
  private trims: THREE.InstancedMesh
  private tails: THREE.InstancedMesh
  private noteCapacity: number
  private dummy = new THREE.Object3D()
  private colors: THREE.Color[]
  private tint = new THREE.Color()
  private miami: ReturnType<typeof buildMiami> | null = null
  private grade: ReturnType<typeof createComposer>['grade'] | null = null
  private fx: ReturnType<typeof createHitFx> | null = null
  private skinClock = { value: 0 }
  private shatter: ReturnType<typeof createShatter> | null = null
  private lastCombo = 0
  private stageEnergy = 0
  private boardFallback = new THREE.Group()
  private labels: { sprite: THREE.Sprite; aspect: number; maxWidth: number; pixels: number }[] = []
  private labelPosition = new THREE.Vector3()
  private sourceGlow: ReturnType<typeof entranceGlow> | null = null
  private receptors: Receptor[] = []
  private bursts: Burst[] = []
  private burstCursor = 0
  private sparkMesh: THREE.InstancedMesh
  private sparks: Spark[] = Array.from({ length: 256 }, () => ({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, lane: 0 }))
  private sparkCursor = 0
  private beatLines: THREE.Mesh[] = []
  private points: THREE.Points
  private slowFrames = 0
  private fastFrames = 0
  private downgrades = 0
  private maxPixelRatio = 1
  private pixelRatio = 1
  private glowMap: THREE.CanvasTexture
  private environmentMap: THREE.WebGLRenderTarget | null = null
  private controls: OrbitControls | null = null
  private assetsAbort = new AbortController()
  private readonly farZ: number
  private readonly onContextLost = (event: Event) => {
    event.preventDefault()
    this.options.onError('The 3D stage lost its graphics connection. Reload the stage to continue.')
    cancelAnimationFrame(this.frameId)
  }

  constructor(private container: HTMLDivElement, private exercise: ExerciseDefinition, private options: StageRendererOptions) {
    this.renderer = new THREE.WebGLRenderer({ antialias: options.quality !== 'low', alpha: false, powerPreference: 'high-performance' })
    const theme = STAGE_THEMES[options.theme]
    const studio = theme.id === 'studio'
    this.farZ = studio ? -25 : FAR_Z
    // Cap the render scale to keep the animated scene affordable on retina screens.
    this.maxPixelRatio = this.pixelRatio = Math.min(window.devicePixelRatio || 1, options.quality === 'low' ? 1 : studio ? 1.35 : 1.5)
    this.renderer.setPixelRatio(this.pixelRatio)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = studio ? .9 : 1.25
    this.renderer.shadowMap.enabled = studio && options.quality !== 'low'
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    // The set is static; bake its shadow once instead of re-rendering every bolt per frame.
    this.renderer.shadowMap.autoUpdate = false
    this.renderer.shadowMap.needsUpdate = true
    this.renderer.domElement.setAttribute('aria-label', `${exercise.title}: 3D note runway`)
    this.renderer.domElement.setAttribute('role', 'img')
    this.renderer.domElement.addEventListener('webglcontextlost', this.onContextLost)
    container.appendChild(this.renderer.domElement)
    this.scene.background = new THREE.Color(theme.background)
    this.scene.fog = new THREE.FogExp2(theme.background, studio ? 0.017 : 0.022)
    const model = createStageModel(exercise)
    this.lanes = model.lanes; this.notes = model.notes
    this.notesByIndex = new Map(this.notes.map(note => [note.index, note]))
    this.colors = this.lanes.map((lane, index) => new THREE.Color(theme.colors[exercise.instrument === 'piano' ? (lane.black ? 1 : 0) : index % theme.colors.length]))
    this.glowMap = glowTexture()

    if (studio) {
      // A near plane of 1 keeps depth precision for the thin layers laid on the deck.
      this.camera.near = 1; this.camera.far = 1600
      this.miami = buildMiami(this.renderer, this.scene, { farZ: this.farZ, quality: options.quality, reducedMotion: options.reducedMotion })
      this.environmentMap = this.miami.environment
      this.fx = createHitFx()
      for (const mesh of this.fx.meshes) this.scene.add(mesh)
      this.shatter = createShatter(DECK_TOP + .06)
      this.scene.add(this.shatter.mesh)
      this.sourceGlow = entranceGlow()
      this.sourceGlow.material.uniforms.motion.value = options.reducedMotion ? 0 : 1
      this.sourceGlow.visible = true
      this.scene.add(this.sourceGlow)
    } else {
      this.scene.add(new THREE.HemisphereLight(0xdceaff, theme.background, 2.3))
      const key = new THREE.DirectionalLight(0xffd29a, 4.5)
      key.position.set(-10, 16, 5); this.scene.add(key)
      const rim = new THREE.DirectionalLight(theme.secondary, 3)
      rim.position.set(5, 5, -12); this.scene.add(rim)
      this.scene.add(buildEnvironment(theme))
    }

    const runwayLength = HIT_Z - this.farZ + 1
    const runwayCenter = (HIT_Z + this.farZ - 1) / 2
    if (studio) {
      // The pier deck belongs to the set; add brass lane inlays, lane light and the strike line.
      const inlay = new THREE.MeshStandardMaterial({ color: 0xc8924c, metalness: 1, roughness: .3, emissive: 0x6b4420, emissiveIntensity: .35 })
      if (exercise.instrument !== 'piano') for (let i = 1; i < this.lanes.length; i++) {
        box(this.scene, .035, .01, runwayLength + .4, inlay, (this.lanes[i - 1].x + this.lanes[i].x) / 2, DECK_TOP + .004, runwayCenter)
      }
      // Readability tunnel: the far lane darkens so incoming notes never sit on the sun's glare.
      const tunnel = new THREE.Mesh(new THREE.PlaneGeometry(RUNWAY_WIDTH + .3, runwayLength).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x0c0610, alphaMap: tunnelTexture(), transparent: true, opacity: .85, depthWrite: false }))
      tunnel.position.set(0, DECK_TOP + .002, runwayCenter); tunnel.renderOrder = -1
      decal(tunnel.material)
      this.scene.add(tunnel)
      const laneLight = laneLightTexture()
      this.lanes.forEach((lane, index) => {
        if (exercise.instrument === 'piano' && lane.black) return
        const strip = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: laneLight, color: this.colors[index], transparent: true, opacity: exercise.instrument === 'piano' ? .1 : .2, depthWrite: false, blending: THREE.AdditiveBlending }))
        strip.scale.set(lane.width * (exercise.instrument === 'piano' ? 1 : 1.25), 1, 14)
        strip.position.set(lane.x, DECK_TOP + .003, HIT_Z - 6.7)
        decal(strip.material)
        this.scene.add(strip)
      })
      for (let i = 0; i < 18; i++) {
        this.beatLines.push(box(this.scene, RUNWAY_WIDTH, .006, .035, new THREE.MeshBasicMaterial({ color: 0xffd9a8, transparent: true, opacity: .07, depthWrite: false, blending: THREE.AdditiveBlending }), 0, DECK_TOP + .005))
      }
      box(this.scene, RUNWAY_WIDTH + .5, .03, .06, new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 2, 1.35) }), 0, DECK_TOP + .02, HIT_Z)
      const halo = new THREE.Mesh(new THREE.PlaneGeometry(RUNWAY_WIDTH + .6, 1.1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: laneLightTexture(true), color: 0xffc98a, transparent: true, opacity: .55, depthWrite: false, blending: THREE.AdditiveBlending }))
      halo.position.set(0, DECK_TOP + .008, HIT_Z)
      decal(halo.material)
      for (const line of this.beatLines) decal(line.material as THREE.Material)
      this.scene.add(halo)
    } else {
      this.scene.add(this.boardFallback)
      const deck = new THREE.Mesh(new RoundedBoxGeometry(10.6, 0.35, runwayLength, 2, 0.16), material(theme.deck, 0.38, 0.62))
      deck.position.set(0, -0.35, runwayCenter); this.boardFallback.add(deck)
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(160, 180), material(theme.background, 0.15, 0.85))
      floor.rotation.x = -Math.PI / 2; floor.position.set(0, -2.5, -30); this.scene.add(floor)
      for (const side of [-1, 1]) {
        box(this.boardFallback, 0.12, 0.16, runwayLength, material(theme.metal, 0.9, 0.2), side * 5.32, -0.13, runwayCenter)
        box(this.boardFallback, 0.026, 0.035, runwayLength, lightMaterial(theme.accent, 2.1), side * 5.24, 0.015, runwayCenter)
        box(this.boardFallback, 0.025, 0.018, runwayLength, lightMaterial(theme.secondary, 0.8), side * 5.47, -0.25, runwayCenter)
      }
      for (const lane of this.lanes) {
        if (exercise.instrument === 'piano' && lane.black) continue
        box(this.scene, 0.011, 0.006, runwayLength, new THREE.MeshBasicMaterial({ color: theme.accent, transparent: true, opacity: exercise.instrument === 'piano' ? 0.08 : 0.16 }), lane.x, -0.16, runwayCenter)
      }
      for (let i = 0; i < 18; i++) {
        this.beatLines.push(box(this.scene, RUNWAY_WIDTH, 0.012, 0.025, new THREE.MeshBasicMaterial({ color: theme.accent, transparent: true, opacity: i % 4 === 0 ? 0.18 : 0.06 }), 0, -0.14))
      }
      box(this.scene, RUNWAY_WIDTH + 0.3, 0.035, 0.07, lightMaterial(theme.accent, 2), 0, 0.04, HIT_Z)
      box(this.scene, RUNWAY_WIDTH + 0.5, 0.016, 0.23, new THREE.MeshBasicMaterial({ color: theme.accent, transparent: true, opacity: 0.12 }), 0, 0.025, HIT_Z)
    }

    // A separate, slightly lower keyboard station clears the board's front apron.
    const pianoForward = 1.05, pianoDrop = .29
    if (exercise.instrument === 'piano') {
      block(this.scene, [10.55, 0.45, 2.6], material(0x171e1c, 0.35, 0.28), [0, -.26 - pianoDrop, HIT_Z + 1.35 + pianoForward], .1)
      const wood = textured('wood','#744728',.35), bronze = metal(theme.metal,.28)
      for (const side of [-1, 1]) {
        block(this.scene, [.23,.6,2.72], wood, [side*5.3,-.13-pianoDrop,HIT_Z+1.35+pianoForward],.065)
        block(this.scene,[.19,2.6,.24],wood,[side*4.5,-1.9,HIT_Z+1.8+pianoForward],.035)
        block(this.scene,[.38,.13,.5],bronze,[side*4.5,-3.13,HIT_Z+1.8+pianoForward],.035)
      }
      for(let i=0;i<3;i++) block(this.scene,[.18,.075,.47],bronze,[(i-1)*.27,-3.11,HIT_Z+2.25+pianoForward],.055)
    }
    this.lanes.forEach((lane, index) => {
      const color = this.colors[index].getHex()
      let object: THREE.Object3D
      if (exercise.instrument === 'piano') {
        const keyMesh = new THREE.Mesh(new RoundedBoxGeometry(lane.width, lane.black ? 0.28 : 0.22, lane.black ? 0.95 : 1.55, 2, 0.035), material(lane.black ? 0x131c26 : 0xe0e6e5, 0.18, 0.25))
        keyMesh.position.set(lane.x, (lane.black ? .18 : .01) - pianoDrop, HIT_Z + (lane.black ? .8 : 1.08) + pianoForward)
        keyMesh.castShadow = true; keyMesh.receiveShadow = true
        this.scene.add(keyMesh); object = keyMesh
        if (!lane.black && lane.midi != null && lane.midi % 12 === 0) {
          const label = labelSprite(lane.label, '#acbabd')
          label.position.set(lane.x, -.29, HIT_Z + 2.25 + pianoForward); this.scene.add(label)
          this.labels.push({ sprite: label, aspect: label.scale.x / label.scale.y, maxWidth: 1, pixels: 17 })
        }
      } else {
        const drum = ['conga', 'bongo'].includes(exercise.instrument)
        object = drum ? buildDrum(color, theme, exercise.instrument !== 'conga') : buildPad(color, theme, lane.id)
        const scale = Math.min(lane.width / 1.4 * (studio ? 1.2 : 1.13), studio ? 1.99 : 1.55)
        object.scale.setScalar(scale)
        object.position.set(lane.x, -0.03, HIT_Z + (drum ? 1.05 : .9))
        this.scene.add(object)
        if (studio) {
          contactShadow(this.scene, lane.x, HIT_Z + 1.05, scale * 1.9, scale * 1.9)
          if (exercise.instrument !== 'conga') {
            const support = metal(theme.metal, .3), z = object.position.z
            rod(this.scene, [lane.x,-3.17,z], [lane.x,-.5*scale,z], .036, support)
            cylinder(this.scene,.085,.085,.14,support,lane.x,-2.4,z)
            for (let foot=0;foot<3;foot++) {
              const a=foot*Math.PI*2/3
              rod(this.scene,[lane.x,-2.7,z],[lane.x+Math.cos(a)*.45,-3.17,z+Math.sin(a)*.45],.025,support)
            }
          }
        }
        const label = labelSprite(lane.label, '#' + this.colors[index].getHexString())
        label.position.set(lane.x, drum ? -.56 : -.68, HIT_Z + (drum ? 2.25 : 1.9)); this.scene.add(label)
        this.labels.push({ sprite: label, aspect: label.scale.x / label.scale.y, maxWidth: lane.width / .7 * .86, pixels: 22 })
      }
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowMap, color, blending: THREE.AdditiveBlending, transparent: true, opacity: 0, depthWrite: false }))
      glow.position.set(lane.x, 0.25, HIT_Z)
      glow.scale.set(Math.max(lane.width * 2, 0.6), Math.max(lane.width * 1.5, 0.8), 1)
      this.scene.add(glow)
      const aura = strikeAura(this.colors[index])
      aura.position.set(lane.x, .06, HIT_Z + .12)
      aura.scale.set(Math.min(lane.width * 1.7, 4.8), 3.6, 1)
      this.scene.add(aura)
      this.receptors.push({ object, glow, energy: 0, homeY: object.position.y, aura })
    })

    // Allocate for the densest visible window, not the full song or an arbitrary cap.
    let first = 0, capacity = 1
    for (let i = 0; i < this.notes.length; i++) {
      while (this.notes[i].time - this.notes[first].time > APPROACH_SECONDS + 1.5) first++
      capacity = Math.max(capacity, i - first + 1)
    }
    this.noteCapacity = capacity
    const piano = exercise.instrument === 'piano'
    const trail = new THREE.MeshBasicMaterial({ color: 0xffffff, map: noteTrailTexture(), transparent: true, opacity: .65, depthWrite: false, blending: THREE.AdditiveBlending })
    if (studio) {
      const head = noteHead(), core = noteCore(), pool = notePool()
      this.heads = new THREE.InstancedMesh(head.geometry, head.material, capacity)
      this.cores = new THREE.InstancedMesh(core.geometry, core.material, capacity)
      this.trims = new THREE.InstancedMesh(pool.geometry, pool.material, capacity)
    } else {
      this.heads = new THREE.InstancedMesh(piano ? new RoundedBoxGeometry(1, .25, .64, 2, .055) : noteGemGeometry(.28), new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: .72, roughness: .24 }), capacity)
      const coreMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: .38, metalness: .28, roughness: .2 })
      colorNoteEmission(coreMaterial)
      this.cores = new THREE.InstancedMesh(piano ? new RoundedBoxGeometry(.81, .08, .46, 2, .025) : noteGemGeometry(.09, .075), coreMaterial, capacity)
      this.trims = new THREE.InstancedMesh(piano ? new RoundedBoxGeometry(.6, .025, .045, 1, .01) : noteChevronGeometry(), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), capacity)
    }
    this.tails = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), trail, capacity)
    for (const mesh of [this.heads, this.cores, this.trims, this.tails]) {
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      mesh.frustumCulled = false; mesh.count = 0; this.scene.add(mesh)
    }
    for (let i = 0; i < 32; i++) {
      const mesh = new THREE.Mesh(new THREE.RingGeometry(0.96, 1, 64), new THREE.MeshBasicMaterial({ color: theme.accent, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }))
      mesh.rotation.x = -Math.PI / 2; mesh.visible = false; this.scene.add(mesh)
      this.bursts.push({ mesh, age: 0, active: false, size: 1, upright: false })
    }
    this.sparkMesh = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.075), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), this.sparks.length)
    this.sparkMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.sparkMesh.frustumCulled = false; this.sparkMesh.count = 0
    this.scene.add(this.sparkMesh)
    // Sparse, deterministic ambient dust. No object creation in the animation loop.
    const positions = new Float32Array(180 * 3)
    for (let i = 0; i < 180; i++) {
      positions[i * 3] = Math.sin(i * 73.41) * 22
      positions[i * 3 + 1] = Math.abs(Math.sin(i * 19.7)) * 12
      positions[i * 3 + 2] = -Math.abs(Math.cos(i * 43.3)) * 65
    }
    const geometry = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(positions, 3))
    this.points = new THREE.Points(geometry, new THREE.PointsMaterial({ color: theme.accent, size: 0.035, transparent: true, opacity: 0.45, depthWrite: false }))
    this.scene.add(this.points)
    if (options.quality !== 'low' && studio) {
      const post = createComposer(this.renderer, this.scene, this.camera, theme.bloom)
      this.composer = post.composer; this.bloom = post.bloom; this.grade = post.grade
    } else if (options.quality !== 'low') {
      this.composer = new EffectComposer(this.renderer)
      this.composer.addPass(new RenderPass(this.scene, this.camera))
      this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), theme.bloom, 0.65, 0.9)
      this.composer.addPass(this.bloom)
      this.composer.addPass(new OutputPass())
    }
    this.renderer.shadowMap.needsUpdate = true
    this.viewport = observeFrameResize(container, (width, height) => this.resize(width, height))
    this.viewport.flush()
    if (options.explore) {
      this.camera.position.set(18, 12, 23)
      this.controls = new OrbitControls(this.camera, this.renderer.domElement)
      this.controls.target.set(0, 0, -6)
      this.controls.minDistance = 13; this.controls.maxDistance = 48
      this.controls.minPolarAngle = .35; this.controls.maxPolarAngle = Math.PI / 2 - .08
      this.controls.minAzimuthAngle = -Math.PI * .43; this.controls.maxAzimuthAngle = Math.PI * .43
      this.controls.enablePan = false
      this.controls.update()
      this.controls.addEventListener('change', this.fitLabels)
      this.fitLabels()
    }
    this.visibilityObserver = new IntersectionObserver(entries => { this.inView = entries[0]?.isIntersecting ?? true })
    this.visibilityObserver.observe(container)
    this.frameId = requestAnimationFrame(this.render)
    if (studio && options.quality !== 'low') {
      void this.loadAuthoredInstruments()
    }
  }

  /** Keep the playable procedural set until the complete Blender collection is decoded. */
  private async loadAuthoredInstruments() {
    const decoder = new DRACOLoader().setDecoderPath('/playsense/decoders/draco/').setWorkerLimit(2)
    try {
      const response = await fetch('/playsense/models/afterhours-instruments.glb', { signal: this.assetsAbort.signal })
      if (!response.ok) throw new Error(`Instrument download failed (${response.status})`)
      const bytes = await response.arrayBuffer()
      if (this.destroyed) return
      const gltf = await new GLTFLoader().setDRACOLoader(decoder).parseAsync(bytes, '/playsense/models/')
      if (this.destroyed) { disposeObject(gltf.scene); return }
      // Retain the hidden masters with the scene so all shared GPU resources have one owner.
      gltf.scene.visible = false
      this.scene.add(gltf.scene)
      gltf.scene.updateMatrixWorld(true)
      this.receptors.forEach((receptor, index) => {
        const lane = this.lanes[index]
        const name = this.exercise.instrument === 'conga' ? lane.id : this.exercise.instrument !== 'timbale' ? null :
          lane.id === 'macho' ? 'timbale_macho' : ['hembra', 'cascara'].includes(lane.id) ? 'timbale_hembra' : null
        if (!name) return
        const master = gltf.scene.getObjectByName(name)
        if (!master) return
        const bounds = new THREE.Box3().setFromObject(master, true)
        const replacement = master.clone(true)
        replacement.position.copy(receptor.object.position)
        replacement.quaternion.copy(receptor.object.quaternion)
        replacement.scale.copy(receptor.object.scale)
        if (this.exercise.instrument === 'conga') {
          // Match the real stage floor while preserving each drum's individual proportions.
          const grounded = 3.17 / Math.max(.1, -bounds.min.y)
          const fitsLane = (lane.width / .7 - .22) / Math.max(.1, bounds.max.x - bounds.min.x)
          replacement.scale.setScalar(Math.min(grounded, fitsLane))
        }
        replacement.traverse(object => {
          if (!(object instanceof THREE.Mesh)) return
          object.castShadow = true; object.receiveShadow = true
          const materials = Array.isArray(object.material) ? object.material : [object.material]
          for (const mat of materials) {
            for (const value of Object.values(mat)) if (value instanceof THREE.Texture) {
              value.anisotropy = Math.min(4, this.renderer.capabilities.getMaxAnisotropy())
            }
            if (this.miami && mat instanceof THREE.MeshStandardMaterial && (mat.name.startsWith('Natural rawhide') || mat.name.startsWith('Coated timbale head'))) {
              const skin = mat.clone()
              object.geometry.computeBoundingBox()
              const box = object.geometry.boundingBox!
              receptor.skin = addSkinRipple(skin, this.skinClock, Math.max(box.max.x - box.min.x, box.max.z - box.min.z) / 2)
              object.material = skin
            }
            // Polished shells mirror the dusk sky instead of reading as flat grey.
            if (this.miami && mat instanceof THREE.MeshStandardMaterial && mat.name.startsWith('Brushed nickel')) {
              mat.roughness = .14; mat.envMapIntensity = 1.35
            }
          }
        })
        const previous = receptor.object
        this.scene.add(replacement)
        receptor.object = replacement
        previous.removeFromParent(); disposeObject(previous)
      })
      this.renderer.shadowMap.needsUpdate = true
    } catch (error) {
      if (!this.destroyed) console.warn('PlaySense could not load the Blender collection; the procedural instruments remain available.', error)
    } finally {
      decoder.dispose()
    }
  }

  private resize(width: number, height: number) {
    if (this.destroyed) return
    // CSS keeps the last complete image filling the panel until this frame is drawn.
    this.renderer.setSize(width, height, false)
    this.composer?.setSize(width, height)
    this.camera.aspect = width / height
    // Keep the entire hit zone visible on portrait screens as well as lesson embeds.
    const studio = this.options.theme === 'studio'
    const piano = this.exercise.instrument === 'piano'
    const distance = studio ? Math.max(16, (piano ? 14.6 : 13) / this.camera.aspect) : Math.max(18, (piano ? 15.6 : 14) / this.camera.aspect)
    this.camera.fov = studio ? 52 : 47
    if (!this.controls) {
      // The bayfront camera sits lower so the skyline, sky and archway stay in frame.
      if (studio) {
        this.camera.position.set(0, Math.max(5.8, distance * .36), distance)
        this.camera.lookAt(0, 2.2, -8)
      } else {
        this.camera.position.set(0, Math.max(10, distance * .45), distance)
        this.camera.lookAt(0, 0, -4)
      }
    }
    if (this.grade) this.grade.uniforms.psAspect.value = this.camera.aspect
    this.camera.updateProjectionMatrix()
    this.fitLabels()
  }

  /** Keep the instrument lettering legible without allowing neighboring tags to collide. */
  private fitLabels = () => {
    this.camera.updateMatrixWorld()
    const height = this.container.clientHeight
    if (!height) return
    const viewScale = 2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) / height
    for (const { sprite, aspect, maxWidth, pixels } of this.labels) {
      sprite.getWorldPosition(this.labelPosition).applyMatrix4(this.camera.matrixWorldInverse)
      const desired = pixels * viewScale * Math.max(.1, -this.labelPosition.z)
      const labelHeight = Math.min(desired, maxWidth / aspect)
      sprite.scale.set(labelHeight * aspect, labelHeight, 1)
    }
  }

  private impact(index: number, grade: HitGrade) {
    const note = this.notesByIndex.get(index)
    if (!note) return
    const receptor = this.receptors[note.lane]
    receptor.energy = grade === 'miss' ? 0.25 : 1
    receptor.glow.material.color.set(grade === 'miss' ? 0xf07888 : this.colors[note.lane])
    if (this.options.reducedMotion) return
    if (this.fx) {
      const lane = this.lanes[note.lane]
      if (receptor.skin) {
        receptor.skin.hit.value = this.skinClock.value
        receptor.skin.color.value.copy(grade === 'miss' ? this.tint.setRGB(.5, .18, .25) : this.colors[note.lane])
        receptor.skin.power.value = grade === 'perfect' ? 1.25 : grade === 'good' ? .9 : grade === 'ok' ? .6 : .35
      }
      this.shatter?.burst(lane.x, NOTE_LAYOUT.head, HIT_Z, Math.min(lane.width * .82, 2.65), .58, this.colors[note.lane], grade)
      if (grade !== 'miss') this.stageEnergy = Math.min(1, this.stageEnergy + (grade === 'perfect' ? .65 : .3))
      // Burst from the struck surface itself so the drum head visibly rings.
      const surface = receptor.object.position
      this.fx.burst(lane.x, receptor.homeY + (this.exercise.instrument === 'piano' ? .15 : .06), surface.z - (this.exercise.instrument === 'piano' ? .3 : 0), this.colors[note.lane], grade, THREE.MathUtils.clamp(lane.width / 2.3, .3, 1))
      return
    }
    if (grade === 'miss') return
    this.stageEnergy = Math.min(1, this.stageEnergy + (grade === 'perfect' ? .65 : .3))
    const size = Math.min(this.lanes[note.lane].width * .4, 1.05)
    for (let layer = 0; layer < 2; layer++) {
      const burst = this.bursts[this.burstCursor++ % this.bursts.length]
      burst.age = 0; burst.active = true; burst.mesh.visible = true
      burst.size = size; burst.upright = layer === 1
      burst.mesh.position.set(this.lanes[note.lane].x, layer ? .18 : .09, HIT_Z + (layer ? .04 : .7))
      burst.mesh.rotation.x = layer ? -.45 : -Math.PI / 2
      burst.mesh.material.color.copy(this.colors[note.lane]).lerp(this.tint.set(0xfff5d9), layer ? .7 : .15)
    }
    const total = grade === 'perfect' ? 20 : 10
    for (let i = 0; i < total; i++) {
      const spark = this.sparks[this.sparkCursor++ % this.sparks.length]
      const angle = (i / total) * Math.PI * 2 + index
      spark.x = this.lanes[note.lane].x; spark.y = .18; spark.z = HIT_Z + .2
      spark.vx = Math.cos(angle) * (2 + i % 3) * size; spark.vz = Math.sin(angle) * 1.7
      spark.vy = 2.2 + (i % 4) * .65; spark.life = .65; spark.lane = note.lane
    }
  }

  private render = (now: number) => {
    if (this.destroyed) return
    this.frameId = requestAnimationFrame(this.render)
    const rawDt = this.previousTime ? (now - this.previousTime) / 1000 : 0
    const dt = Math.min(0.05, rawDt); this.previousTime = now
    if (document.hidden || !this.inView) return
    // ResizeObserver runs after animation callbacks. Resizing there clears the
    // completed image just before paint; apply pending sizes inside this frame.
    const resized = this.viewport.flush()
    const resizing = resized || this.resizedLastFrame
    this.resizedLastFrame = resized
    // Sustained GPU pressure lowers the render scale in small steps, and only drops
    // bloom once the scale bottoms out; spare headroom slowly earns resolution back.
    // Input timing is never affected, and a layout drag never counts as pressure.
    if (!resizing && rawDt > 0.028 && rawDt < 0.2) { this.slowFrames++; this.fastFrames = 0 }
    else { this.slowFrames = Math.max(0, this.slowFrames - 1); if (!resizing && rawDt < 0.0185) this.fastFrames++ }
    if (this.slowFrames > 75) {
      this.slowFrames = 0
      this.downgrades++
      if (this.pixelRatio > .75) this.setPixelScale(this.pixelRatio - .15)
      else if (this.composer) this.disposeComposer()
    } else if (this.fastFrames > 1800 && this.downgrades < 2 && this.pixelRatio < this.maxPixelRatio && this.composer) {
      // Recover once at most: a GPU that keeps dipping would otherwise oscillate and visibly pop.
      this.fastFrames = 0
      this.setPixelScale(Math.min(this.maxPixelRatio, this.pixelRatio + .1))
    }
    const frame = this.options.readFrame()
    if (frame.attempt !== this.attempt) {
      this.attempt = frame.attempt; this.judgments.clear(); this.lastResults = null; this.stageEnergy = 0
      for (const burst of this.bursts) { burst.active = false; burst.mesh.visible = false }
      for (const receptor of this.receptors) receptor.energy = 0
      for (const spark of this.sparks) spark.life = 0
      this.miami?.fireworks.reset(); this.fx?.reset(); this.shatter?.reset(); this.lastCombo = 0
    }
    if (frame.results !== this.lastResults) {
      for (const result of changedJudgments(frame.results, this.judgments)) this.impact(result.eventIndex, result.grade)
      this.lastResults = frame.results
    }
    const speed = (HIT_Z - this.farZ) / APPROACH_SECONDS
    let count = 0, tailCount = 0
    if (frame.showNotes) {
      const first = firstVisibleNote(this.notes, frame.elapsed - 1)
      for (let i = first; i < this.notes.length && count < this.noteCapacity; i++) {
        const note = this.notes[i], delta = note.time - frame.elapsed
        if (delta > APPROACH_SECONDS) break
        // A note can pass the strike line while its timing window is still open.
        // Only the scorer's result can turn it into a miss.
        if (this.judgments.has(note.index)) continue
        const lane = this.lanes[note.lane]
        const z = HIT_Z - delta * speed
        if (z > HIT_Z + 1.25) continue
        const width = Math.min(lane.width * .82, 2.65)
        const piano = this.exercise.instrument === 'piano'
        const accent = note.accent ? 1.2 : 1
        const reveal = this.miami && !this.options.reducedMotion ? Math.min(1, Math.max(0, (APPROACH_SECONDS - delta) / .35)) : 1
        const entryScale = .6 + reveal * .4
        // Place the note itself on the strike line at its timestamp.
        // The surrounding glow is decorative; it does not define hit timing.
        const noteZ = z
        this.dummy.rotation.set(0, 0, 0)
        if (this.miami) {
          // Notes rise out of the gate's light, then ride the deck on a pool of their own glow.
          const rise = (1 - reveal) * .9
          this.dummy.position.set(lane.x, NOTE_LAYOUT.head - rise, noteZ)
          this.dummy.scale.set(width * entryScale, accent, entryScale * (note.accent ? 1.15 : 1))
          this.dummy.updateMatrix(); this.heads.setMatrixAt(count, this.dummy.matrix)
          this.heads.setColorAt(count, this.tint.copy(this.colors[note.lane]).multiplyScalar(.12).addScalar(.05))
          this.dummy.position.y = NOTE_LAYOUT.head - rise + (NOTE_LAYOUT.core - NOTE_LAYOUT.head) * accent
          this.dummy.updateMatrix(); this.cores.setMatrixAt(count, this.dummy.matrix)
          this.cores.setColorAt(count, this.tint.copy(this.colors[note.lane]).multiplyScalar(note.accent ? 1.35 : 1))
          this.dummy.position.set(lane.x, NOTE_LAYOUT.pool, noteZ)
          this.dummy.scale.set(width * 1.9 * reveal, 1, NOTE_LAYOUT.poolLength * reveal)
          this.dummy.updateMatrix(); this.trims.setMatrixAt(count, this.dummy.matrix)
          this.trims.setColorAt(count, this.colors[note.lane])
        } else {
          this.dummy.position.set(lane.x, .055, z)
          this.dummy.scale.set(width * entryScale, accent, entryScale)
          this.dummy.updateMatrix(); this.heads.setMatrixAt(count, this.dummy.matrix)
          this.heads.setColorAt(count, this.tint.copy(this.colors[note.lane]).multiplyScalar(.48))
          this.dummy.position.y = .25 * accent
          this.dummy.updateMatrix(); this.cores.setMatrixAt(count, this.dummy.matrix)
          this.cores.setColorAt(count, this.colors[note.lane])
          this.dummy.position.y = .33 * accent
          this.dummy.position.z = z + (piano ? .17 : 0)
          this.dummy.scale.set(width * entryScale, 1, (note.accent ? 1.35 : 1) * entryScale)
          this.dummy.updateMatrix(); this.trims.setMatrixAt(count, this.dummy.matrix)
          this.trims.setColorAt(count, this.tint.set(note.accent ? 0xffe8ab : 0xf3fffc))
        }
        const tailLength = Math.min(this.exercise.instrument === 'piano' ? note.duration * speed : 1.65, 18)
        this.dummy.position.set(lane.x, this.miami ? DECK_TOP + .01 : -0.025, noteZ - tailLength / 2)
        this.dummy.scale.set(width * .72, 1, Math.max(.15, tailLength))
        this.dummy.updateMatrix(); this.tails.setMatrixAt(tailCount, this.dummy.matrix)
        this.tails.setColorAt(tailCount++, this.colors[note.lane])
        count++
      }
    }
    for (const mesh of [this.heads, this.cores, this.trims]) {
      mesh.count = count; mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    }
    this.tails.count = tailCount; this.tails.instanceMatrix.needsUpdate = true
    if (this.tails.instanceColor) this.tails.instanceColor.needsUpdate = true
    // Also drives the stage ambience below, so it stays uniform
    // (bpm-based) even for a graded owner with a grid.
    const beatSec = 60 / this.exercise.bpm
    if (this.exercise.grid) {
      // Graded owners: beat lines follow the grid (bright on downbeats).
      const positions = beatLinePositions(this.exercise.grid, frame.elapsed, frame.elapsed + APPROACH_SECONDS)
      for (let i = 0; i < this.beatLines.length; i++) {
        const mesh = this.beatLines[i]
        const p = positions[i]
        if (!p) { mesh.visible = false; continue }
        const delta = p.seconds - frame.elapsed
        mesh.position.z = HIT_Z - delta * speed
        mesh.visible = true
        ;(mesh.material as THREE.MeshBasicMaterial).opacity = this.miami ? (p.downbeat ? .16 : .06) : p.downbeat ? 0.18 : 0.06
      }
    } else {
      const firstBeat = Math.floor(frame.elapsed / beatSec)
      for (let i = 0; i < this.beatLines.length; i++) {
        const delta = (firstBeat + i) * beatSec - frame.elapsed
        this.beatLines[i].position.z = HIT_Z - delta * speed
        this.beatLines[i].visible = delta >= 0 && delta <= APPROACH_SECONDS
        if (this.miami) (this.beatLines[i].material as THREE.MeshBasicMaterial).opacity = (firstBeat + i) % 4 === 0 ? .16 : .06
      }
    }
    for (const receptor of this.receptors) {
      receptor.energy = Math.max(0, receptor.energy - dt * 2.7)
      receptor.glow.material.opacity = receptor.energy * (this.fx ? .3 : 1.15)
      receptor.aura.visible = !this.fx && !this.options.reducedMotion && receptor.energy > .01
      receptor.aura.material.uniforms.energy.value = receptor.energy
      receptor.aura.scale.y = 1.5 + (1 - receptor.energy) * 3
      receptor.aura.material.uniforms.tint.value.copy(receptor.glow.material.color)
      if (this.exercise.instrument !== 'piano') receptor.object.rotation.x = this.options.reducedMotion ? 0 : Math.sin((1 - receptor.energy) * Math.PI * 3) * receptor.energy * .038
      else receptor.object.position.y = receptor.homeY - (this.options.reducedMotion ? 0 : receptor.energy * .075)
      if (this.fx && receptor.object instanceof THREE.Mesh && receptor.object.material instanceof THREE.MeshStandardMaterial && this.exercise.instrument === 'piano') {
        // Pressed keys glow in their lane colour and cool back to ivory.
        receptor.object.material.emissive.copy(receptor.glow.material.color).multiplyScalar(receptor.energy * .55)
      }
    }
    for (const burst of this.bursts) {
      if (!burst.active) continue
      burst.age += dt
      const expansion = burst.size * (.24 + (1 - Math.pow(1 - Math.min(1, burst.age / .6), 3)) * (burst.upright ? 1.12 : 1.45))
      burst.mesh.scale.set(expansion, expansion * (burst.upright ? .75 : 1), 1)
      burst.mesh.material.opacity = Math.max(0, 1 - burst.age / .6) * (burst.upright ? .45 : .9)
      if (burst.age > .6) { burst.active = false; burst.mesh.visible = false }
    }
    let sparkCount = 0
    for (const spark of this.sparks) {
      if (spark.life <= 0) continue
      spark.life -= dt; spark.vy -= dt * 6
      spark.x += spark.vx * dt; spark.y += spark.vy * dt; spark.z += spark.vz * dt
      this.dummy.position.set(spark.x, spark.y, spark.z)
      const life = Math.max(0, spark.life / .65)
      this.dummy.rotation.set(0, 0, -Math.atan2(spark.vx, Math.max(.5, spark.vy)))
      this.dummy.scale.set(life * .6, life * 2.6, life * .6)
      this.dummy.updateMatrix(); this.sparkMesh.setMatrixAt(sparkCount, this.dummy.matrix)
      this.sparkMesh.setColorAt(sparkCount++, this.colors[spark.lane])
    }
    this.sparkMesh.count = sparkCount; this.sparkMesh.instanceMatrix.needsUpdate = true
    if (this.sparkMesh.instanceColor) this.sparkMesh.instanceColor.needsUpdate = true
    this.dummy.rotation.set(0, 0, 0)
    this.stageEnergy = Math.max(0, this.stageEnergy - dt * 1.8)
    if (this.miami) {
      const beat = Math.max(0, frame.elapsed) / beatSec
      if (this.sourceGlow) this.sourceGlow.material.uniforms.phase.value = beat * Math.PI
      // A long combo slowly warms the whole stage; milestones light up the bay.
      const comboGlow = Math.min(1, frame.combo / 40)
      if (frame.combo < this.lastCombo) this.lastCombo = 0
      if (frame.playing && Math.floor(frame.combo / 16) > Math.floor(this.lastCombo / 16)) {
        this.miami.fireworks.launch(frame.combo >= 48 ? 3 : frame.combo >= 32 ? 2 : 1)
      }
      this.lastCombo = frame.combo
      this.miami.update({ elapsed: frame.elapsed, beatSeconds: beatSec, speed, hitZ: HIT_Z, playing: frame.playing, energy: Math.min(1, this.stageEnergy * .6 + comboGlow * .5), dt }, this.camera)
      if (this.grade) this.grade.uniforms.psTime.value = now / 1000
      this.fx?.update(dt)
      this.skinClock.value += dt
      this.shatter?.update(dt)
    }
    if (!this.options.reducedMotion) this.points.position.y = Math.sin(now * 0.0001) * 0.25
    if (this.composer) this.composer.render()
    else this.renderer.render(this.scene, this.camera)
  }

  private setPixelScale(ratio: number) {
    this.pixelRatio = ratio
    this.renderer.setPixelRatio(ratio)
    this.composer?.setPixelRatio(ratio)
    const { clientWidth, clientHeight } = this.container
    if (clientWidth && clientHeight) this.resize(clientWidth, clientHeight)
  }

  private disposeComposer() {
    this.composer?.passes.forEach(pass => pass.dispose())
    this.composer?.renderTarget1.dispose(); this.composer?.renderTarget2.dispose()
    this.composer?.dispose(); this.composer = null; this.bloom = null; this.grade = null
  }

  destroy() {
    if (this.destroyed) return
    this.destroyed = true; cancelAnimationFrame(this.frameId)
    this.viewport.disconnect(); this.visibilityObserver.disconnect()
    this.renderer.domElement.removeEventListener('webglcontextlost', this.onContextLost)
    this.disposeComposer(); disposeObject(this.scene); this.glowMap.dispose()
    this.environmentMap?.dispose()
    this.controls?.removeEventListener('change', this.fitLabels)
    this.controls?.dispose()
    // Finish any active decoder job so its promise settles and releases its buffers.
    // Its local finally block owns the workers; fetch itself can be aborted immediately.
    this.assetsAbort.abort()
    this.renderer.dispose(); this.renderer.forceContextLoss(); this.renderer.domElement.remove()
  }
}
