import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
import type { ExerciseDefinition, ExerciseGrid, HitGrade } from '@/lib/play-sense/types'
import { gridBeats, gridLoopSeconds } from '@/lib/play-sense/grid'
import { APPROACH_SECONDS, FAR_Z, HIT_Z, RUNWAY_WIDTH, changedJudgments, createStageModel, firstVisibleNote, type StageFrame, type StageLane, type StageNote } from './model'
import { STAGE_THEMES, type StageThemeId } from './themes'
import { box, buildDrum, buildEnvironment, buildPad, disposeObject, glowTexture, labelSprite, lightMaterial, material } from './objects'
import { block, contactShadow, cylinder, metal, rod, textured } from './craft'
import { buildAfterhours, type AfterhoursSet } from './afterhours'
import { colorNoteEmission, entranceGlow, noteChevronGeometry, noteGemGeometry, noteTrailTexture, strikeAura } from './note-geometry'
import { animateStudioWindow } from './window-motion'
import { observeFrameResize } from './frame-resize'

interface Receptor { object: THREE.Object3D; glow: THREE.Sprite; energy: number; homeY: number; aura: ReturnType<typeof strikeAura> }
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

/**
 * Every beat-line position (in engine seconds, downbeat flag) whose time
 * falls within `[windowStart, windowEnd]`, following the grid across as many
 * loop passes as the window spans. Pure so it can be tested without a GPU
 * context; the renderer turns each entry into a line's z-position and
 * brightness.
 */
export function beatLinePositions(
  grid: ExerciseGrid,
  windowStart: number,
  windowEnd: number
): { seconds: number; downbeat: boolean }[] {
  const loopLen = gridLoopSeconds(grid)
  const beats = gridBeats(grid)
  if (loopLen <= 0 || beats.length === 0 || windowEnd < windowStart) return []
  const out: { seconds: number; downbeat: boolean }[] = []
  const firstLoop = Math.floor(windowStart / loopLen)
  const lastLoop = Math.floor(windowEnd / loopLen)
  for (let loop = firstLoop; loop <= lastLoop; loop++) {
    for (const beat of beats) {
      const seconds = loop * loopLen + beat.seconds
      if (seconds >= windowStart && seconds <= windowEnd) out.push({ seconds, downbeat: beat.downbeat })
    }
  }
  return out
}

/** Owns a single GPU context. Audio time is read directly; it never grades notes. */
export class StageRenderer {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(47, 1, 0.1, 160)
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
  private afterhours: AfterhoursSet | null = null
  private stageEnergy = 0
  private boardFallback = new THREE.Group()
  private authoredNotes = false
  private labels: { sprite: THREE.Sprite; aspect: number; maxWidth: number; pixels: number }[] = []
  private labelPosition = new THREE.Vector3()
  private sourceGlow: ReturnType<typeof entranceGlow> | null = null
  private sourceLight: THREE.PointLight | null = null
  private windowMotion: ReturnType<typeof animateStudioWindow> | null = null
  private receptors: Receptor[] = []
  private bursts: Burst[] = []
  private burstCursor = 0
  private sparkMesh: THREE.InstancedMesh
  private sparks: Spark[] = Array.from({ length: 256 }, () => ({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, lane: 0 }))
  private sparkCursor = 0
  private beatLines: THREE.Mesh[] = []
  private points: THREE.Points
  private slowFrames = 0
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
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, options.quality === 'low' ? 1 : 1.5))
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = studio ? 1.02 : 1.25
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

    this.scene.add(new THREE.HemisphereLight(studio ? 0xd8c8a6 : 0xdceaff, studio ? 0x463322 : theme.background, studio ? .56 : 2.3))
    const key = new THREE.DirectionalLight(0xffd29a, studio ? 1.85 : 4.5)
    key.position.set(-10, 16, 5); this.scene.add(key)
    if (studio) {
      key.castShadow = true
      key.shadow.mapSize.set(2048, 2048)
      Object.assign(key.shadow.camera, { left: -20, right: 20, top: 23, bottom: -20, near: 1, far: 70 })
      key.shadow.camera.updateProjectionMatrix()
      key.shadow.normalBias = 0.045; key.shadow.bias = -0.0002
      key.target.position.set(0, -1, -6); this.scene.add(key.target)
      const pmrem = new THREE.PMREMGenerator(this.renderer)
      const room = new RoomEnvironment()
      this.environmentMap = pmrem.fromScene(room, 0.04)
      this.scene.environment = this.environmentMap.texture
      this.scene.environmentIntensity = 0.35
      room.dispose(); pmrem.dispose()
      const warm = new THREE.PointLight(0xffb568, 90, 24, 2)
      warm.position.set(-9, 5, -4); this.scene.add(warm)
      const cool = new THREE.PointLight(0xead6ae, 50, 24, 2)
      cool.position.set(9, 5, -5); this.scene.add(cool)
    }
    const rim = new THREE.DirectionalLight(theme.secondary, studio ? .45 : 3)
    rim.position.set(5, 5, -12); this.scene.add(rim)
    if (studio) {
      this.afterhours = buildAfterhours(exercise.instrument)
      this.scene.add(this.afterhours.group)
      this.sourceGlow = entranceGlow()
      this.sourceGlow.material.uniforms.motion.value = options.reducedMotion ? 0 : 1
      this.scene.add(this.sourceGlow)
      this.sourceLight = new THREE.PointLight(0xffbe7a, 32, 12, 2)
      this.sourceLight.position.set(0, 2, this.farZ + 1); this.scene.add(this.sourceLight)
      for (const [x, y, z] of [[-8.8, 4.65, -12], [8.9, 4.8, -12.8]]) {
        const pendant = new THREE.PointLight(0xffcd8b, 45, 14, 2)
        pendant.position.set(x, y, z); this.scene.add(pendant)
      }
    } else this.scene.add(buildEnvironment(theme))

    // Raised runway with a bevelled chassis, inlaid guides and illuminated rails.
    const runwayLength = HIT_Z - this.farZ + 1
    const runwayCenter = (HIT_Z + this.farZ - 1) / 2
    this.scene.add(this.boardFallback)
    const deck = new THREE.Mesh(new RoundedBoxGeometry(10.6, 0.35, runwayLength, 2, 0.16), material(theme.deck, studio ? 0.2 : 0.38, 0.62))
    deck.position.set(0, -0.35, runwayCenter); deck.receiveShadow = true; this.boardFallback.add(deck)
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(160, 180), material(theme.background, 0.15, 0.85))
    floor.rotation.x = -Math.PI / 2; floor.position.set(0, studio ? -3.5 : -2.5, -30); floor.receiveShadow = true; this.scene.add(floor)
    for (const side of [-1, 1]) {
      box(this.boardFallback, 0.12, 0.16, runwayLength, material(theme.metal, 0.9, 0.2), side * 5.32, -0.13, runwayCenter)
      box(this.boardFallback, 0.026, 0.035, runwayLength, lightMaterial(theme.accent, studio ? 1.2 : 2.1), side * 5.24, 0.015, runwayCenter)
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
    this.heads = new THREE.InstancedMesh(piano ? new RoundedBoxGeometry(1, .25, .64, 2, .055) : noteGemGeometry(.28), new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: .72, roughness: .24 }), capacity)
    const coreMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: .38, metalness: .28, roughness: .2 })
    colorNoteEmission(coreMaterial)
    this.cores = new THREE.InstancedMesh(piano ? new RoundedBoxGeometry(.81, .08, .46, 2, .025) : noteGemGeometry(.09, .075), coreMaterial, capacity)
    this.trims = new THREE.InstancedMesh(piano ? new RoundedBoxGeometry(.6, .025, .045, 1, .01) : noteChevronGeometry(), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), capacity)
    this.tails = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, map: noteTrailTexture(), transparent: true, opacity: .65, depthWrite: false, blending: THREE.AdditiveBlending }), capacity)
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
    if (options.quality !== 'low') {
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
      void this.loadAuthoredPlayfield()
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
          }
        })
        const previous = receptor.object
        this.scene.add(replacement)
        receptor.object = replacement
        previous.removeFromParent(); disposeObject(previous)
      })
      for (const slot of this.afterhours?.assetSlots ?? []) {
        const master = gltf.scene.getObjectByName(slot.name)
        if (!master) continue
        const replacement = master.clone(true)
        const bounds = new THREE.Box3().setFromObject(master, true)
        replacement.scale.setScalar(slot.height ? slot.height / Math.max(.1, -bounds.min.y) : 1.58)
        replacement.traverse(object => { if (object instanceof THREE.Mesh) { object.castShadow = true; object.receiveShadow = true } })
        slot.holder.add(replacement)
        slot.fallback.removeFromParent(); disposeObject(slot.fallback)
      }
      this.renderer.shadowMap.needsUpdate = true
    } catch (error) {
      if (!this.destroyed) console.warn('PlaySense could not load the Blender collection; the procedural instruments remain available.', error)
    } finally {
      decoder.dispose()
    }
  }

  /** Swap the complete Blender playfield atomically; the audio timeline never waits on assets. */
  private async loadAuthoredPlayfield() {
    const decoder = new DRACOLoader().setDecoderPath('/playsense/decoders/draco/').setWorkerLimit(1)
    let detached: THREE.Group | null = null
    try {
      const response = await fetch('/playsense/models/afterhours-playfield.glb', { signal: this.assetsAbort.signal })
      if (!response.ok) throw new Error(`Playfield download failed (${response.status})`)
      const bytes = await response.arrayBuffer()
      if (this.destroyed) return
      const gltf = await new GLTFLoader().setDRACOLoader(decoder).parseAsync(bytes, '/playsense/models/')
      detached = gltf.scene
      if (this.destroyed) return
      const parts = ['note_body', 'note_face', 'note_inlay'].map(name => {
        const master = gltf.scene.getObjectByName(name)
        const meshes: THREE.Mesh[] = []
        master?.traverse(object => { if (object instanceof THREE.Mesh) meshes.push(object) })
        if (meshes.length !== 1) throw new Error(`Invalid Blender note component: ${name}`)
        return meshes[0]
      })
      const set = ['board', 'entrance', 'lounge'].map(name => {
        const master = gltf.scene.getObjectByName(name)
        if (!master) throw new Error(`Missing Blender playfield component: ${name}`)
        return master
      })
      // Hidden masters and visible instances share one resource owner for safe teardown.
      gltf.scene.visible = false; this.scene.add(gltf.scene); detached = null
      gltf.scene.updateMatrixWorld(true)
      gltf.scene.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return
        const materials = Array.isArray(object.material) ? object.material : [object.material]
        for (const mat of materials) for (const value of Object.values(mat)) if (value instanceof THREE.Texture) {
          value.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy())
        }
      })
      for (const master of set) {
        const model = master.clone(true)
        model.traverse(object => {
          if (object instanceof THREE.Mesh) { object.castShadow = true; object.receiveShadow = true }
        })
        this.scene.add(model)
        if (master.name === 'entrance' && !this.options.reducedMotion) this.windowMotion = animateStudioWindow(model)
      }
      const targets = [this.heads, this.cores, this.trims]
      parts.forEach((part, index) => {
        const target = targets[index]
        // The Blender exporter bakes centered component pivots. Applying the source
        // matrix also keeps this safe when a later author rotates a component object.
        target.geometry.dispose()
        for (const mat of Array.isArray(target.material) ? target.material : [target.material]) mat.dispose()
        target.geometry = part.geometry.clone().applyMatrix4(part.matrixWorld)
        target.material = part.material
      })
      for (const mat of Array.isArray(this.cores.material) ? this.cores.material : [this.cores.material]) {
        if (mat instanceof THREE.MeshStandardMaterial) colorNoteEmission(mat)
      }
      this.authoredNotes = true
      this.boardFallback.removeFromParent(); disposeObject(this.boardFallback)
      if (this.sourceGlow) this.sourceGlow.visible = true
      this.renderer.shadowMap.needsUpdate = true
    } catch (error) {
      if (!this.destroyed) console.warn('PlaySense could not load the Blender playfield; the procedural board and notes remain available.', error)
    } finally {
      if (detached) disposeObject(detached)
      decoder.dispose()
    }
  }

  private resize(width: number, height: number) {
    if (this.destroyed) return
    // Raise the room lettering above the compact exercise-title row on phone layouts.
    if (this.afterhours) this.afterhours.sign.position.y = width < 520 ? 9 : 7.1
    // CSS keeps the last complete image filling the panel until this frame is drawn.
    this.renderer.setSize(width, height, false)
    this.composer?.setSize(width, height)
    this.camera.aspect = width / height
    // Keep the entire hit zone visible on portrait screens as well as lesson embeds.
    const studio = this.options.theme === 'studio'
    const piano = this.exercise.instrument === 'piano'
    const distance = studio ? Math.max(16, (piano ? 14.6 : 13) / this.camera.aspect) : Math.max(18, (piano ? 15.6 : 14) / this.camera.aspect)
    this.camera.fov = studio ? 50 : 47
    if (!this.controls) {
      this.camera.position.set(0, studio ? Math.max(8, distance * .45) : Math.max(10, distance * .45), distance)
      this.camera.lookAt(0, studio ? .8 : 0, studio ? -1 : -4)
    }
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
    this.windowMotion?.update(dt)
    // Sustained GPU pressure drops costly bloom and pixel density, never input timing.
    // A layout drag is temporary work and must not trigger a permanent quality change.
    if (!resizing && rawDt > 0.035 && rawDt < 0.2) this.slowFrames++
    else this.slowFrames = Math.max(0, this.slowFrames - 1)
    if (this.slowFrames > 100 && this.composer) {
      this.disposeComposer(); this.renderer.setPixelRatio(1)
    }
    const frame = this.options.readFrame()
    if (frame.attempt !== this.attempt) {
      this.attempt = frame.attempt; this.judgments.clear(); this.lastResults = null; this.stageEnergy = 0
      for (const burst of this.bursts) { burst.active = false; burst.mesh.visible = false }
      for (const receptor of this.receptors) receptor.energy = 0
      for (const spark of this.sparks) spark.life = 0
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
        const reveal = this.authoredNotes && !this.options.reducedMotion ? Math.min(1, Math.max(0, (APPROACH_SECONDS - delta) / .2)) : 1
        const entryScale = .72 + reveal * .28
        this.dummy.rotation.set(0, 0, 0)
        this.dummy.position.set(lane.x, .055, z)
        this.dummy.scale.set(width * entryScale, accent, entryScale)
        this.dummy.updateMatrix(); this.heads.setMatrixAt(count, this.dummy.matrix)
        this.heads.setColorAt(count, this.authoredNotes ? this.tint.set(0xffffff) : this.tint.copy(this.colors[note.lane]).multiplyScalar(.48))
        this.dummy.position.y = .25 * accent
        this.dummy.updateMatrix(); this.cores.setMatrixAt(count, this.dummy.matrix)
        this.cores.setColorAt(count, this.colors[note.lane])
        this.dummy.position.y = .33 * accent
        this.dummy.position.z = z + (piano && !this.authoredNotes ? .17 : 0)
        this.dummy.scale.set(width * entryScale, 1, (note.accent ? 1.35 : 1) * entryScale)
        this.dummy.updateMatrix(); this.trims.setMatrixAt(count, this.dummy.matrix)
        this.trims.setColorAt(count, this.tint.set(note.accent ? 0xffe8ab : 0xf3fffc))
        const tailLength = Math.min(this.exercise.instrument === 'piano' ? note.duration * speed : 1.65, 18)
        this.dummy.position.set(lane.x, -0.025, z - tailLength / 2)
        this.dummy.scale.set(width * .72, 1, Math.max(.15, tailLength))
        this.dummy.updateMatrix(); this.tails.setMatrixAt(tailCount, this.dummy.matrix)
        this.tails.setColorAt(tailCount++, this.colors[note.lane]); count++
      }
    }
    for (const mesh of [this.heads, this.cores, this.trims]) {
      mesh.count = count; mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    }
    this.tails.count = tailCount; this.tails.instanceMatrix.needsUpdate = true
    if (this.tails.instanceColor) this.tails.instanceColor.needsUpdate = true
    // Also drives the afterhours ambience pulse below, so it stays uniform
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
        ;(mesh.material as THREE.MeshBasicMaterial).opacity = p.downbeat ? 0.18 : 0.06
      }
    } else {
      const firstBeat = Math.floor(frame.elapsed / beatSec)
      for (let i = 0; i < this.beatLines.length; i++) {
        const delta = (firstBeat + i) * beatSec - frame.elapsed
        this.beatLines[i].position.z = HIT_Z - delta * speed
        this.beatLines[i].visible = delta >= 0 && delta <= APPROACH_SECONDS
      }
    }
    for (const receptor of this.receptors) {
      receptor.energy = Math.max(0, receptor.energy - dt * 2.7)
      receptor.glow.material.opacity = receptor.energy * 1.15
      receptor.aura.visible = !this.options.reducedMotion && receptor.energy > .01
      receptor.aura.material.uniforms.energy.value = receptor.energy
      receptor.aura.scale.y = 1.5 + (1 - receptor.energy) * 3
      receptor.aura.material.uniforms.tint.value.copy(receptor.glow.material.color)
      if (this.exercise.instrument !== 'piano') receptor.object.rotation.x = this.options.reducedMotion ? 0 : Math.sin((1 - receptor.energy) * Math.PI * 3) * receptor.energy * .038
      else receptor.object.position.y = receptor.homeY - (this.options.reducedMotion ? 0 : receptor.energy * .075)
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
    if (this.afterhours) {
      const beat = Math.max(0, frame.elapsed) / beatSec
      const pulse = this.options.reducedMotion || !frame.playing || frame.elapsed < 0 ? 0 : Math.pow(1 - beat % 1, 3)
      if (this.sourceGlow) this.sourceGlow.material.uniforms.phase.value = beat * Math.PI
      if (this.sourceLight) this.sourceLight.intensity = 32 + pulse * 6
      this.afterhours.pulseLights.forEach((light, i) => { light.intensity = 30 + pulse * 10 + this.stageEnergy * (i ? 18 : 24) })
      this.afterhours.meters.forEach((bar, i) => {
        const wave = this.options.reducedMotion ? .35 : .18 + .55 * Math.pow(.5 + .5 * Math.sin(beat * Math.PI - i * .62), 2)
        bar.scale.y = .18 + wave + this.stageEnergy * .4
        bar.position.y = -1.4 + bar.scale.y / 2
      })
    }
    if (!this.options.reducedMotion) this.points.position.y = Math.sin(now * 0.0001) * 0.25
    if (this.composer) this.composer.render()
    else this.renderer.render(this.scene, this.camera)
  }

  private disposeComposer() {
    this.composer?.passes.forEach(pass => pass.dispose())
    this.composer?.dispose(); this.composer = null; this.bloom = null
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
