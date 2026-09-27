import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { HIT_Z, RUNWAY_WIDTH } from '../model'
import { SEA_Y } from './sky'
import { billboards } from './glow'

export const TERRACE_Y = -3.2
export const DECK_TOP = -0.17
export const ARCH_Z = -26.9
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

/** Cuban cement tile: a four-petal rosette in terracotta, teal and cream. */
function tileTexture() {
  return canvasTexture(512, 512, ctx => {
    const s = 256
    for (let ty = 0; ty < 2; ty++) for (let tx = 0; tx < 2; tx++) {
      ctx.save(); ctx.translate(tx * s, ty * s)
      ctx.fillStyle = '#b6a585'; ctx.fillRect(0, 0, s, s)
      ctx.fillStyle = '#2d4b48'
      for (const [cx, cy] of [[0, 0], [s, 0], [0, s], [s, s]]) { ctx.beginPath(); ctx.arc(cx, cy, s * .3, 0, Math.PI * 2); ctx.fill() }
      ctx.fillStyle = '#b6a585'
      for (const [cx, cy] of [[0, 0], [s, 0], [0, s], [s, s]]) { ctx.beginPath(); ctx.arc(cx, cy, s * .2, 0, Math.PI * 2); ctx.fill() }
      ctx.fillStyle = '#80473a'
      for (let i = 0; i < 4; i++) {
        ctx.save(); ctx.translate(s / 2, s / 2); ctx.rotate(i * Math.PI / 2)
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(s * .16, -s * .08, s * .2, -s * .3, 0, -s * .38)
        ctx.bezierCurveTo(-s * .2, -s * .3, -s * .16, -s * .08, 0, 0); ctx.fill(); ctx.restore()
      }
      ctx.fillStyle = '#e8d9b8'; ctx.beginPath(); ctx.arc(s / 2, s / 2, s * .06, 0, Math.PI * 2); ctx.fill()
      ctx.strokeStyle = '#2d4b48'; ctx.lineWidth = 5; ctx.strokeRect(s * .06, s * .06, s * .88, s * .88)
      ctx.strokeStyle = 'rgba(40,30,20,.55)'; ctx.lineWidth = 3; ctx.strokeRect(0, 0, s, s)
      ctx.restore()
    }
    const grime = ctx.getImageData(0, 0, 512, 512)
    for (let i = 0; i < grime.data.length; i += 4) {
      const n = (rand(i * .37) - .5) * 26
      grime.data[i] += n; grime.data[i + 1] += n; grime.data[i + 2] += n
    }
    ctx.putImageData(grime, 0, 0)
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

/** A deco archway frame as one U-shaped outline: outer edge up and over, inner edge back down. */
function archFrame(outer: number, inner: number, bottom: number, spring: number, depth: number) {
  const shape = new THREE.Shape()
  shape.moveTo(-outer, bottom)
  shape.lineTo(-outer, spring)
  shape.absarc(0, spring, outer, Math.PI, 0, true)
  shape.lineTo(outer, bottom)
  shape.lineTo(inner, bottom)
  shape.lineTo(inner, spring)
  shape.absarc(0, spring, inner, 0, Math.PI, false)
  shape.lineTo(-inner, bottom)
  shape.closePath()
  return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: .08, bevelSize: .06, bevelSegments: 2, curveSegments: 48 })
}

function archLine(radius: number, spring: number, legBottom: number, z: number) {
  const points: THREE.Vector3[] = []
  for (let i = 0; i <= 6; i++) points.push(new THREE.Vector3(-radius, THREE.MathUtils.lerp(legBottom, spring, i / 6), z))
  for (let i = 1; i < 64; i++) { const a = Math.PI - i / 64 * Math.PI; points.push(new THREE.Vector3(Math.cos(a) * radius, spring + Math.sin(a) * radius, z)) }
  for (let i = 0; i <= 6; i++) points.push(new THREE.Vector3(radius, THREE.MathUtils.lerp(spring, legBottom, i / 6), z))
  return new THREE.CatmullRomCurve3(points, false, 'centripetal')
}

export function createSet(uniforms: BeatUniforms, farZ: number, quality: 'standard' | 'low') {
  const group = new THREE.Group()
  const anisotropy = quality === 'low' ? 1 : 8
  const lacquer = new THREE.MeshPhysicalMaterial({ map: deckTexture(), color: 0xffffff, roughness: .38, clearcoat: 1, clearcoatRoughness: .13, envMapIntensity: .9 })
  lacquer.map!.repeat.set(1, 1)
  const chassisWood = new THREE.MeshStandardMaterial({ color: 0x3a2417, roughness: .45, metalness: 0 })
  const brass = new THREE.MeshStandardMaterial({ color: 0xd8a55a, metalness: 1, roughness: .26 })
  const darkIron = new THREE.MeshStandardMaterial({ color: 0x15171a, metalness: .6, roughness: .45 })
  const stone = new THREE.MeshStandardMaterial({ map: stoneTexture('#d7c6a6'), roughness: .8, color: 0xbfae92 })

  // Deck: lacquered playing surface on a chassis, brass inlays at every lane boundary.
  const front = HIT_Z + 1.25, back = farZ - 1.3
  const length = front - back, center = (front + back) / 2
  const chassis = new THREE.Mesh(new RoundedBoxGeometry(RUNWAY_WIDTH + 1.3, .95, length + .3, 3, .16), chassisWood)
  chassis.position.set(0, DECK_TOP - .52, center); chassis.receiveShadow = true; group.add(chassis)
  const surface = new THREE.Mesh(new THREE.PlaneGeometry(RUNWAY_WIDTH + .4, length).rotateX(-Math.PI / 2), lacquer)
  surface.position.set(0, DECK_TOP, center); surface.receiveShadow = true
  lacquer.map!.repeat.set(1, length / 14)
  lacquer.map!.anisotropy = anisotropy
  group.add(surface)
  for (const side of [-1, 1]) {
    const rail = new THREE.Mesh(new RoundedBoxGeometry(.34, .3, length + .2, 2, .12), brass)
    rail.position.set(side * (RUNWAY_WIDTH / 2 + .38), DECK_TOP + .07, center); rail.castShadow = true; group.add(rail)
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(.05, .06, length), brass)
    skirt.position.set(side * (RUNWAY_WIDTH / 2 + .66), DECK_TOP - .7, center); group.add(skirt)
  }

  // Pier pilings and cross-bracing down into the water.
  const pilings: THREE.BufferGeometry[] = []
  for (let z = front - 2; z > back; z -= 5.2) {
    for (const side of [-1, 1]) pilings.push(new THREE.CylinderGeometry(.34, .42, DECK_TOP - SEA_Y - .5, 14).translate(side * (RUNWAY_WIDTH / 2 - .2), (DECK_TOP + SEA_Y - .5) / 2 - .25, z))
    pilings.push(new THREE.BoxGeometry(RUNWAY_WIDTH, .34, .34).translate(0, DECK_TOP - 1.4, z))
  }
  const pier = new THREE.Mesh(merge(pilings), new THREE.MeshStandardMaterial({ color: 0x241712, roughness: .7 }))
  group.add(pier)

  // Marquee bulbs ride both rails; each sits in a small brass cup.
  const railBulbs: THREE.Vector3[] = []
  for (let z = front - .35; z > back + .2; z -= .82) for (const side of [-1, 1]) railBulbs.push(new THREE.Vector3(side * (RUNWAY_WIDTH / 2 + .38), DECK_TOP + .31, z))
  group.add(bulbs(railBulbs, uniforms, true, .085, new THREE.Color(1, .66, .34)))
  const cups = new THREE.InstancedMesh(new THREE.CylinderGeometry(.1, .07, .1, 10), brass, railBulbs.length)
  const dummy = new THREE.Object3D()
  railBulbs.forEach((p, i) => { dummy.position.set(p.x, p.y - .1, p.z); dummy.updateMatrix(); cups.setMatrixAt(i, dummy.matrix) })
  group.add(cups)

  // The Malecón: tiled terrace, coral-stone seawall and iron streetlamps.
  const tiles = tileTexture()
  tiles.repeat.set(40, 16)
  tiles.anisotropy = anisotropy
  const terrace = new THREE.Mesh(new THREE.PlaneGeometry(120, 48).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: tiles, roughness: .3, color: 0x7d746a, envMapIntensity: .7 }))
  terrace.position.set(0, TERRACE_Y, SEAWALL_Z + 24); terrace.receiveShadow = true; group.add(terrace)
  const wallParts: THREE.BufferGeometry[] = []
  for (const side of [-1, 1]) {
    const inner = RUNWAY_WIDTH / 2 + 1.2
    const width = 60 - inner
    wallParts.push(new RoundedBoxGeometry(width, .85, 1.1, 2, .1).translate(side * (inner + width / 2), TERRACE_Y + .42, SEAWALL_Z))
    wallParts.push(new RoundedBoxGeometry(width + .1, .2, 1.42, 3, .09).translate(side * (inner + width / 2), TERRACE_Y + .9, SEAWALL_Z))
  }
  wallParts.push(new THREE.BoxGeometry(120, TERRACE_Y - SEA_Y, .8).translate(0, (TERRACE_Y + SEA_Y) / 2, SEAWALL_Z - .4))
  const seawall = new THREE.Mesh(merge(wallParts), stone)
  seawall.receiveShadow = true; seawall.castShadow = true; group.add(seawall)

  const lampGlobes: THREE.Vector3[] = []
  const lampParts: THREE.BufferGeometry[] = []
  for (const x of [-8.6, 8.6, -21, 21, -33, 33]) {
    const y = TERRACE_Y + .95
    lampParts.push(new THREE.CylinderGeometry(.2, .28, .5, 10).translate(x, y + .25, SEAWALL_Z))
    lampParts.push(new THREE.CylinderGeometry(.075, .11, 5.4, 10).translate(x, y + 3.1, SEAWALL_Z))
    lampParts.push(new THREE.TorusGeometry(.3, .035, 6, 16, Math.PI).rotateY(Math.PI / 2).translate(x, y + 5.9, SEAWALL_Z))
    lampParts.push(new THREE.CylinderGeometry(.18, .12, .22, 10).translate(x, y + 5.85, SEAWALL_Z))
    lampGlobes.push(new THREE.Vector3(x, y + 6.25, SEAWALL_Z))
  }
  const lampPosts = new THREE.Mesh(merge(lampParts), darkIron)
  lampPosts.castShadow = true; group.add(lampPosts);
  group.add(bulbs(lampGlobes, uniforms, false, .34, new THREE.Color(1.3, .82, .45)))

  // Festoon strings sweep along both sides of the pier between slim brass masts.
  const masts: THREE.BufferGeometry[] = []
  const festoon: THREE.Vector3[] = []
  const mastZ = [-3.4, -11, -18.6, farZ + 1.2]
  const mastX = RUNWAY_WIDTH / 2 + 1.35
  const top = 5.4
  for (const side of [-1, 1]) {
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

  // The archway. Two stepped stone frames, a brass reveal, neon on the inner edge.
  const arch = new THREE.Group()
  arch.position.set(0, 0, ARCH_Z)
  const archStone = new THREE.MeshStandardMaterial({ map: stoneTexture('#e3c9a6'), roughness: .72, color: 0xd9a77c })
  // Faked occlusion: the stone darkens toward the water and in the reveal, like weathered stucco.
  archStone.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying float psHeight;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\npsHeight = (modelMatrix * vec4(transformed, 1.)).y;')
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying float psHeight;').replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.rgb *= mix(vec3(.42, .3, .34), vec3(1.), smoothstep(-5., 6., psHeight));')
  }
  archStone.customProgramCacheKey = () => 'playsense-arch-stone-v1'
  const archShadow = new THREE.MeshStandardMaterial({ color: 0x2c4e4b, roughness: .7 })
  const bottom = SEA_Y, spring = 5.6
  const outerFrame = new THREE.Mesh(archFrame(8.6, 7.1, bottom, spring, 1.5), archStone)
  outerFrame.position.z = -.75; arch.add(outerFrame)
  const innerFrame = new THREE.Mesh(archFrame(7.15, 6.55, bottom, spring, 2.1), archShadow)
  innerFrame.position.z = -1.05; arch.add(innerFrame)
  const reveal = new THREE.Mesh(archFrame(6.6, 6.42, bottom, spring, 2.3), brass)
  reveal.position.z = -1.15; arch.add(reveal)
  // Deco sunburst in the spandrels and a stepped crown.
  const crownParts: THREE.BufferGeometry[] = []
  for (let i = 0; i < 3; i++) crownParts.push(new RoundedBoxGeometry(6 - i * 1.7, .9, 1.7 - i * .1, 2, .08).translate(0, spring + 8.6 + i * .85, .05))
  for (let i = 0; i < 11; i++) {
    const a = Math.PI * (.12 + i * .076)
    crownParts.push(new THREE.BoxGeometry(.16, 1.7, .2).translate(0, 7.95, 0).rotateZ(a - Math.PI / 2).translate(0, spring, .85))
  }
  for (const side of [-1, 1]) {
    crownParts.push(new RoundedBoxGeometry(1.1, spring - bottom + 9.2, 1.9, 2, .08).translate(side * 9.1, (spring + bottom + 9.2) / 2, 0))
    for (let i = 0; i < 4; i++) crownParts.push(new THREE.BoxGeometry(1.35, .18, 2.05).translate(side * 9.1, spring + 1.5 + i * 2, 0))
  }
  const crown = new THREE.Mesh(merge(crownParts), archStone)
  arch.add(crown);
  const neonMaterial = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 1.25, .75) })
  arch.add(new THREE.Mesh(new THREE.TubeGeometry(archLine(6.3, spring, DECK_TOP + .2, .35), 260, .07, 6, false), neonMaterial))
  const neonOuter = new THREE.Mesh(new THREE.TubeGeometry(archLine(7.85, spring, DECK_TOP + 1.2, .92), 260, .045, 6, false), new THREE.MeshBasicMaterial({ color: new THREE.Color(.5, 1.9, 1.7) }))
  arch.add(neonOuter)
  arch.traverse(o => { if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshStandardMaterial) { o.castShadow = true; o.receiveShadow = true } })
  group.add(arch)

  // Everything that glows over the water leaves a shimmering streak on it.
  const water = SEA_Y + .03
  const reflect = (points: THREE.Vector3[]) => points.map(p => new THREE.Vector3(p.x, water, p.z))
  group.add(billboards(reflect(festoon.filter((_, i) => i % 2 === 0)), new THREE.Color(.9, .5, .24), .22, 6, uniforms.psClock, true))
  const neonFeet = [-6.3, 6.3].map(x => new THREE.Vector3(x, water, ARCH_Z + .4))
  group.add(billboards(neonFeet, new THREE.Color(1.8, .7, .42), .7, 11, uniforms.psClock, true))
  group.add(billboards([-7.85, 7.85].map(x => new THREE.Vector3(x, water, ARCH_Z + .9)), new THREE.Color(.3, 1.1, 1), .5, 9, uniforms.psClock, true))

  const neonBase = neonMaterial.color.clone()
  return {
    group,
    lampGlobes,
    update(pulse: number, energy: number) {
      neonMaterial.color.copy(neonBase).multiplyScalar(.8 + pulse * .45 + energy * .6)
    },
  }
}
