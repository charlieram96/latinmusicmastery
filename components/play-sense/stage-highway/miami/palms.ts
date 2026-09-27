import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { SUN_DIRECTION } from './sky'

export interface PalmSpec { x: number; z: number; ground: number; height: number; kind: 'royal' | 'coconut'; lean?: number; heading?: number; seed: number }

const rand = (seed: number) => { const x = Math.sin(seed * 91.17 + 7.3) * 43758.5453; return x - Math.floor(x) }
const UP = new THREE.Vector3(0, 1, 0)
const DOWN = new THREE.Vector3(0, -1, 0)

interface Buffers { position: number[]; color: number[]; sway: number[]; index: number[] }
const buffers = (): Buffers => ({ position: [], color: [], sway: [], index: [] })
function toGeometry(b: Buffers) {
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(b.position, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(b.color, 3))
  g.setAttribute('psSway', new THREE.Float32BufferAttribute(b.sway, 1))
  g.setIndex(b.index)
  g.computeVertexNormals()
  // Degenerate leaflet triangles leave zero normals, which light as NaN; point them up.
  const normals = g.getAttribute('normal')
  for (let i = 0; i < normals.count; i++) {
    if (Math.hypot(normals.getX(i), normals.getY(i), normals.getZ(i)) < 1e-6) normals.setXYZ(i, 0, 1, 0)
  }
  return g
}

/**
 * One frond: an arching rachis carrying two ranks of individual leaflets. Each
 * leaflet is a tapered, slightly bent strip hanging below the rachis in a V.
 */
function frond(out: Buffers, crown: THREE.Vector3, heading: number, rise: number, length: number, seed: number, tint: THREE.Color, royal: boolean) {
  const outward = new THREE.Vector3(Math.cos(heading), 0, Math.sin(heading))
  const droop = .75 + rand(seed) * .35
  const at = (t: number) => crown.clone().addScaledVector(outward, length * t)
    .add(new THREE.Vector3(0, length * (rise * t - droop * t * t), 0))
  const leaflets = royal ? 46 : 38
  const base = out.position.length / 3
  // Rachis: a thin ribbon so the midrib reads at close range.
  for (let i = 0; i <= 12; i++) {
    const t = i / 12, p = at(t), w = .07 * (1 - t) + .015
    const side = new THREE.Vector3().crossVectors(at(Math.min(1, t + .02)).sub(at(Math.max(0, t - .02))), UP).normalize().multiplyScalar(w)
    for (const s of [-1, 1]) { const v = p.clone().addScaledVector(side, s); out.position.push(v.x, v.y, v.z); out.color.push(tint.r * .8, tint.g * .75, tint.b * .6); out.sway.push(t * t) }
  }
  for (let i = 0; i < 12; i++) { const a = base + i * 2; out.index.push(a, a + 2, a + 1, a + 1, a + 2, a + 3) }
  for (let i = 0; i < leaflets; i++) {
    const t = .1 + i / leaflets * .88
    const origin = at(t)
    const tangent = at(Math.min(1, t + .02)).sub(at(t - .02)).normalize()
    const lateral = new THREE.Vector3().crossVectors(tangent, UP).normalize()
    const span = length * .36 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.05)), .55) * (.8 + rand(seed * 13 + i) * .35)
    for (const s of [-1, 1]) {
      const hang = (royal ? .75 : .5) + t * .5 + (rand(seed + i * 7 + s) - .5) * (royal ? .9 : .3)
      const dir = lateral.clone().multiplyScalar(s * Math.cos(hang)).addScaledVector(DOWN, Math.sin(hang)).addScaledVector(tangent, .45).normalize()
      const mid = origin.clone().addScaledVector(dir, span * .55)
      const tip = mid.clone().addScaledVector(dir.clone().addScaledVector(DOWN, .55).normalize(), span * .45)
      const width = Math.max(.035, span * .07)
      const across = new THREE.Vector3().crossVectors(dir, tangent)
      if (across.lengthSq() < 1e-8) across.copy(lateral)
      across.normalize().multiplyScalar(width)
      const shade = .85 + rand(seed * 3 + i * 5 + s) * .3
      const start = out.position.length / 3
      for (const [v, frac] of [[origin.clone().addScaledVector(across, -.4), 0], [origin.clone().addScaledVector(across, .4), 0], [mid.clone().addScaledVector(across, -1), .55], [mid.clone().addScaledVector(across, 1), .55], [tip, 1]] as const) {
        out.position.push(v.x, v.y, v.z)
        out.color.push(tint.r * shade, tint.g * shade, tint.b * shade)
        out.sway.push(t * t + frac * .25)
      }
      out.index.push(start, start + 2, start + 1, start + 1, start + 2, start + 3, start + 2, start + 4, start + 3)
    }
  }
}

function ringTexture(light: string, dark: string) {
  const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 512
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = light; ctx.fillRect(0, 0, 64, 512)
  for (let y = 0; y < 512; y += 6 + (y * 7 % 5)) {
    ctx.fillStyle = dark; ctx.globalAlpha = .35 + (y * 13 % 7) / 20
    ctx.fillRect(0, y, 64, 1.5)
  }
  ctx.globalAlpha = 1
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.anisotropy = 4
  return texture
}

/** Trunk rings along a curve, with per-vertex colour for the royal palm's green crownshaft. */
function trunk(curve: THREE.CatmullRomCurve3, radiusAt: (t: number) => number, colorAt: (t: number) => THREE.Color, height: number) {
  const rings = 34, sides = 14
  const frames = curve.computeFrenetFrames(rings, false)
  const position: number[] = [], normal: number[] = [], uv: number[] = [], color: number[] = [], index: number[] = []
  for (let i = 0; i <= rings; i++) {
    const t = i / rings, c = curve.getPointAt(t), r = radiusAt(t), col = colorAt(t)
    for (let j = 0; j <= sides; j++) {
      const a = j / sides * Math.PI * 2
      const n = frames.normals[i].clone().multiplyScalar(Math.cos(a)).addScaledVector(frames.binormals[i], Math.sin(a))
      position.push(c.x + n.x * r, c.y + n.y * r, c.z + n.z * r); normal.push(n.x, n.y, n.z)
      uv.push(j / sides, t * height / 3); color.push(col.r, col.g, col.b)
    }
  }
  for (let i = 0; i < rings; i++) for (let j = 0; j < sides; j++) {
    const a = i * (sides + 1) + j, b = a + sides + 1
    index.push(a, b, a + 1, b, b + 1, a + 1)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(position, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normal, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setAttribute('color', new THREE.Float32BufferAttribute(color, 3))
  g.setIndex(index)
  return g
}

/**
 * Royal and coconut palms: geometric leaflets (crisp under MSAA, no alpha
 * cut-outs), fronds swaying on the GPU, sunset translucency when backlit, and
 * warm uplights washing up each trunk. Three draw calls for the whole grove.
 */
export function createPalms(specs: PalmSpec[], motion: boolean) {
  const time = { value: 0 }
  const trunks: THREE.BufferGeometry[] = [], leaves: Buffers = buffers(), extras: THREE.BufferGeometry[] = []
  const green = [new THREE.Color(0x2c4a25), new THREE.Color(0x375a2b), new THREE.Color(0x425f2c)]
  const aging = new THREE.Color(0x6d6a34)
  for (const spec of specs) {
    const royal = spec.kind === 'royal'
    const base = new THREE.Vector3(spec.x, spec.ground, spec.z)
    const lean = new THREE.Vector3(Math.cos(spec.heading ?? 0), 0, Math.sin(spec.heading ?? 0)).multiplyScalar((spec.lean ?? 0) * spec.height)
    const curve = new THREE.CatmullRomCurve3(royal
      ? [base, base.clone().add(new THREE.Vector3(0, spec.height * .5, 0)).addScaledVector(lean, .3), base.clone().add(new THREE.Vector3(0, spec.height, 0)).add(lean)]
      : [base, base.clone().add(new THREE.Vector3(0, spec.height * .4, 0)).addScaledVector(lean, .15), base.clone().add(new THREE.Vector3(0, spec.height * .75, 0)).addScaledVector(lean, .6), base.clone().add(new THREE.Vector3(0, spec.height, 0)).add(lean)])
    const scale = spec.height / 12
    const bark = royal ? new THREE.Color(0xb3ada2) : new THREE.Color(0x8c7a64)
    const shaft = new THREE.Color(0x5d7a3e)
    trunks.push(trunk(curve,
      t => royal ? scale * (.23 + .07 * Math.sin(Math.min(1, t / .8) * Math.PI) - t * .05 + (t > .8 ? .025 : 0)) : scale * (.21 - t * .08 + Math.max(0, .08 - t) * 1.1),
      t => royal && t > .8 ? shaft : bark, spec.height))
    const crown = curve.getPointAt(1)
    const count = royal ? 15 : 17
    for (let i = 0; i < count; i++) {
      const s = spec.seed * 37 + i
      const heading = i / count * Math.PI * 2 + rand(s) * .35
      const young = i % 6 === 0
      const old = !young && rand(s + 9) < .2
      const tint = old ? green[1].clone().lerp(aging, .7) : green[i % 3]
      frond(leaves, crown, heading, young ? 1.15 : old ? -.2 : .3 + rand(s + 2) * .35, spec.height * (young ? .32 : .44 + rand(s + 5) * .08), s, tint, royal)
    }
    if (!royal) for (let i = 0; i < 6; i++) {
      const a = i * 1.1 + spec.seed
      extras.push(new THREE.SphereGeometry(.2 * scale, 10, 8).translate(crown.x + Math.cos(a) * .32 * scale, crown.y - .35 * scale - (i % 2) * .15, crown.z + Math.sin(a) * .32 * scale))
    }
    // Round stucco planter with a lip.
    extras.push(new THREE.CylinderGeometry(.95, 1.02, .55, 28).translate(spec.x, spec.ground + .275, spec.z))
    extras.push(new THREE.TorusGeometry(.96, .06, 6, 28).rotateX(Math.PI / 2).translate(spec.x, spec.ground + .55, spec.z))
  }
  const group = new THREE.Group()
  const barkMap = ringTexture('#d8d2c6', '#6e675c')
  const trunkMaterial = new THREE.MeshStandardMaterial({ map: barkMap, bumpMap: barkMap, bumpScale: .6, vertexColors: true, roughness: .8 })
  trunkMaterial.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying float psUp;').replace('#include <uv_vertex>', '#include <uv_vertex>\npsUp = uv.y;')
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying float psUp;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        // Uplight from the planter: warm, fading up the trunk.
        totalEmissiveRadiance += diffuseColor.rgb * vec3(1.2, .72, .42) * exp(-psUp * 1.1) * .3;`)
  }
  trunkMaterial.customProgramCacheKey = () => 'playsense-palm-trunk-v2'
  const trunkMesh = new THREE.Mesh(mergeGeometries(trunks), trunkMaterial)
  trunkMesh.castShadow = true
  group.add(trunkMesh)
  const extrasMesh = new THREE.Mesh(mergeGeometries(extras.map(g => { g.deleteAttribute('uv'); return g.index ? g.toNonIndexed() : g })), new THREE.MeshStandardMaterial({ color: 0xbdb5ab, roughness: .6 }))
  extrasMesh.castShadow = true
  group.add(extrasMesh)

  const leafMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: .55, metalness: 0 })
  leafMaterial.onBeforeCompile = shader => {
    shader.uniforms.psTime = time
    shader.uniforms.psSun = { value: SUN_DIRECTION }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float psTime; attribute float psSway; varying vec3 psWorld;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float psPhase = psTime * 1.1 + position.x * .19 + position.z * .23;
        float psGust = .6 + .4 * sin(psTime * .31 + position.x * .05);
        transformed.y += psSway * psGust * (sin(psPhase) * .32 + sin(psPhase * 2.7) * .06);
        transformed.x += psSway * psGust * sin(psPhase * .8 + 1.) * .24;
        transformed.z += psSway * psGust * cos(psPhase * .7) * .18;
        transformed += psSway * .03 * sin(psTime * 7. + position.yzx * 9.);`)
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\npsWorld = (modelMatrix * vec4(transformed, 1.)).xyz;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 psSun; varying vec3 psWorld;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        vec3 psView = normalize(psWorld - cameraPosition);
        float psBack = pow(max(dot(psView, normalize(psSun + vec3(0., .1, 0.))), 0.), 4.);
        totalEmissiveRadiance += diffuseColor.rgb * vec3(1.1, .75, .5) * (psBack * .45 + .03);`)
  }
  leafMaterial.customProgramCacheKey = () => 'playsense-palm-leaf-v2'
  const leafMesh = new THREE.Mesh(toGeometry(leaves), leafMaterial)
  leafMesh.castShadow = true
  group.add(leafMesh)
  trunks.forEach(g => g.dispose()); extras.forEach(g => g.dispose())
  return { group, update(dt: number) { if (motion) time.value += dt } }
}
