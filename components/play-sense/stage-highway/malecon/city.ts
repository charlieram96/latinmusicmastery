import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { SKY } from './glsl'
import { SEA_Y, type SkyUniforms } from './sky'
import { billboards } from './glow'

const rand = (seed: number) => { const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x) }
const QUAY = SEA_Y + 1.6
const PASTELS = [0xe9d6b2, 0xe6a79d, 0xe8c36b, 0x7db5ad, 0x8ea8c8, 0xd88b6d, 0xdcd8cf, 0xa8cfb0, 0xc9a2c4, 0xf0c9a0]

/** Where the curving seafront sits: `s` runs from the horizon (0) to the left edge of frame (1). */
function seafront(s: number, depth = 0) {
  const angle = THREE.MathUtils.degToRad(THREE.MathUtils.lerp(-9, -58, s))
  const distance = THREE.MathUtils.lerp(820, 300, Math.pow(s, .8)) + depth
  return { x: Math.sin(angle) * distance, z: -Math.cos(angle) * distance, facing: -angle }
}

/**
 * Facades are shaded here rather than by scene lights: dusk sky fill, a warm rim
 * where the sun grazes, procedurally lit windows, ground-floor arcades and
 * atmospheric perspective that melts distant blocks into the horizon haze.
 */
function facadeMaterial(uniforms: SkyUniforms, windowLights: { value: number }) {
  return new THREE.ShaderMaterial({
    uniforms: { ...uniforms, psWindows: windowLights } as unknown as Record<string, THREE.IUniform>,
    fog: false,
    vertexShader: /* glsl */ `
      attribute vec3 psTint;
      attribute float psDetail;
      varying vec3 vWorld; varying vec3 vNormal; varying vec2 vFacade; varying vec3 vTint; varying float vSeed; varying float vDetail; varying float vTop;
      void main() {
        mat4 instance = mat4(1.);
        #ifdef USE_INSTANCING
          instance = instanceMatrix;
        #endif
        vec3 scale = vec3(length(instance[0].xyz), length(instance[1].xyz), length(instance[2].xyz));
        vec4 world = modelMatrix * instance * vec4(position, 1.);
        vWorld = world.xyz;
        vNormal = normalize(mat3(modelMatrix) * mat3(instance) * normal);
        vec3 local = position * scale;
        vFacade = vec2(abs(normal.x) > .5 ? local.z : local.x, local.y);
        vTop = local.y / max(scale.y, .001);
        vTint = psTint; vDetail = psDetail;
        vSeed = instance[3].x * .137 + instance[3].z * .071;
        gl_Position = projectionMatrix * viewMatrix * world;
      }`,
    fragmentShader: /* glsl */ `
      uniform float psWindows;
      varying vec3 vWorld; varying vec3 vNormal; varying vec2 vFacade; varying vec3 vTint; varying float vSeed; varying float vDetail; varying float vTop;
      ${SKY}
      void main() {
        vec3 n = normalize(vNormal);
        vec3 view = normalize(vWorld - cameraPosition);
        float dist = length(vWorld - cameraPosition);
        float skyFill = .5 + .5 * n.y;
        vec3 ambient = mix(vec3(.16, .1, .2), vec3(.2, .17, .34), skyFill);
        float graze = pow(max(dot(n, psSunDir), 0.), 1.5);
        vec3 color = vTint * (ambient + vec3(1.25, .55, .28) * graze * .75);
        // Roofs catch more of the bright western sky.
        color += vTint * vec3(.35, .2, .2) * step(.9, n.y);
        if (vDetail > .5 && abs(n.y) < .5) {
          vec2 cell = vec2(vFacade.x / 3.6, (vFacade.y - 1.) / 5.2);
          vec2 id = floor(cell), f = fract(cell);
          float storey = id.y;
          float pane = step(.24, f.x) * step(f.x, .76) * step(.2, f.y) * step(f.y, .8);
          float lit = step(.64, psHash(id + vSeed)) * step(0., storey);
          float warmth = psHash(id * 1.7 + vSeed);
          vec3 lamp = mix(vec3(1.7, .8, .34), vec3(2., 1.35, .72), warmth) * (.3 + .7 * psHash(id + 9.));
          vec3 glass = psSky(reflect(view, n)) * .18 + vec3(.01, .012, .02);
          color = mix(color, mix(glass, lamp * psWindows, lit), pane * .92);
          // Balcony rails and cornices every storey, and a shadowed arcade at street level.
          color *= 1. - .35 * step(.9, f.y);
          float arcade = step(storey, 0.) * step(.12, f.x) * step(f.x, .88) * step(f.y, .78 - pow(abs(f.x - .5) * 2., 2.) * .25);
          color = mix(color, vec3(.03, .02, .03) + lamp * .12 * psWindows, arcade * .9);
        }
        color *= 1. - .25 * step(.97, vTop) * (1. - step(.9, n.y));
        vec3 haze = psSky(normalize(vec3(view.x, .015, view.z)));
        color = mix(color, haze * .9, 1. - exp(-dist * .0021));
        gl_FragColor = vec4(color, 1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  })
}

export function createCity(uniforms: SkyUniforms, motion: boolean) {
  const group = new THREE.Group()
  const windows = { value: 1 }
  const time = { value: 0 }
  const material = facadeMaterial(uniforms, windows)
  // Up to three rows of blocks behind the seafront; taller, plainer ones further back.
  const blocks: { position: THREE.Vector3; size: THREE.Vector3; facing: number; tint: number; detail: number }[] = []
  for (let row = 0; row < 4; row++) {
    let s = row * .013
    while (s < 1) {
      const seed = s * 1000 + row * 77
      const width = THREE.MathUtils.lerp(11, 22, rand(seed)) * (row ? 1.2 : 1)
      const at = seafront(s, row * 26 + rand(seed + 1) * 6)
      const storeys = row === 0 ? 3 + Math.floor(rand(seed + 2) * 4) : 4 + Math.floor(rand(seed + 3) * (row >= 2 ? 12 : 6))
      const height = storeys * 5.2 + 1.5
      const depth = 15 + rand(seed + 4) * 10
      blocks.push({ position: new THREE.Vector3(at.x, QUAY, at.z), size: new THREE.Vector3(width, height, depth), facing: at.facing,
        tint: PASTELS[Math.floor(rand(seed + 5) * PASTELS.length)], detail: 1 })
      const distance = Math.hypot(at.x, at.z)
      s += (width + 1.5 + rand(seed + 6) * 3) / (distance * .87)
    }
  }
  const box = new THREE.BoxGeometry(1, 1, 1).translate(0, .5, 0)
  box.setAttribute('psTint', new THREE.InstancedBufferAttribute(new Float32Array(blocks.flatMap(b => new THREE.Color(b.tint).toArray())), 3))
  box.setAttribute('psDetail', new THREE.InstancedBufferAttribute(new Float32Array(blocks.map(b => b.detail)), 1))
  const city = new THREE.InstancedMesh(box, material, blocks.length)
  const dummy = new THREE.Object3D()
  blocks.forEach((b, i) => {
    dummy.position.copy(b.position); dummy.rotation.set(0, b.facing, 0); dummy.scale.copy(b.size)
    dummy.updateMatrix(); city.setMatrixAt(i, dummy.matrix)
  })
  city.frustumCulled = false
  group.add(city)

  // Landmarks: a great dome and paired bell towers break the roofline.
  const landmarkParts: THREE.BufferGeometry[] = []
  const place = (geometry: THREE.BufferGeometry, x: number, y: number, z: number) => landmarkParts.push(geometry.scale(.62, .62, .62).translate(x, QUAY + (y - QUAY) * .62, z))
  const dome = seafront(.52, 120)
  place(new THREE.BoxGeometry(70, 34, 50).translate(0, 17, 0), dome.x, QUAY, dome.z)
  place(new THREE.CylinderGeometry(15, 16, 22, 28), dome.x, QUAY + 45, dome.z)
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * Math.PI * 2
    place(new THREE.BoxGeometry(1.4, 20, 1.4), dome.x + Math.cos(a) * 16.4, QUAY + 45, dome.z + Math.sin(a) * 16.4)
  }
  place(new THREE.SphereGeometry(15, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 1.35, 1), dome.x, QUAY + 56, dome.z)
  place(new THREE.CylinderGeometry(2.4, 2.8, 9, 12), dome.x, QUAY + 80, dome.z)
  place(new THREE.ConeGeometry(2.8, 6, 12), dome.x, QUAY + 87, dome.z)
  for (const [s, depth] of [[.3, 60], [.74, 50]] as const) {
    const church = seafront(s, depth)
    for (const side of [-1, 1]) {
      const x = church.x + side * 7 * Math.cos(church.facing), z = church.z - side * 7 * Math.sin(church.facing)
      place(new THREE.BoxGeometry(7, 52, 7), x, QUAY + 26, z)
      place(new THREE.BoxGeometry(5.6, 9, 5.6), x, QUAY + 56.5, z)
      place(new THREE.ConeGeometry(4, 9, 4).rotateY(Math.PI / 4), x, QUAY + 65.5, z)
    }
  }
  const landmarkGeometry = mergeGeometries(landmarkParts.map(g => g.index ? g.toNonIndexed() : g))
  landmarkGeometry.deleteAttribute('uv')
  const count = landmarkGeometry.getAttribute('position').count
  landmarkGeometry.setAttribute('psTint', new THREE.Float32BufferAttribute(new Float32Array(count * 3).fill(.86), 3))
  landmarkGeometry.setAttribute('psDetail', new THREE.Float32BufferAttribute(new Float32Array(count), 1))
  group.add(new THREE.Mesh(landmarkGeometry, material))
  landmarkParts.forEach(g => g.dispose())

  // A quay wall under the seafront, then a necklace of lamps and their reflections.
  const quay: THREE.BufferGeometry[] = []
  const lamps: THREE.Vector3[] = []
  for (let i = 0; i < 90; i++) {
    const s = i / 89, a = seafront(s, -12), b = seafront(Math.min(1, s + 1 / 89), -12)
    const length = Math.hypot(b.x - a.x, b.z - a.z) + .5
    quay.push(new THREE.BoxGeometry(length, 1.6, 4).rotateY(Math.atan2(-(b.z - a.z), b.x - a.x)).translate((a.x + b.x) / 2, SEA_Y + .8, (a.z + b.z) / 2))
    if (i % 2 === 0) lamps.push(new THREE.Vector3(a.x, QUAY + 6.5, a.z))
  }
  const quayGeometry = mergeGeometries(quay)
  const qCount = quayGeometry.getAttribute('position').count
  quayGeometry.setAttribute('psTint', new THREE.Float32BufferAttribute(new Float32Array(qCount * 3).fill(.55), 3))
  quayGeometry.setAttribute('psDetail', new THREE.Float32BufferAttribute(new Float32Array(qCount), 1))
  group.add(new THREE.Mesh(quayGeometry, material))
  quay.forEach(g => g.dispose())
  const lampColor = new THREE.Color(2.4, 1.35, .6)
  group.add(billboards(lamps, lampColor, .9, 1, time, false))
  group.add(billboards(lamps.map(p => new THREE.Vector3(p.x, SEA_Y + .02, p.z)), lampColor, .55, 9, time, true))

  // El Morro: headland, fortress walls, and the lighthouse sweeping the bay.
  const morro = new THREE.Group()
  morro.position.set(150, SEA_Y, -430)
  const rockParts: THREE.BufferGeometry[] = []
  for (let i = 0; i < 7; i++) {
    const rock = new THREE.IcosahedronGeometry(26 + rand(i) * 14, 1)
    const p = rock.getAttribute('position')
    for (let v = 0; v < p.count; v++) p.setXYZ(v, p.getX(v) * (1.6 + rand(v + i) * .3), Math.max(0, p.getY(v)) * .55, p.getZ(v))
    rock.translate(-60 + i * 26, 0, rand(i + 4) * 16)
    rockParts.push(rock.toNonIndexed())
  }
  rockParts.push(new THREE.BoxGeometry(120, 14, 30).translate(-10, 20, 5).toNonIndexed())
  for (let i = 0; i < 9; i++) rockParts.push(new THREE.BoxGeometry(4, 3, 30).translate(-64 + i * 13, 28.5, 5).toNonIndexed())
  rockParts.push(new THREE.CylinderGeometry(3.6, 4.6, 46, 16).translate(30, 45, 5).toNonIndexed())
  rockParts.push(new THREE.CylinderGeometry(5.5, 5.5, 1.5, 16).translate(30, 68.5, 5).toNonIndexed())
  const rocks = mergeGeometries(rockParts)
  rocks.deleteAttribute('uv')
  rocks.computeVertexNormals()
  const rCount = rocks.getAttribute('position').count
  rocks.setAttribute('psTint', new THREE.Float32BufferAttribute(new Float32Array(rCount * 3).fill(.5), 3))
  rocks.setAttribute('psDetail', new THREE.Float32BufferAttribute(new Float32Array(rCount), 1))
  morro.add(new THREE.Mesh(rocks, material))
  rockParts.forEach(g => g.dispose())
  const lantern = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 4, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 3.1, 1.8), fog: false }))
  lantern.position.set(30, 71.5, 5)
  morro.add(lantern)
  const beamMaterial = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: /* glsl */ `varying vec2 vUv;
      void main() {
        float along = 1. - vUv.y;
        float fade = pow(max(0., 1. - along), 2.2) * smoothstep(0., .03, along);
        float wrap = sin(vUv.x * 3.14159 * 2.); float core = wrap * wrap;
        gl_FragColor = vec4(vec3(1., .82, .55) * fade * (.05 + .07 * core), 1.);
      }`,
  })
  const beamGeometry = new THREE.ConeGeometry(16, 420, 24, 1, true).translate(0, -210, 0).rotateZ(Math.PI / 2)
  const beam = new THREE.Mesh(beamGeometry, beamMaterial)
  const pivot = new THREE.Group(); pivot.position.copy(lantern.position); pivot.add(beam)
  morro.add(pivot)
  const flare = billboards([new THREE.Vector3(0, 0, 0)], new THREE.Color(3.6, 2.8, 1.8), 6, 1, time, false)
  flare.position.copy(lantern.position)
  morro.add(flare)
  group.add(morro)

  const flareMaterial = flare.material as THREE.ShaderMaterial
  const flareColor = new THREE.Color(3.6, 2.8, 1.8)
  const toCamera = new THREE.Vector3(), beamDirection = new THREE.Vector3()
  let angle = 2.2
  return {
    group,
    update(dt: number, camera: THREE.Camera) {
      if (motion) { angle += dt * .55; time.value += dt }
      pivot.rotation.y = angle
      beamDirection.set(Math.cos(angle), 0, -Math.sin(angle))
      toCamera.copy(camera.position).sub(morro.position).setY(0).normalize()
      const facing = Math.max(0, beamDirection.dot(toCamera))
      flareMaterial.uniforms.psColor.value.copy(flareColor).multiplyScalar(.35 + Math.pow(facing, 40) * 5)
    },
  }
}
