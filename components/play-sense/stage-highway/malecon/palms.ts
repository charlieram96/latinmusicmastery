import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { SUN_DIRECTION } from './sky'

export interface PalmSpec { x: number; z: number; ground: number; height: number; lean: number; heading: number; seed: number }

const rand = (seed: number) => { const x = Math.sin(seed * 91.17 + 7.3) * 43758.5453; return x - Math.floor(x) }

/** One leaflet sheet shared by every frond: rachis, tapered pinnae, soft alpha edge. */
function frondTexture() {
  const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 1024
  const ctx = canvas.getContext('2d')!
  ctx.lineCap = 'round'
  for (let i = 0; i < 96; i++) {
    const v = 24 + i * 10.3, t = v / 1024
    const reach = 118 * Math.sin(Math.min(1, t * 1.15) * Math.PI) ** .7 + 8
    for (const side of [-1, 1]) {
      const droop = 70 + t * 90 + rand(i * 3 + side) * 30
      const shade = 34 + rand(i + side * 11) * 30
      ctx.strokeStyle = `rgb(${shade * .7 + 8 | 0},${shade + 30 | 0},${shade * .55 | 0})`
      ctx.lineWidth = 6 - t * 3.4
      ctx.beginPath(); ctx.moveTo(128, v)
      ctx.quadraticCurveTo(128 + side * reach * .55, v + droop * .2, 128 + side * reach, v + droop)
      ctx.stroke()
    }
  }
  ctx.strokeStyle = '#4d5a33'; ctx.lineWidth = 7
  ctx.beginPath(); ctx.moveTo(128, 0); ctx.lineTo(128, 1024); ctx.stroke()
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

function trunkTexture() {
  const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 512
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#3f372f'; ctx.fillRect(0, 0, 64, 512)
  for (let y = 0; y < 512; y += 9) {
    const g = ctx.createLinearGradient(0, y, 0, y + 9)
    g.addColorStop(0, '#26211c'); g.addColorStop(.35, '#5a5046'); g.addColorStop(1, '#342d27')
    ctx.fillStyle = g; ctx.fillRect(0, y, 64, 9)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  return texture
}

/** Tapered trunk with the gentle S-curve of a coastal palm; rings live in the texture. */
function trunkGeometry(spec: PalmSpec, curve: THREE.CatmullRomCurve3) {
  const rings = 28, sides = 10
  const frames = curve.computeFrenetFrames(rings, false)
  const positions: number[] = [], normals: number[] = [], uvs: number[] = [], index: number[] = []
  for (let i = 0; i <= rings; i++) {
    const t = i / rings, center = curve.getPointAt(t)
    const radius = (0.24 - t * 0.09 + Math.max(0, 0.1 - t) * 1.1) * (spec.height / 11)
    for (let j = 0; j <= sides; j++) {
      const a = j / sides * Math.PI * 2
      const n = frames.normals[i].clone().multiplyScalar(Math.cos(a)).add(frames.binormals[i].clone().multiplyScalar(Math.sin(a)))
      positions.push(center.x + n.x * radius, center.y + n.y * radius, center.z + n.z * radius)
      normals.push(n.x, n.y, n.z); uvs.push(j / sides, t * spec.height / 1.4)
    }
  }
  for (let i = 0; i < rings; i++) for (let j = 0; j < sides; j++) {
    const a = i * (sides + 1) + j, b = a + sides + 1
    index.push(a, b, a + 1, b, b + 1, a + 1)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(index)
  return geometry
}

/** A V-folded ribbon that arcs out of the crown and droops under its own weight. */
function frondGeometry(crown: THREE.Vector3, heading: number, rise: number, length: number, width: number, seed: number) {
  const rows = 14
  const out = new THREE.Vector3(Math.cos(heading), 0, Math.sin(heading))
  const positions: number[] = [], uvs: number[] = [], sway: number[] = [], index: number[] = []
  const point = (t: number) => crown.clone().addScaledVector(out, length * t * (1 - t * .12))
    .add(new THREE.Vector3(0, length * (rise * t - (0.55 + rand(seed) * .3) * t * t), 0))
  for (let i = 0; i <= rows; i++) {
    const t = i / rows, spine = point(t)
    const tangent = point(Math.min(1, t + .02)).sub(point(Math.max(0, t - .02))).normalize()
    const side = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize()
    const half = Math.max(.04, width * Math.sin(Math.min(.97, t * 1.1 + .05) * Math.PI) ** .6 * .5)
    const fold = new THREE.Vector3(0, -half * .95, 0)
    for (const [k, u] of [[-1, 0], [0, .5], [1, 1]] as const) {
      const p = spine.clone().addScaledVector(side, k * half)
      if (k) p.add(fold)
      positions.push(p.x, p.y, p.z); uvs.push(u, t); sway.push(t * t)
    }
  }
  for (let i = 0; i < rows; i++) for (let k = 0; k < 2; k++) {
    const a = i * 3 + k, b = a + 3
    index.push(a, b, a + 1, b, b + 1, a + 1)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setAttribute('psSway', new THREE.Float32BufferAttribute(sway, 1))
  geometry.setIndex(index)
  geometry.computeVertexNormals()
  return geometry
}

/**
 * Every palm in the scene becomes two draw calls (trunks, fronds). Fronds sway in
 * the vertex shader and glow through when the low sun sits behind them.
 */
export function createPalms(specs: PalmSpec[], motion: boolean) {
  const time = { value: 0 }
  const trunks: THREE.BufferGeometry[] = [], fronds: THREE.BufferGeometry[] = [], nuts: THREE.BufferGeometry[] = []
  for (const spec of specs) {
    const base = new THREE.Vector3(spec.x, spec.ground, spec.z)
    const lean = new THREE.Vector3(Math.cos(spec.heading), 0, Math.sin(spec.heading)).multiplyScalar(spec.lean * spec.height)
    const curve = new THREE.CatmullRomCurve3([
      base,
      base.clone().add(new THREE.Vector3(0, spec.height * .35, 0)).addScaledVector(lean, .18),
      base.clone().add(new THREE.Vector3(0, spec.height * .72, 0)).addScaledVector(lean, .62),
      base.clone().add(new THREE.Vector3(0, spec.height, 0)).add(lean),
    ])
    trunks.push(trunkGeometry(spec, curve))
    const crown = curve.getPointAt(1)
    const count = 13
    for (let i = 0; i < count; i++) {
      const s = spec.seed * 31 + i
      const heading = i / count * Math.PI * 2 + rand(s) * .4
      const young = i % 5 === 0
      fronds.push(frondGeometry(crown, heading, young ? 1.1 : .35 + rand(s + 2) * .3, spec.height * (young ? .3 : .42 + rand(s + 5) * .1), spec.height * .2, s))
    }
    for (let i = 0; i < 5; i++) {
      const a = i * 1.3 + spec.seed
      nuts.push(new THREE.SphereGeometry(.2 * spec.height / 11, 8, 6).translate(crown.x + Math.cos(a) * .3, crown.y - .35 - (i % 2) * .15, crown.z + Math.sin(a) * .3))
    }
  }
  const group = new THREE.Group()
  const bark = trunkTexture()
  const trunk = new THREE.Mesh(mergeGeometries(trunks), new THREE.MeshStandardMaterial({ map: bark, bumpMap: bark, bumpScale: 1.2, roughness: .92 }))
  trunk.castShadow = true
  group.add(trunk)
  const coconut = new THREE.Mesh(mergeGeometries(nuts), new THREE.MeshStandardMaterial({ color: 0x3b3322, roughness: .6 }))
  group.add(coconut)
  const leafMap = frondTexture()
  const leaf = new THREE.MeshStandardMaterial({ map: leafMap, alphaTest: .4, alphaToCoverage: true, side: THREE.DoubleSide, roughness: .7, color: 0x8e9480 })
  leaf.onBeforeCompile = shader => {
    shader.uniforms.psTime = time
    shader.uniforms.psSun = { value: SUN_DIRECTION }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        uniform float psTime; attribute float psSway; varying vec3 psWorld;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float psPhase = psTime * 1.25 + position.x * .21 + position.z * .17;
        transformed.y += psSway * (sin(psPhase) * .38 + sin(psPhase * 2.3) * .09);
        transformed.x += psSway * sin(psPhase * .8 + 1.) * .26;
        transformed.z += psSway * cos(psPhase * .7) * .18;`)
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
        psWorld = (modelMatrix * vec4(transformed, 1.)).xyz;`)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform vec3 psSun; varying vec3 psWorld;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        // Thin leaves let the low sun through: a warm translucency when backlit.
        vec3 psView = normalize(psWorld - cameraPosition);
        float psBack = pow(max(dot(psView, psSun), 0.), 3.);
        totalEmissiveRadiance += diffuseColor.rgb * vec3(1.6, .95, .35) * (psBack * .9 + .05);`)
  }
  leaf.customProgramCacheKey = () => 'playsense-palm-v1'
  if (!motion) time.value = 0
  const leaves = new THREE.Mesh(mergeGeometries(fronds), leaf)
  // Custom depth material keeps alpha-cut shadows from the swaying fronds.
  leaves.castShadow = true
  group.add(leaves)
  trunks.forEach(g => g.dispose()); fronds.forEach(g => g.dispose()); nuts.forEach(g => g.dispose())
  return { group, update(dt: number) { if (motion) time.value += dt } }
}
