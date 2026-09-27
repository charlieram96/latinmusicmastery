import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { merge } from './set'

interface HullSpec { length: number; beam: number; draft: number; freeboard: number; bowRise: number; deadrise: number; stripe: THREE.Color; bottom: THREE.Color }

/**
 * A lofted planing hull along +x (bow at +x), waterline at y = 0. Each station is a
 * V bottom from keel to chine, then a flared topside to the sheer; the bow narrows
 * on a curve and rises. Vertex colours carry the antifouling and boot stripe.
 */
function hull(spec: HullSpec) {
  const { length, beam, draft, freeboard, bowRise, deadrise } = spec
  const stations = 28, around = 9
  const positions: number[] = [], colors: number[] = [], index: number[] = []
  const white = new THREE.Color(0xf4f1ec)
  const colorAt = (y: number) => y < -.02 ? spec.bottom : y < .16 ? spec.stripe : white
  const section = (s: number) => {
    const narrowing = s < .5 ? 1 : Math.sqrt(Math.max(0, 1 - Math.pow((s - .5) / .5, 2.2)))
    const half = beam / 2 * Math.max(.015, narrowing) * (1 - .06 * (1 - s))
    const sheer = freeboard + bowRise * Math.pow(s, 2.4)
    const keel = -draft * (1 - Math.pow(Math.max(0, (s - .62) / .38), 1.4) * .9)
    const chineY = keel + half * Math.tan(deadrise) * .85
    const points: [number, number][] = []
    for (let j = 0; j <= around; j++) {
      const t = j / around
      if (t < .45) { const u = t / .45; points.push([half * .96 * u, keel + (chineY - keel) * u]) }
      else { const u = (t - .45) / .55; points.push([half * (.96 + .04 * Math.sin(u * Math.PI / 2)), chineY + (sheer - chineY) * u]) }
    }
    return { x: -length / 2 + s * length, points, sheer, half }
  }
  const sections = Array.from({ length: stations + 1 }, (_, i) => section(i / stations))
  const ring = (around + 1) * 2
  for (const sec of sections) for (const side of [1, -1]) for (const [z, y] of sec.points) {
    positions.push(sec.x, y, z * side)
    const c = colorAt(y); colors.push(c.r, c.g, c.b)
  }
  for (let i = 0; i < stations; i++) for (let side = 0; side < 2; side++) for (let j = 0; j < around; j++) {
    const a = i * ring + side * (around + 1) + j, b = a + ring
    if (side === 0) index.push(a, b, a + 1, b, b + 1, a + 1)
    else index.push(a, a + 1, b, b, a + 1, b + 1)
  }
  // Transom: a flat stern face.
  const stern = positions.length / 3
  positions.push(sections[0].x, (sections[0].points[0][1] + sections[0].sheer) / 2, 0)
  colors.push(white.r, white.g, white.b)
  for (let j = 0; j < around; j++) {
    index.push(stern, j + 1, j)
    index.push(stern, (around + 1) + j, (around + 1) + j + 1)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.setIndex(index)
  geometry.computeVertexNormals()
  // Teak deck laid over the sheer line.
  const deckShape = new THREE.Shape()
  sections.forEach((sec, i) => i ? deckShape.lineTo(sec.x, sec.half * .97) : deckShape.moveTo(sec.x, sec.half * .97))
  for (let i = sections.length - 1; i >= 0; i--) deckShape.lineTo(sections[i].x, -sections[i].half * .97)
  const deck = new THREE.ShapeGeometry(deckShape).rotateX(-Math.PI / 2)
  const p = deck.getAttribute('position')
  for (let v = 0; v < p.count; v++) {
    const s = (p.getX(v) + length / 2) / length
    p.setY(v, freeboard + bowRise * Math.pow(Math.max(0, s), 2.4) - .02)
  }
  deck.computeVertexNormals()
  return { geometry, deck, sheerAt: (s: number) => freeboard + bowRise * Math.pow(s, 2.4) }
}

const gelcoat = () => new THREE.MeshPhysicalMaterial({ color: 0xffffff, vertexColors: true, roughness: .22, clearcoat: 1, clearcoatRoughness: .06, envMapIntensity: .8, side: THREE.DoubleSide })
const teak = () => new THREE.MeshStandardMaterial({ color: 0x9b7650, roughness: .7 })
const white = () => new THREE.MeshPhysicalMaterial({ color: 0xf1eee9, roughness: .3, clearcoat: .8, clearcoatRoughness: .1 })
const tinted = () => new THREE.MeshPhysicalMaterial({ color: 0x0d1418, roughness: .05, metalness: .3, clearcoat: 1, envMapIntensity: 1.2 })
const cabinGlow = () => new THREE.MeshBasicMaterial({ color: new THREE.Color(1.15, .78, .45) })
const steel = () => new THREE.MeshStandardMaterial({ color: 0xdfe3e6, metalness: 1, roughness: .15 })

function rails(points: THREE.Vector3[], height: number) {
  const parts: THREE.BufferGeometry[] = [new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => p.clone().setY(p.y + height))), 48, .025, 5, false)]
  for (let i = 0; i < points.length; i += 2) parts.push(new THREE.CylinderGeometry(.018, .018, height, 5).translate(points[i].x, points[i].y + height / 2, points[i].z))
  return merge(parts)
}

function sheerLine(length: number, beam: number, sheerAt: (s: number) => number, side: number) {
  return Array.from({ length: 16 }, (_, i) => {
    const s = .08 + i / 15 * .8
    const narrowing = s < .5 ? 1 : Math.sqrt(Math.max(0, 1 - Math.pow((s - .5) / .5, 2.2)))
    return new THREE.Vector3(-length / 2 + s * length, sheerAt(s), side * beam / 2 * narrowing * .9)
  })
}

/** A 50-foot motor yacht: flybridge, tinted glazing with warm cabin light, radar arch. */
function motorYacht() {
  const group = new THREE.Group()
  const L = 13, B = 3.9
  const h = hull({ length: L, beam: B, draft: .7, freeboard: 1.35, bowRise: .55, deadrise: .32, stripe: new THREE.Color(0x0e2f4a), bottom: new THREE.Color(0x14161c) })
  group.add(new THREE.Mesh(h.geometry, gelcoat()), new THREE.Mesh(h.deck, teak()))
  const shell = white(), glass = tinted()
  const cabin = new THREE.Mesh(new RoundedBoxGeometry(6.6, 1.25, 3.1, 3, .22), shell); cabin.position.set(-1, h.sheerAt(.4) + .6, 0); group.add(cabin)
  const glazing = new THREE.Mesh(new RoundedBoxGeometry(6.2, .5, 3.16, 2, .12), glass); glazing.position.set(-.9, h.sheerAt(.4) + .72, 0); group.add(glazing)
  const lit = new THREE.Mesh(new THREE.BoxGeometry(5.4, .2, 3.18), cabinGlow()); lit.position.set(-1.1, h.sheerAt(.4) + .62, 0); group.add(lit)
  const windshield = new THREE.Mesh(new RoundedBoxGeometry(1.2, .8, 2.9, 2, .2), glass); windshield.position.set(2.1, h.sheerAt(.55) + .45, 0); windshield.rotation.z = -.55; group.add(windshield)
  const fly = new THREE.Mesh(new RoundedBoxGeometry(4.2, .5, 2.9, 2, .18), shell); fly.position.set(-1.6, h.sheerAt(.4) + 1.5, 0); group.add(fly)
  const flyScreen = new THREE.Mesh(new RoundedBoxGeometry(.6, .35, 2.4, 2, .12), glass); flyScreen.position.set(.35, h.sheerAt(.4) + 1.85, 0); flyScreen.rotation.z = -.5; group.add(flyScreen)
  const arch = new THREE.Mesh(new THREE.TorusGeometry(1.35, .09, 8, 24, Math.PI).rotateY(Math.PI / 2), shell); arch.position.set(-2.6, h.sheerAt(.4) + 1.75, 0); arch.scale.set(1, .75, 1); group.add(arch)
  const radar = new THREE.Mesh(new THREE.CylinderGeometry(.32, .32, .16, 16), shell); radar.position.set(-2.6, h.sheerAt(.4) + 2.85, 0); group.add(radar)
  const metal = steel()
  for (const side of [-1, 1]) group.add(new THREE.Mesh(rails(sheerLine(L, B, h.sheerAt, side), .55), metal))
  return { group, length: L, beam: B, lights: [new THREE.Vector3(-2.6, h.sheerAt(.4) + 3.1, 0)] }
}

/** A center-console fishing boat with a T-top and twin outboards. */
function speedboat() {
  const group = new THREE.Group()
  const L = 7.6, B = 2.5
  const h = hull({ length: L, beam: B, draft: .45, freeboard: .95, bowRise: .35, deadrise: .38, stripe: new THREE.Color(0x0b6f78), bottom: new THREE.Color(0x0f1b24) })
  group.add(new THREE.Mesh(h.geometry, gelcoat()), new THREE.Mesh(h.deck, teak()))
  const shell = white()
  const consoleBox = new THREE.Mesh(new RoundedBoxGeometry(1.1, .9, 1.1, 2, .12), shell); consoleBox.position.set(.2, h.sheerAt(.5) + .45, 0); group.add(consoleBox)
  const screen = new THREE.Mesh(new RoundedBoxGeometry(.3, .45, 1.15, 2, .1), tinted()); screen.position.set(.75, h.sheerAt(.5) + 1, 0); screen.rotation.z = -.6; group.add(screen)
  const metal = steel()
  const frame: THREE.BufferGeometry[] = []
  for (const [x, z] of [[-.4, -.55], [-.4, .55], [.7, -.55], [.7, .55]]) frame.push(new THREE.CylinderGeometry(.03, .03, 1.9, 6).translate(x, h.sheerAt(.5) + .95, z))
  group.add(new THREE.Mesh(merge(frame), metal))
  const top = new THREE.Mesh(new RoundedBoxGeometry(1.8, .1, 1.7, 2, .04), shell); top.position.set(.15, h.sheerAt(.5) + 1.9, 0); group.add(top)
  const motor = new THREE.MeshStandardMaterial({ color: 0x1a1c20, roughness: .35, metalness: .2 })
  for (const z of [-.45, .45]) {
    const cowl = new THREE.Mesh(new RoundedBoxGeometry(.55, .75, .42, 2, .12), motor); cowl.position.set(-L / 2 - .25, .95, z); group.add(cowl)
    const leg = new THREE.Mesh(new THREE.BoxGeometry(.18, .9, .14), motor); leg.position.set(-L / 2 - .25, .2, z); group.add(leg)
  }
  for (const side of [-1, 1]) group.add(new THREE.Mesh(rails(sheerLine(L, B, h.sheerAt, side).slice(9), .4), metal))
  return { group, length: L, beam: B, lights: [new THREE.Vector3(.15, h.sheerAt(.5) + 2.05, 0)] }
}

/** A cruising sloop: low cabin trunk, tall mast and boom with the main furled on it. */
function sloop() {
  const group = new THREE.Group()
  const L = 9.2, B = 2.9
  const h = hull({ length: L, beam: B, draft: .9, freeboard: .95, bowRise: .3, deadrise: .45, stripe: new THREE.Color(0x7a1d2c), bottom: new THREE.Color(0x1a1418) })
  group.add(new THREE.Mesh(h.geometry, gelcoat()), new THREE.Mesh(h.deck, teak()))
  const shell = white()
  const trunk = new THREE.Mesh(new RoundedBoxGeometry(3.4, .5, 1.9, 2, .16), shell); trunk.position.set(.2, h.sheerAt(.45) + .25, 0); group.add(trunk)
  const ports = new THREE.Mesh(new THREE.BoxGeometry(2.6, .12, 1.94), cabinGlow()); ports.position.set(.2, h.sheerAt(.45) + .3, 0); group.add(ports)
  const spar = new THREE.MeshStandardMaterial({ color: 0xc9ccd0, metalness: .9, roughness: .3 })
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(.07, .09, 12.5, 8), spar); mast.position.set(.9, h.sheerAt(.5) + 6.25, 0); group.add(mast)
  const boom = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, 4, 8).rotateZ(Math.PI / 2), spar); boom.position.set(-1.1, h.sheerAt(.5) + 1.4, 0); group.add(boom)
  const sail = new THREE.Mesh(new THREE.CylinderGeometry(.16, .12, 3.7, 10).rotateZ(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x0f3a55, roughness: .8 })); sail.position.set(-1.05, h.sheerAt(.5) + 1.58, 0); group.add(sail)
  const stays = [
    [new THREE.Vector3(.9, h.sheerAt(.5) + 12.3, 0), new THREE.Vector3(L / 2 - .2, h.sheerAt(.98), 0)],
    [new THREE.Vector3(.9, h.sheerAt(.5) + 12.3, 0), new THREE.Vector3(-L / 2 + .3, h.sheerAt(.02), 0)],
  ].map(([a, b]) => new THREE.TubeGeometry(new THREE.LineCurve3(a, b), 1, .012, 4, false))
  group.add(new THREE.Mesh(merge(stays), spar))
  for (const side of [-1, 1]) group.add(new THREE.Mesh(rails(sheerLine(L, B, h.sheerAt, side), .5), steel()))
  return { group, length: L, beam: B, lights: [new THREE.Vector3(.9, h.sheerAt(.5) + 12.6, 0)] }
}

export interface Mooring { x: number; z: number; heading: number; kind: 'yacht' | 'speedboat' | 'sloop' }

/**
 * Boats tied up along one side of the dock, bobbing on the swell, each with
 * fenders, dock lines, a masthead or anchor light and an underwater LED glow.
 */
export function createBoats(moorings: Mooring[], waterY: number, dockEdgeX: number, deckY: number, motion: boolean) {
  const group = new THREE.Group()
  const fleet = moorings.map((m, i) => {
    const built = m.kind === 'yacht' ? motorYacht() : m.kind === 'speedboat' ? speedboat() : sloop()
    const holder = new THREE.Group()
    holder.position.set(m.x, waterY, m.z)
    holder.rotation.y = m.heading
    holder.add(built.group)
    built.group.traverse(o => { if (o instanceof THREE.Mesh) { o.castShadow = false; o.receiveShadow = false } })
    group.add(holder)
    return { holder, phase: i * 1.7, built }
  })
  // Fenders and dock lines between each hull and the dock edge.
  const fenderParts: THREE.BufferGeometry[] = [], lineParts: THREE.BufferGeometry[] = [], glowPoints: THREE.Vector3[] = [], lightPoints: THREE.Vector3[] = []
  const side = Math.sign(moorings[0]?.x ?? 1)
  for (const { holder, built } of fleet) {
    const inboard = holder.position.x - side * built.beam / 2
    for (const f of [-.3, 0, .3]) {
      const z = holder.position.z + f * built.length
      fenderParts.push(new THREE.CapsuleGeometry(.16, .5, 4, 10).translate((inboard + dockEdgeX) / 2, waterY + 1.1, z))
    }
    for (const end of [-.45, .45]) {
      const boatEnd = new THREE.Vector3(inboard + side * .2, waterY + 1.3, holder.position.z + end * built.length)
      const cleat = new THREE.Vector3(dockEdgeX, deckY + .1, holder.position.z + end * built.length * 1.15)
      const mid = boatEnd.clone().lerp(cleat, .5); mid.y -= .6
      lineParts.push(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(boatEnd, mid, cleat), 16, .025, 5, false))
    }
    glowPoints.push(new THREE.Vector3(holder.position.x, waterY + .02, holder.position.z))
    for (const light of built.lights) lightPoints.push(light.clone().applyEuler(holder.rotation).add(holder.position))
  }
  if (fenderParts.length) group.add(new THREE.Mesh(merge(fenderParts), new THREE.MeshPhysicalMaterial({ color: 0xf2f0ec, roughness: .35, clearcoat: .6 })))
  if (lineParts.length) group.add(new THREE.Mesh(merge(lineParts), new THREE.MeshStandardMaterial({ color: 0xe8e2d4, roughness: .85 })))
  // Underwater LED glow: a soft cyan pool of light beneath each hull.
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv * 2. - 1.; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: 'varying vec2 vUv; void main(){ float r = length(vUv * vec2(1., 1.9)); gl_FragColor = vec4(vec3(.1, .75, .95) * exp(-r * r * 3.) * .55, 1.); }',
  }))
  const glows = glowPoints.map((p, i) => {
    const g = glow.clone(); g.position.copy(p); g.scale.set(fleet[i].built.length * 1.2, 1, fleet[i].built.beam * 2.2); g.rotation.y = fleet[i].holder.rotation.y; group.add(g); return g
  })
  void glows
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(.09, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 2.3, 2.1) }))
  for (const p of lightPoints) { const l = lamp.clone(); l.position.copy(p); group.add(l) }

  let clock = 0
  return {
    group,
    update(dt: number) {
      if (!motion) return
      clock += dt
      for (const { holder, phase } of fleet) {
        holder.position.y = waterY + Math.sin(clock * .8 + phase) * .06
        holder.children[0].rotation.x = Math.sin(clock * .65 + phase) * .025
        holder.children[0].rotation.z = Math.sin(clock * .5 + phase * 1.3) * .012
      }
    },
  }
}
