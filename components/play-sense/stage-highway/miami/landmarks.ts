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
 * A causeway bridge across the bay: a long, gently arched concrete deck on
 * paired round piers, a line of deck lamps and moving traffic.
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
  const deckHeight = (t: number) => deckY + Math.sin(t * Math.PI) * 6
  for (let i = 1; i < 22; i++) {
    const t = i / 22
    const top = deckHeight(t) - 2.6
    for (const side of [-1, 1]) parts.push(new THREE.CylinderGeometry(1.1, 1.3, top - SEA_Y, 10).translate(t * length, (top + SEA_Y) / 2, side * 3.2))
    parts.push(new THREE.BoxGeometry(2, 1.4, 9).translate(t * length, top - .7, 0))
  }
  const structure = new THREE.Mesh(flat(parts), distantMaterial(uniforms, concrete))
  structure.applyMatrix4(toWorld)
  group.add(structure)
  // Deck lamps; traffic flows along the deck line.
  const lamps: THREE.Vector3[] = []
  for (let i = 0; i <= 48; i++) for (const side of [-1, 1]) {
    const t = i / 48
    lamps.push(new THREE.Vector3(t * length, deckHeight(t) + 3.5, side * 6.8).applyMatrix4(toWorld))
  }
  const lampColor = new THREE.Color(1.9, 1.15, .6)
  group.add(billboards(lamps, lampColor, .7, 1, time, 'glow'))
  group.add(billboards(lamps.filter((_, i) => i % 4 === 0).map(p => p.clone().setY(SEA_Y + .03)), lampColor, .55, 9, time, 'reflection'))
  return { group, deckAt: (t: number) => new THREE.Vector3(t * length, deckHeight(t) + .9, 0).applyMatrix4(toWorld) }
}
