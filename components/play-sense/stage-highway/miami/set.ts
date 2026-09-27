import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { HIT_Z, RUNWAY_WIDTH } from '../model'
import { SEA_Y } from './sky'
import { billboards } from './glow'
import { photoTexture } from './textures'

export const TERRACE_Y = -3.2
export const DECK_TOP = -0.17
export const GATE_Z = -26.1
const SEAWALL_Z = -1.7

const rand = (seed: number) => { const x = Math.sin(seed * 78.233 + 12.9898) * 43758.5453; return x - Math.floor(x) }

function canvasTexture(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void, srgb = true) {
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height
  draw(canvas.getContext('2d')!)
  const texture = new THREE.CanvasTexture(canvas)
  if (srgb) texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.anisotropy = 8
  return texture
}

/** Long, quarter-sawn ebony boards under a deep lacquer. */
function deckTexture() {
  return canvasTexture(512, 2048, ctx => {
    ctx.fillStyle = '#231913'; ctx.fillRect(0, 0, 512, 2048)
    const boards = 8
    for (let b = 0; b < boards; b++) {
      const x0 = b * 64, tone = 26 + rand(b) * 14
      ctx.fillStyle = `rgb(${tone + 10 | 0},${tone | 0},${tone * .72 | 0})`; ctx.fillRect(x0, 0, 64, 2048)
      for (let i = 0; i < 70; i++) {
        const x = x0 + rand(b * 100 + i) * 64, w = .6 + rand(i + b) * 1.8
        ctx.strokeStyle = `rgba(${rand(i) > .5 ? '12,8,6' : '70,48,32'},${.15 + rand(i * 3 + b) * .3})`
        ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x, 0)
        for (let y = 0; y <= 2048; y += 128) ctx.lineTo(x + Math.sin(y * .004 + i + b) * 3, y)
        ctx.stroke()
      }
      ctx.fillStyle = 'rgba(0,0,0,.65)'; ctx.fillRect(x0, 0, 1.5, 2048)
      const joint = rand(b + 50) * 2048
      ctx.fillRect(x0, joint, 64, 1.5)
    }
  })
}

/** Polished Miami Beach terrazzo: marble chips in a warm cement with brass divider strips. */
function terrazzoTexture() {
  return canvasTexture(1024, 1024, ctx => {
    ctx.fillStyle = '#ddd5c8'; ctx.fillRect(0, 0, 1024, 1024)
    const chips = ['#f3eee6', '#e9a3ab', '#86c8bc', '#9d958c', '#3d3833', '#d4b36d', '#c7c0b5', '#f2c7c2']
    for (let i = 0; i < 9000; i++) {
      const x = rand(i * 1.3) * 1024, y = rand(i * 2.7 + 5) * 1024
      const r = 1.2 + Math.pow(rand(i * 3.1 + 9), 3) * 7
      ctx.fillStyle = chips[Math.floor(rand(i * 4.9 + 1) * chips.length)]
      ctx.beginPath()
      const sides = 5 + Math.floor(rand(i + 77) * 3)
      for (let k = 0; k < sides; k++) {
        const a = k / sides * Math.PI * 2 + rand(i + k)
        const rr = r * (.6 + rand(i * 7 + k) * .5)
        if (k) ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr)
        else ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr)
      }
      ctx.fill()
    }
    // Brass divider strips: a square field with a quarter-circle deco sweep in each corner.
    ctx.strokeStyle = '#b58a3e'; ctx.lineWidth = 4
    ctx.strokeRect(2, 2, 1020, 1020)
    for (const [cx, cy] of [[0, 0], [1024, 0], [0, 1024], [1024, 1024]]) for (const r of [300, 330]) {
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke()
    }
  })
}

function stoneTexture(color: string) {
  return canvasTexture(256, 256, ctx => {
    ctx.fillStyle = color; ctx.fillRect(0, 0, 256, 256)
    const img = ctx.getImageData(0, 0, 256, 256)
    for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
      const i = (y * 256 + x) * 4
      const n = (rand(x * 1.3 + y * 311.7) - .5) * 30 + Math.sin(x * .05 + Math.sin(y * .07) * 2) * 8
      img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n
    }
    ctx.putImageData(img, 0, 0)
  })
}

export interface BeatUniforms {
  psElapsed: { value: number }
  psBeat: { value: number }
  psSpeed: { value: number }
  psHitZ: { value: number }
  psLive: { value: number }
  psEnergy: { value: number }
  psClock: { value: number }
}

/**
 * Instanced bulbs whose brightness is computed on the GPU: `chase` bulbs light up
 * where a beat currently sits on the runway, so a wave of light rides in with the music.
 */
function bulbs(positions: THREE.Vector3[], uniforms: BeatUniforms, chase: boolean, radius: number, color: THREE.Color) {
  const geometry = new THREE.SphereGeometry(radius, 12, 8)
  const mesh = new THREE.InstancedMesh(geometry, new THREE.ShaderMaterial({
    uniforms: { ...uniforms, psColor: { value: color } } as unknown as Record<string, THREE.IUniform>,
    vertexShader: /* glsl */ `
      uniform float psElapsed; uniform float psBeat; uniform float psSpeed; uniform float psHitZ; uniform float psLive; uniform float psEnergy; uniform float psClock;
      varying float vGlow; varying vec3 vNormal; varying vec3 vView;
      void main() {
        vec4 world = modelMatrix * instanceMatrix * vec4(position, 1.);
        float seed = fract(sin(dot(instanceMatrix[3].xz, vec2(12.9898, 78.233))) * 43758.5453);
        ${chase ? `
          float ahead = (psHitZ - instanceMatrix[3].z) / psSpeed;
          float beats = (psElapsed + ahead) / psBeat;
          float phase = fract(beats);
          float nearest = min(phase, 1. - phase);
          float downbeat = step(mod(floor(beats + .5), 4.), .5);
          float wave = exp(-nearest * nearest * 90.) * (.55 + .45 * downbeat);
          vGlow = .2 + psLive * wave * (1.9 + psEnergy * 1.4) + (1. - psLive) * .16 * (.5 + .5 * sin(psClock * 1.4 + seed * 6.28));` : `
          vGlow = (.45 + .55 * step(.35, seed)) * (.75 + .25 * sin(psClock * (1.1 + seed) + seed * 40.)) + psEnergy * .3;`}
        vNormal = normalize(normalMatrix * mat3(instanceMatrix) * normal);
        vec4 viewPos = viewMatrix * world;
        vView = -viewPos.xyz;
        gl_Position = projectionMatrix * viewPos;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 psColor;
      varying float vGlow; varying vec3 vNormal; varying vec3 vView;
      void main() {
        float facing = abs(dot(normalize(vNormal), normalize(vView)));
        vec3 filament = psColor * vGlow * (1.4 + 2.2 * pow(facing, 3.));
        gl_FragColor = vec4(filament, 1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }), positions.length)
  const dummy = new THREE.Object3D()
  positions.forEach((p, i) => { dummy.position.copy(p); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix) })
  return mesh
}

/** Merge primitives regardless of indexing; keeps only the attributes every part shares. */
export function merge(parts: THREE.BufferGeometry[]) {
  const flat = parts.map(g => {
    const part = g.index ? g.toNonIndexed() : g
    for (const name of Object.keys(part.attributes)) if (!['position', 'normal', 'uv'].includes(name)) part.deleteAttribute(name)
    return part
  })
  const merged = mergeGeometries(flat)!
  parts.forEach(g => g.dispose()); flat.forEach(g => g.dispose())
  return merged
}

export function createSet(uniforms: BeatUniforms, farZ: number, quality: 'standard' | 'low', boatSide = 1) {
  const group = new THREE.Group()
  const anisotropy = quality === 'low' ? 1 : 8
  const chassisWood = new THREE.MeshStandardMaterial({ color: 0x3a2417, roughness: .45, metalness: 0 })
  const darkIron = new THREE.MeshStandardMaterial({ color: 0x15171a, metalness: .6, roughness: .45 })
  const stone = new THREE.MeshStandardMaterial({ map: stoneTexture('#efe8dd'), roughness: .75, color: 0xd6cfc5 })
  const aqua = new THREE.MeshStandardMaterial({ color: 0x4fb8ad, roughness: .5 })
  const chrome = new THREE.MeshStandardMaterial({ color: 0xe6e8ea, metalness: 1, roughness: .12 })
  const timber = new THREE.MeshStandardMaterial({ color: 0x5a4a3c, roughness: .85 })
  const rubber = new THREE.MeshStandardMaterial({ color: 0x141416, roughness: .6 })
  const capWhite = new THREE.MeshStandardMaterial({ color: 0xece8e0, roughness: .45 })
  const rope = new THREE.MeshStandardMaterial({ color: 0xc9b58e, roughness: .9 })

  // The dock: weathered teak planks laid across its width on a timber frame.
  const front = HIT_Z + 1.25, back = farZ - 1.3
  const length = front - back, center = (front + back) / 2
  const frame = new THREE.Mesh(new RoundedBoxGeometry(RUNWAY_WIDTH + 1.1, .7, length + .3, 2, .05), chassisWood)
  frame.position.set(0, DECK_TOP - .38, center); frame.receiveShadow = true; group.add(frame)
  const planks = photoTexture('/playsense/textures/dock.jpg', deckTexture(), [(RUNWAY_WIDTH + .9) / 7.4, length / 7.4], anisotropy)
  const deckMaterial = new THREE.MeshPhysicalMaterial({ map: planks, bumpMap: planks, bumpScale: 1.4, color: 0x9a8a7c, roughness: .6, clearcoat: .3, clearcoatRoughness: .35, envMapIntensity: .65 })
  const surface = new THREE.Mesh(new THREE.PlaneGeometry(RUNWAY_WIDTH + .9, length).rotateX(-Math.PI / 2), deckMaterial)
  surface.position.set(0, DECK_TOP, center); surface.receiveShadow = true
  group.add(surface)
  const edgeParts: THREE.BufferGeometry[] = [], fenderParts: THREE.BufferGeometry[] = [], cleatParts: THREE.BufferGeometry[] = []
  const edgeX = RUNWAY_WIDTH / 2 + .45
  for (const side of [-1, 1]) {
    // Fascia boards and a continuous D-fender on the boat side.
    edgeParts.push(new THREE.BoxGeometry(.12, .5, length + .2).translate(side * (edgeX + .06), DECK_TOP - .2, center))
    edgeParts.push(new THREE.BoxGeometry(.22, .08, length + .2).translate(side * edgeX, DECK_TOP + .02, center))
    if (side === boatSide) fenderParts.push(new THREE.CylinderGeometry(.09, .09, length, 10, 1).rotateX(Math.PI / 2).translate(side * (edgeX + .15), DECK_TOP - .12, center))
    for (let z = front - 3; z > back + 1; z -= 4.4) {
      cleatParts.push(new THREE.BoxGeometry(.1, .08, .42).translate(side * (edgeX - .08), DECK_TOP + .1, z))
      cleatParts.push(new THREE.BoxGeometry(.08, .08, .08).translate(side * (edgeX - .08), DECK_TOP + .05, z))
    }
  }
  const edges = new THREE.Mesh(merge(edgeParts), timber); edges.receiveShadow = true; group.add(edges)
  if (fenderParts.length) group.add(new THREE.Mesh(merge(fenderParts), rubber))
  group.add(new THREE.Mesh(merge(cleatParts), chrome))

  // Round timber pilings: under the deck, and standing proud of it along both edges with
  // white caps and rope wraps, the unmistakable silhouette of a marina dock.
  const pilings: THREE.BufferGeometry[] = [], caps: THREE.BufferGeometry[] = [], wraps: THREE.BufferGeometry[] = []
  const pilingTop = DECK_TOP + 1.25
  for (let z = front - 1.6; z > back; z -= 5.2) {
    for (const side of [-1, 1]) {
      const x = side * (edgeX + .38)
      pilings.push(new THREE.CylinderGeometry(.2, .24, pilingTop - SEA_Y, 14).translate(x, (pilingTop + SEA_Y) / 2, z))
      caps.push(new THREE.ConeGeometry(.24, .22, 14).translate(x, pilingTop + .11, z))
      for (let k = 0; k < 3; k++) wraps.push(new THREE.TorusGeometry(.215, .025, 6, 16).rotateX(Math.PI / 2).translate(x, DECK_TOP + .55 + k * .07, z))
      pilings.push(new THREE.CylinderGeometry(.26, .3, DECK_TOP - SEA_Y, 12).translate(side * (RUNWAY_WIDTH / 2 - .6), (DECK_TOP + SEA_Y) / 2 - .3, z))
    }
    pilings.push(new THREE.BoxGeometry(RUNWAY_WIDTH, .3, .3).translate(0, DECK_TOP - 1.3, z))
  }
  const pier = new THREE.Mesh(merge(pilings), timber); pier.castShadow = true; group.add(pier)
  group.add(new THREE.Mesh(merge(caps), capWhite))
  group.add(new THREE.Mesh(merge(wraps), rope))

  // Bollard lights along both edges; their lamps chase the beat toward the player.
  const railBulbs: THREE.Vector3[] = []
  const bollards: THREE.BufferGeometry[] = []
  for (let z = front - .5; z > back + .3; z -= 1.64) for (const side of [-1, 1]) {
    const x = side * (edgeX - .02)
    railBulbs.push(new THREE.Vector3(x, DECK_TOP + .44, z))
    bollards.push(new THREE.CylinderGeometry(.075, .09, .36, 10).translate(x, DECK_TOP + .2, z))
    bollards.push(new THREE.CylinderGeometry(.1, .1, .04, 10).translate(x, DECK_TOP + .52, z))
  }
  group.add(bulbs(railBulbs, uniforms, true, .07, new THREE.Color(1, .66, .34)))
  group.add(new THREE.Mesh(merge(bollards), darkIron))

  // The bayfront promenade: coral-stone pavers, a white stucco seawall with a chrome rail, streetlamps.
  const tiles = photoTexture('/playsense/textures/pavers.jpg', terrazzoTexture(), [120 / 5.2, 48 / 5.2], anisotropy)
  const terrace = new THREE.Mesh(new THREE.PlaneGeometry(120, 48).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: tiles, bumpMap: tiles, bumpScale: 1.2, roughness: .55, color: 0x8a8177, envMapIntensity: .55 }))
  terrace.position.set(0, TERRACE_Y, SEAWALL_Z + 24); terrace.receiveShadow = true; group.add(terrace)
  const wallParts: THREE.BufferGeometry[] = [], bandParts: THREE.BufferGeometry[] = [], railParts: THREE.BufferGeometry[] = []
  for (const side of [-1, 1]) {
    const inner = RUNWAY_WIDTH / 2 + 1.2
    const width = 60 - inner, x = side * (inner + width / 2)
    wallParts.push(new RoundedBoxGeometry(width, .8, 1, 2, .08).translate(x, TERRACE_Y + .4, SEAWALL_Z))
    bandParts.push(new THREE.BoxGeometry(width, .12, 1.03).translate(x, TERRACE_Y + .6, SEAWALL_Z))
    railParts.push(new THREE.CylinderGeometry(.06, .06, width, 10).rotateZ(Math.PI / 2).translate(x, TERRACE_Y + 1.75, SEAWALL_Z))
    for (let p = 0; p <= width; p += 2.4) railParts.push(new THREE.CylinderGeometry(.035, .035, .95, 8).translate(side * (inner + p), TERRACE_Y + 1.28, SEAWALL_Z))
  }
  wallParts.push(new THREE.BoxGeometry(120, TERRACE_Y - SEA_Y, .8).translate(0, (TERRACE_Y + SEA_Y) / 2, SEAWALL_Z - .4))
  const seawall = new THREE.Mesh(merge(wallParts), stone)
  group.add(new THREE.Mesh(merge(bandParts), aqua))
  const rail = new THREE.Mesh(merge(railParts), chrome); rail.castShadow = true; group.add(rail)
  seawall.receiveShadow = true; seawall.castShadow = true; group.add(seawall)

  const lampGlobes: THREE.Vector3[] = []
  const lampParts: THREE.BufferGeometry[] = []
  for (const x of [-10.4, 10.4, -22, 22, -33, 33]) {
    const y = TERRACE_Y + .95
    lampParts.push(new THREE.CylinderGeometry(.2, .28, .5, 10).translate(x, y + .25, SEAWALL_Z))
    lampParts.push(new THREE.CylinderGeometry(.06, .09, 5.4, 10).translate(x, y + 3.1, SEAWALL_Z))
    lampParts.push(new THREE.TorusGeometry(.3, .035, 6, 16, Math.PI).rotateY(Math.PI / 2).translate(x, y + 5.9, SEAWALL_Z))
    lampParts.push(new THREE.CylinderGeometry(.18, .12, .22, 10).translate(x, y + 5.85, SEAWALL_Z))
    lampGlobes.push(new THREE.Vector3(x, y + 6.25, SEAWALL_Z))
  }
  const lampPosts = new THREE.Mesh(merge(lampParts), darkIron)
  lampPosts.castShadow = true; group.add(lampPosts);
  group.add(bulbs(lampGlobes, uniforms, false, .34, new THREE.Color(.95, .62, .36)))

  // Festoon strings sweep along the open side of the dock between slim masts.
  const masts: THREE.BufferGeometry[] = []
  const festoon: THREE.Vector3[] = []
  const mastZ = [-3.4, -11, -18.6, farZ + 1.2]
  const mastX = RUNWAY_WIDTH / 2 + 1.35
  const top = 5.4
  for (const side of [-boatSide]) {
    for (const z of mastZ) {
      masts.push(new THREE.CylinderGeometry(.06, .09, top - SEA_Y, 10).translate(side * mastX, (top + SEA_Y) / 2 + .01, z))
      masts.push(new THREE.SphereGeometry(.13, 10, 8).translate(side * mastX, top + .05, z))
    }
    for (let m = 0; m < mastZ.length - 1; m++) {
      const a = mastZ[m], b = mastZ[m + 1], span = a - b
      const points: THREE.Vector3[] = []
      for (let i = 0; i <= 24; i++) {
        const t = i / 24
        points.push(new THREE.Vector3(side * mastX, top - Math.sin(t * Math.PI) * (.55 + span * .04), a - span * t))
      }
      masts.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 24, .018, 4, false))
      for (let i = 1; i < 9; i++) {
        const p = points[Math.round(i / 9 * 24)]
        festoon.push(new THREE.Vector3(p.x, p.y - .22, p.z))
      }
    }
  }
  const mastMesh = new THREE.Mesh(merge(masts), darkIron)
  group.add(mastMesh);
  group.add(bulbs(festoon, uniforms, false, .11, new THREE.Color(1.25, .72, .38)))

  // The light gate. Nothing stands between the player and the skyline: notes condense out
  // of a shimmering veil above a glowing threshold, marked by two slim deco pylons.
  const gateZ = back + .2
  const gateGlow = { value: 0 }
  const threshold = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.1, 1.8) })
  const line = new THREE.Mesh(new THREE.BoxGeometry(RUNWAY_WIDTH + .5, .045, .07), threshold)
  line.position.set(0, DECK_TOP + .03, gateZ); group.add(line)
  const veil = new THREE.Mesh(new THREE.PlaneGeometry(RUNWAY_WIDTH + 1.6, 3.4).translate(0, 1.7, 0), new THREE.ShaderMaterial({
    uniforms: { psClock: uniforms.psClock, psGlow: gateGlow },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: /* glsl */ `
      uniform float psClock; uniform float psGlow; varying vec2 vUv;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
        return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x), mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), f.x), f.y); }
      void main() {
        float rise = pow(max(0., 1. - vUv.y), 2.2);
        float edges = smoothstep(0., .14, vUv.x) * smoothstep(0., .14, 1. - vUv.x);
        // Slow vertical light curtains drifting sideways, like heat shimmer over the water.
        float curtain = noise(vec2(vUv.x * 7. + psClock * .12, vUv.y * 1.6 - psClock * .35));
        curtain = .35 + .65 * curtain * curtain + .25 * noise(vec2(vUv.x * 23. - psClock * .3, vUv.y * 4.));
        vec3 color = mix(vec3(1.25, .3, .85), vec3(.3, .95, 1.15), smoothstep(.15, .7, vUv.y) * .8 + .2 * sin(vUv.x * 6.28 + psClock * .3));
        // Warm shafts rising from the threshold mark the destination.
        float shafts = 0.;
        for (int i = 0; i < 5; i++) {
          float fi = float(i);
          float cx = .14 + fi * .18 + .012 * sin(psClock * (.6 + fi * .13) + fi * 2.);
          float dx = (vUv.x - cx) / .012;
          shafts += exp(-dx * dx) * (.6 + .4 * sin(psClock * (1.1 + fi * .3) + fi));
        }
        vec3 warm = vec3(1.25, 1., .65) * shafts * pow(max(0., 1. - vUv.y), 1.4) * .22;
        gl_FragColor = vec4(color * rise * edges * curtain * (.3 + psGlow * .35) + warm * edges, 1.);
      }`,
  }))
  veil.position.set(0, DECK_TOP, gateZ - .05); veil.renderOrder = 2
  group.add(veil)
  const pylonParts: THREE.BufferGeometry[] = [], capParts: THREE.BufferGeometry[] = [], stripParts: THREE.BufferGeometry[] = []
  const pylonX = RUNWAY_WIDTH / 2 + .78
  for (const side of [-1, 1]) {
    const x = side * pylonX
    pylonParts.push(new RoundedBoxGeometry(.42, 3.4, .42, 2, .06).translate(x, DECK_TOP + 1.7, gateZ))
    pylonParts.push(new RoundedBoxGeometry(.62, .22, .62, 2, .05).translate(x, DECK_TOP + .11, gateZ))
    for (let i = 0; i < 3; i++) capParts.push(new THREE.BoxGeometry(.5 - i * .1, .05, .5 - i * .1).translate(x, DECK_TOP + 3.48 + i * .13, gateZ))
    stripParts.push(new THREE.BoxGeometry(.035, 2.9, .035).translate(x - side * .215, DECK_TOP + 1.75, gateZ + .215))
  }
  const pylons = new THREE.Mesh(merge(pylonParts), stone); pylons.castShadow = true; group.add(pylons)
  const neonMaterial = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, .45, 1.4) })
  group.add(new THREE.Mesh(merge(capParts), neonMaterial))
  group.add(new THREE.Mesh(merge(stripParts), new THREE.MeshBasicMaterial({ color: new THREE.Color(.3, 1.6, 1.8) })))

  // Everything that glows over the water leaves a shimmering streak on it.
  const water = SEA_Y + .03
  const reflect = (points: THREE.Vector3[]) => points.map(p => new THREE.Vector3(p.x, water, p.z))
  group.add(billboards(reflect(festoon.filter((_, i) => i % 2 === 0)), new THREE.Color(.9, .5, .24), .22, 6, uniforms.psClock, 'reflection'))
  group.add(billboards([-pylonX, pylonX].map(x => new THREE.Vector3(x, water, gateZ + .6)), new THREE.Color(1.5, .35, 1), .5, 9, uniforms.psClock, 'reflection'))

  const neonBase = neonMaterial.color.clone()
  return {
    group,
    lampGlobes,
    update(pulse: number, energy: number) {
      neonMaterial.color.copy(neonBase).multiplyScalar(.8 + pulse * .45 + energy * .6)
      threshold.color.setRGB(2.2, 1.1, 1.8).multiplyScalar(.75 + pulse * .5 + energy * .4)
      gateGlow.value = pulse * .6 + energy
    },
  }
}
