import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { SKY } from './glsl'
import { SEA_Y, type SkyUniforms } from './sky'
import { billboards } from './glow'

const flat = (parts: THREE.BufferGeometry[]) => {
  const list = parts.map(g => { const n = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal') n.deleteAttribute(k); return n })
  const merged = mergeGeometries(list)!
  parts.forEach(g => g.dispose()); list.forEach(g => g.dispose())
  return merged
}

/**
 * Distant structures lit by the dusk sky: key light from the afterglow, violet fill,
 * atmospheric haze toward the horizon. `psWindows` draws rows of lit cabins/portholes.
 */
function distantMaterial(uniforms: SkyUniforms, color: THREE.Color, windows = 0) {
  return new THREE.ShaderMaterial({
    uniforms: { ...uniforms, psBase: { value: color } } as unknown as Record<string, THREE.IUniform>,
    fog: false,
    vertexShader: /* glsl */ `
      varying vec3 vWorld; varying vec3 vNormal; varying vec3 vLocal;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.);
        vWorld = world.xyz; vLocal = position;
        vNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * world;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 psBase;
      varying vec3 vWorld; varying vec3 vNormal; varying vec3 vLocal;
      ${SKY}
      void main() {
        vec3 n = normalize(vNormal);
        vec3 view = normalize(vWorld - cameraPosition);
        float key = max(dot(n, normalize(vec3(psSunDir.x, .25, psSunDir.z))), 0.);
        vec3 color = psBase * (vec3(.2, .13, .3) + vec3(.2, .16, .32) * (.5 + .5 * n.y) + vec3(1., .5, .36) * key * .55);
        ${windows ? `
          float side = step(abs(n.y), .5);
          vec2 cell = vec2(vLocal.x * 2.2, (vLocal.y - 1.) / ${windows.toFixed(2)});
          vec2 id = floor(cell), f = fract(cell);
          float lit = step(.58, psHash(id + floor(vLocal.x * .15) * 3.)) * side * step(1.5, vLocal.y);
          vec3 lamp = mix(vec3(1.4, 1., .62), vec3(.85, .95, 1.3), step(.8, psHash(id + 7.)));
          // Balcony glass with dark rails; a thin white deck edge on every storey.
          color = mix(color, vec3(.05, .06, .1) + psSkyClear(reflect(view, n)) * .12, side * step(.1, f.y) * step(f.y, .62) * .85);
          color = mix(color, lamp * (.45 + .45 * psHash(id + 3.)), lit * step(.15, f.x) * step(.14, f.y) * step(f.y, .58));
          color *= 1. - side * .3 * step(.62, f.y) * step(f.y, .7);` : ''}
        vec3 haze = psSkyClear(normalize(vec3(view.x, .02, view.z))) * .8;
        color = mix(color, haze, clamp(1. - exp(-length(vWorld - cameraPosition) * .0011), 0., .85));
        gl_FragColor = vec4(color, 1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  })
}

/**
 * A modern cruise ship docked at PortMiami: flared white hull with a navy boot top,
 * a stacked superstructure with rows of lit balcony cabins, a raked funnel,
 * pool-deck lights and a string of dress lights from bow to stern.
 */
export function createCruiseShip(uniforms: SkyUniforms, time: { value: number }) {
  const ship = new THREE.Group()
  const L = 150, B = 22
  // Hull: an extruded plan (blunt stern, fine bow) with a flared shear.
  const plan = new THREE.Shape()
  plan.moveTo(-L / 2, -B / 2); plan.lineTo(L * .3, -B / 2)
  plan.quadraticCurveTo(L * .46, -B * .42, L / 2, 0)
  plan.quadraticCurveTo(L * .46, B * .42, L * .3, B / 2)
  plan.lineTo(-L / 2, B / 2); plan.closePath()
  const hullGeometry = new THREE.ExtrudeGeometry(plan, { depth: 18, bevelEnabled: false, curveSegments: 12 }).rotateX(-Math.PI / 2).translate(0, -4, 0)
  const white = new THREE.Color(.92, .9, .93), navy = new THREE.Color(.05, .07, .14)
  ship.add(new THREE.Mesh(hullGeometry, distantMaterial(uniforms, white)))
  const boot = new THREE.Mesh(new THREE.ExtrudeGeometry(plan, { depth: 8, bevelEnabled: false, curveSegments: 12 }).rotateX(-Math.PI / 2).translate(0, -4.2, 0).scale(1.002, 1, 1.004), distantMaterial(uniforms, navy))
  ship.add(boot)
  // Superstructure: tiers stepping back toward the stern, each a band of lit cabins.
  const tiers: THREE.BufferGeometry[] = []
  const tierSpec: [number, number, number, number][] = [[-8, 120, 20, 14], [-12, 104, 19, 10], [-16, 86, 17, 7], [-19, 60, 14, 5]]
  let y = 14
  for (const [x, length, width, height] of tierSpec) { tiers.push(new THREE.BoxGeometry(length, height, width).translate(x, y + height / 2, 0)); y += height }
  // Rounded bridge front on the top tier.
  tiers.push(new THREE.CylinderGeometry(9.5, 9.5, 10, 24, 1, false, -Math.PI / 2, Math.PI).translate(-8 + 60, 14 + 7, 0))
  ship.add(new THREE.Mesh(flat(tiers), distantMaterial(uniforms, white, 2.3)))
  // Funnel: raked, with the line's signature blue and a black top.
  const funnel = new THREE.CylinderGeometry(4.2, 5.2, 13, 20).translate(0, 6.5, 0)
  funnel.applyMatrix4(new THREE.Matrix4().makeShear(0, 0, -.35, 0, 0, 0))
  ship.add(new THREE.Mesh(funnel.translate(-40, y, 0), distantMaterial(uniforms, new THREE.Color(.9, .9, .94))))
  ship.add(new THREE.Mesh(new THREE.CylinderGeometry(4.6, 4.9, 3, 20).applyMatrix4(new THREE.Matrix4().makeShear(0, 0, -.35, 0, 0, 0)).translate(-41.8, y + 6, 0), distantMaterial(uniforms, new THREE.Color(.16, .4, .78))))
  ship.add(new THREE.Mesh(new THREE.CylinderGeometry(4.3, 4.3, 2, 20).translate(-44.5, y + 12.8, 0), distantMaterial(uniforms, new THREE.Color(.04, .04, .06))))
  // Water slide coil and radar mast on the top deck.
  const slide = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(Array.from({ length: 30 }, (_, i) => new THREE.Vector3(Math.cos(i * .6) * 4 - 22, y + 10 - i * .33, Math.sin(i * .6) * 4))), 90, .7, 8, false)
  ship.add(new THREE.Mesh(slide, distantMaterial(uniforms, new THREE.Color(.9, .25, .35))))
  ship.add(new THREE.Mesh(new THREE.CylinderGeometry(.5, .6, 12, 8).translate(34, y + 6, 0), distantMaterial(uniforms, white)))
  // Dress lights from the bow over the mast to the stern.
  const dress: THREE.Vector3[] = []
  const dressCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(L / 2, 14, 0), new THREE.Vector3(34, y + 12, 0), new THREE.Vector3(-40, y + 14, 0), new THREE.Vector3(-L / 2 + 2, 14, 0)])
  for (let i = 0; i <= 90; i++) dress.push(dressCurve.getPointAt(i / 90))
  const lights = billboards(dress, new THREE.Color(1.2, .95, .7), .4, 1, time, 'glow')
  ship.add(lights)
  return { group: ship, length: L }
}

/**
 * A cable-stayed bridge across the bay: a long concrete deck on slender piers,
 * two A-frame pylons with fanned stays, a line of deck lamps and moving traffic.
 */
export function createBridge(uniforms: SkyUniforms, from: THREE.Vector3, to: THREE.Vector3, time: { value: number }) {
  const group = new THREE.Group()
  const span = to.clone().sub(from), length = span.length()
  const heading = Math.atan2(-span.z, span.x)
  const deckY = SEA_Y + 9
  const toWorld = new THREE.Matrix4().makeRotationY(heading).setPosition(from.x, 0, from.z)
  const concrete = new THREE.Color(.62, .58, .62)
  const parts: THREE.BufferGeometry[] = []
  // Deck: slab, girder and parapets, gently arched toward the main span.
  const segments = 60
  for (let i = 0; i < segments; i++) {
    const a = i / segments, b = (i + 1) / segments
    const ya = deckY + Math.sin(a * Math.PI) * 6, yb = deckY + Math.sin(b * Math.PI) * 6
    const seg = length / segments
    const slab = new THREE.BoxGeometry(seg + .05, 1.1, 14)
    slab.applyMatrix4(new THREE.Matrix4().makeRotationZ(Math.atan2(yb - ya, seg)))
    parts.push(slab.translate((a + b) / 2 * length, (ya + yb) / 2, 0))
    const girder = new THREE.BoxGeometry(seg + .05, 2.2, 8)
    girder.applyMatrix4(new THREE.Matrix4().makeRotationZ(Math.atan2(yb - ya, seg)))
    parts.push(girder.translate((a + b) / 2 * length, (ya + yb) / 2 - 1.6, 0))
  }
  const pylonAt = [.36, .64]
  const deckHeight = (t: number) => deckY + Math.sin(t * Math.PI) * 6
  for (let i = 1; i < 16; i++) {
    const t = i / 16
    if (pylonAt.some(p => Math.abs(p - t) < .04)) continue
    const top = deckHeight(t) - 2.6
    for (const side of [-1, 1]) parts.push(new THREE.CylinderGeometry(1.1, 1.3, top - SEA_Y, 10).translate(t * length, (top + SEA_Y) / 2, side * 3.2))
    parts.push(new THREE.BoxGeometry(2, 1.4, 9).translate(t * length, top - .7, 0))
  }
  // A-frame pylons.
  const stays: THREE.BufferGeometry[] = []
  for (const t of pylonAt) {
    const x = t * length, base = SEA_Y, apex = deckHeight(t) + 42
    for (const side of [-1, 1]) {
      const leg = new THREE.Vector3(x, base, side * 11), head = new THREE.Vector3(x, apex, side * 1.6)
      const dir = head.clone().sub(leg), len = dir.length()
      const geometry = new THREE.BoxGeometry(2.4, len, 2.4).translate(0, len / 2, 0)
      geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()))
      parts.push(geometry.translate(leg.x, leg.y, leg.z))
    }
    parts.push(new THREE.BoxGeometry(3, 4, 5).translate(x, apex - 1, 0))
    // Fan of stays to the deck on both sides of the pylon.
    for (let k = 1; k <= 9; k++) for (const dir of [-1, 1]) for (const side of [-1, 1]) {
      const anchorT = t + dir * k * .016
      const anchor = new THREE.Vector3(anchorT * length, deckHeight(anchorT) + .4, side * 6.5)
      const top = new THREE.Vector3(x, apex - 2 - k * 1.6, side * 1.2)
      stays.push(new THREE.TubeGeometry(new THREE.LineCurve3(top, anchor), 1, .16, 4, false))
    }
  }
  const structure = new THREE.Mesh(flat(parts), distantMaterial(uniforms, concrete))
  structure.applyMatrix4(toWorld)
  group.add(structure)
  const cables = new THREE.Mesh(flat(stays), distantMaterial(uniforms, new THREE.Color(.95, .95, 1)))
  cables.applyMatrix4(toWorld)
  group.add(cables)
  // Pylon uplights and deck lamps; traffic flows along the deck line.
  const lamps: THREE.Vector3[] = [], up: THREE.Vector3[] = []
  for (let i = 0; i <= 48; i++) for (const side of [-1, 1]) {
    const t = i / 48
    lamps.push(new THREE.Vector3(t * length, deckHeight(t) + 3.5, side * 6.8).applyMatrix4(toWorld))
  }
  for (const t of pylonAt) up.push(new THREE.Vector3(t * length, deckHeight(t) + 44, 0).applyMatrix4(toWorld))
  const lampColor = new THREE.Color(1.9, 1.15, .6)
  group.add(billboards(lamps, lampColor, .7, 1, time, 'glow'))
  group.add(billboards(lamps.filter((_, i) => i % 4 === 0).map(p => p.clone().setY(SEA_Y + .03)), lampColor, .55, 9, time, 'reflection'))
  group.add(billboards(up, new THREE.Color(2.2, .5, 1.3), 1.6, 1, time, 'blink'))
  return { group, deckAt: (t: number) => new THREE.Vector3(t * length, deckHeight(t) + .9, 0).applyMatrix4(toWorld) }
}
