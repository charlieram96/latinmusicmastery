import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { SKY } from './glsl'
import { SEA_Y, type SkyUniforms } from './sky'
import { billboards } from './glow'

const rand = (seed: number) => { const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x) }
const WATERLINE = SEA_Y + .4
/** Miami's LED palette: flamingo, aqua, violet, warm white. */
const LED = [[1.25, .1, .55], [.08, .85, 1.15], [.6, .18, 1.3], [1.15, .92, .62]]

/** A point on the far shore: `angle` in degrees from straight ahead (negative = left). */
function shore(angle: number, distance: number) {
  const a = THREE.MathUtils.degToRad(angle)
  return new THREE.Vector3(Math.sin(a) * distance, WATERLINE, -Math.cos(a) * distance)
}

/**
 * Glass towers shaded in one pass: sky reflections with Fresnel, mullions and slab
 * edges, office floors lit in clusters, and LED outlines/crowns that drift through
 * the palette. Bases dissolve into the bay haze for depth.
 */
function towerMaterial(uniforms: SkyUniforms, round: boolean, mirror = false) {
  return new THREE.ShaderMaterial({
    uniforms: uniforms as unknown as Record<string, THREE.IUniform>,
    fog: false,
    // The mirrored copy is the skyline's reflection in the bay: flipped, rippled, faded.
    transparent: mirror, depthWrite: !mirror, side: mirror ? THREE.DoubleSide : THREE.FrontSide,
    vertexShader: /* glsl */ `
      uniform float psTime;
      attribute vec4 psStyle;   // x: seed, y: lit density, z: LED mode, w: LED palette index
      attribute vec3 psGlass;
      varying vec3 vWorld; varying vec3 vNormal; varying vec3 vLocal; varying vec3 vSize; varying vec4 vStyle; varying vec3 vGlass;
      void main() {
        vec3 size = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
        vec4 world = modelMatrix * instanceMatrix * vec4(position, 1.);
        ${mirror ? `world.y = ${(2 * SEA_Y).toFixed(2)} - world.y;
        float below = ${SEA_Y.toFixed(2)} - world.y;
        world.x += sin(world.y * .9 + psTime * 1.6) * .35 * min(below, 40.) / 40.;` : ''}
        vWorld = world.xyz; vLocal = position * size; vSize = size;
        vNormal = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
        vStyle = psStyle; vGlass = psGlass;
        gl_Position = projectionMatrix * viewMatrix * world;
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vWorld; varying vec3 vNormal; varying vec3 vLocal; varying vec3 vSize; varying vec4 vStyle; varying vec3 vGlass;
      ${SKY}
      vec3 psLed(float index) {
        vec3 palette[4];
        palette[0] = vec3(${LED[0].join(',')}); palette[1] = vec3(${LED[1].join(',')}); palette[2] = vec3(${LED[2].join(',')}); palette[3] = vec3(${LED[3].join(',')});
        float drift = psTime * .05 * psCloudMotion + vStyle.x * 4.;
        int a = int(mod(index + floor(drift), 4.)), b = int(mod(index + floor(drift) + 1., 4.));
        return mix(palette[a], palette[b], smoothstep(.75, 1., fract(drift)));
      }
      void main() {
        vec3 n = normalize(vNormal);
        vec3 view = normalize(vWorld - cameraPosition);
        float dist = length(vWorld - cameraPosition);
        float side = step(.5, abs(n.y));
        ${round
          ? 'float u = atan(vLocal.z, vLocal.x) * vSize.x * .5;'
          : 'float u = abs(n.x) > .5 ? vLocal.z : vLocal.x;'}
        float h = vLocal.y;
        float top = h / vSize.y;
        // Curtain wall: dark blue-violet glass mirroring the sky; backlit edges catch the afterglow.
        float facing = max(dot(-view, n), 0.);
        float fresnel = .04 + .96 * pow(max(0., 1. - facing), 5.);
        vec3 color = vGlass * .12 + psSkyClear(reflect(view, n)) * (fresnel * .55 + .07);
        color *= .65 + .35 * top;
        float rimLight = pow(max(dot(n, normalize(vec3(psSunDir.x, 0., psSunDir.z))), 0.), 2.) * (1. - side);
        color += vec3(1., .42, .3) * rimLight * .22;
        vec2 cell = vec2(u / 1.35, h / 1.55);
        vec2 id = floor(cell), f = fract(cell);
        // Scattered offices and apartments: lit in loose clusters, warm and cool.
        float cluster = psNoise(vec2(u * .08, h * .12) + vStyle.x * 40.);
        float lit = step(1. - vStyle.y * .38 * smoothstep(.35, .75, cluster), psHash(id + vStyle.x * 17.)) * (1. - side);
        vec3 lamp = mix(vec3(1.3, .85, .5), vec3(.85, .95, 1.25), step(.55, psHash(id * .37 + vStyle.x))) * (.35 + .65 * psHash(id + 3.));
        color = mix(color, lamp, lit * step(.12, f.x) * step(f.y, .78));
        color *= 1. - (1. - side) * (.25 * step(.92, f.y));
        // LED signature: 1 = vertical corners, 2 = crown band, 3 = crown + floor stripes.
        vec3 led = psLed(vStyle.w);
        float mode = vStyle.z;
        ${round
          ? 'float corner = 0.;'
          : 'float corner = 1. - smoothstep(.1, .38, abs(n.x) > .5 ? vSize.z * .5 - abs(vLocal.z) : vSize.x * .5 - abs(vLocal.x));'}
        float crown = smoothstep(vSize.y - 3.5, vSize.y - 3., h) * (1. - smoothstep(vSize.y - 1.2, vSize.y - .9, h));
        float stripe = step(.9, fract(h / 7.75)) * step(.3, top);
        float glow = mode == 1. ? corner : mode == 2. ? crown : mode == 3. ? max(crown, stripe * .6) : mode == 4. ? .72 + .28 * crown : 0.;
        color = mix(color, led * 1.25, clamp(glow, 0., 1.) * (1. - side * .5));
        // Bay haze: only the bases melt into the waterline glow; distance adds a light veil.
        vec3 haze = mix(psSkyClear(normalize(vec3(view.x, .02, view.z))), vec3(.2, .09, .26), .55) * .75;
        float low = 1. - smoothstep(0., 18., vWorld.y - ${WATERLINE.toFixed(2)});
        color = mix(color, haze, clamp(1. - exp(-dist * .00028) + low * .45, 0., .8));
        ${mirror ? `float depth = ${SEA_Y.toFixed(2)} - vWorld.y;
        float fade = exp(-depth * .035) * (.75 + .25 * sin(vWorld.y * 3.1 + psTime * 2.3));
        gl_FragColor = vec4(color * .8, .5 * fade);` : 'gl_FragColor = vec4(color, 1.);'}
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  })
}

interface Tower { position: THREE.Vector3; size: THREE.Vector3; turn: number; kind: 0 | 1 | 2 | 3; seed: number; density: number; led: number; palette: number; glass: THREE.Color }

/** Box with a roof that slopes across its width: a Brickell-style slanted crown. */
function slantedBox() {
  const geometry = new THREE.BoxGeometry(1, 1, 1, 1, 1, 1).translate(0, .5, 0)
  const p = geometry.getAttribute('position')
  for (let i = 0; i < p.count; i++) if (p.getY(i) > .99) p.setY(i, p.getX(i) > 0 ? 1 : .9)
  geometry.computeVertexNormals()
  return geometry
}

export function createSkyline(uniforms: SkyUniforms, motion: boolean) {
  const group = new THREE.Group()
  const time = { value: 0 }
  const towers: Tower[] = []
  const glassTints = [0x1a2f52, 0x22335a, 0x2b2c55, 0x1c3a4e, 0x302a4c].map(c => new THREE.Color(c))
  // Downtown and Brickell rise in the middle of the view; the shore steps down to either side.
  let seed = 1
  for (let angle = -44; angle < 44;) {
    const s = seed++
    const centrality = Math.exp(-Math.pow((angle + 3) / 17, 2))
    const distance = 560 + rand(s) * 220 + (1 - centrality) * 60
    const tall = rand(s + 1) < .18 + centrality * .3
    const height = tall ? 55 + rand(s + 2) * 60 * (.5 + centrality) : 16 + rand(s + 3) * 34 * (.4 + centrality)
    const width = 10 + rand(s + 4) * 14
    const kindRoll = rand(s + 5)
    const kind: Tower['kind'] = kindRoll < .16 ? 1 : kindRoll < .34 && tall ? 2 : 0
    const ledRoll = rand(s + 6)
    towers.push({
      position: shore(angle, distance), size: new THREE.Vector3(width, height, kind === 1 ? width : 9 + rand(s + 7) * 12), turn: (rand(s + 8) - .5) * .5,
      kind, seed: rand(s + 9), density: .18 + rand(s + 10) * .35, led: tall ? (ledRoll < .4 ? 1 : ledRoll < .72 ? 2 : ledRoll < .92 ? 3 : 0) : (ledRoll < .22 ? 2 : 0),
      palette: Math.floor(rand(s + 11) * LED.length), glass: glassTints[Math.floor(rand(s + 12) * glassTints.length)],
    })
    angle += (width + 2 + rand(s + 13) * 6) / distance * 57.3 * (.55 + (1 - centrality) * .6)
  }
  // A second, farther row gives the skyline its depth and layered silhouettes.
  for (let i = 0; i < 40; i++) {
    const angle = -30 + rand(i + 500) * 60
    const centrality = Math.exp(-Math.pow((angle + 3) / 20, 2))
    towers.push({
      position: shore(angle, 860 + rand(i + 501) * 160), size: new THREE.Vector3(12 + rand(i + 502) * 12, 30 + rand(i + 503) * 70 * (.4 + centrality), 12), turn: rand(i + 504),
      kind: 0, seed: rand(i + 505), density: .12 + rand(i + 506) * .2, led: rand(i + 507) < .25 ? 2 : 0, palette: i % LED.length, glass: glassTints[i % glassTints.length],
    })
  }
  // Landmarks: a Miami Tower-style stack of lit half-drums and a sawtooth-stepped office tower.
  const landmark = shore(-7, 600)
  towers.push({ position: landmark.clone(), size: new THREE.Vector3(20, 46, 16), turn: .1, kind: 0, seed: .31, density: .35, led: 0, palette: 0, glass: glassTints[1] })
  ;[[19, 11], [16, 11], [12.5, 11]].forEach(([width, height], i) => towers.push({
    position: landmark.clone().setY(landmark.y + 46 + i * 11), size: new THREE.Vector3(width, height, width * .8), turn: .1,
    kind: 3, seed: .5 + i * .1, density: .3, led: 4, palette: 1, glass: glassTints[0] }))
  const saw = shore(10, 640)
  for (let i = 0; i < 5; i++) towers.push({
    position: saw.clone().add(new THREE.Vector3(i * 5.2 - 10, 0, i * 1.5)), size: new THREE.Vector3(5.4, 52 + i * 9, 14), turn: -.2,
    kind: 0, seed: .7 + i * .03, density: .3, led: i === 4 ? 2 : 0, palette: 3, glass: glassTints[2] })

  const halfDrum = new THREE.CylinderGeometry(.5, .5, 1, 24, 1, false, -Math.PI / 2, Math.PI).translate(0, .5, 0)
  const geometries = [new THREE.BoxGeometry(1, 1, 1).translate(0, .5, 0), new THREE.CylinderGeometry(.5, .5, 1, 24, 1).translate(0, .5, 0), slantedBox(), halfDrum]
  const dummy = new THREE.Object3D()
  const tops: THREE.Vector3[] = []
  geometries.forEach((geometry, kind) => {
    const list = towers.filter(t => t.kind === kind)
    if (!list.length) { geometry.dispose(); return }
    geometry.setAttribute('psStyle', new THREE.InstancedBufferAttribute(new Float32Array(list.flatMap(t => [t.seed, t.density, t.led, t.palette])), 4))
    geometry.setAttribute('psGlass', new THREE.InstancedBufferAttribute(new Float32Array(list.flatMap(t => t.glass.toArray())), 3))
    const mesh = new THREE.InstancedMesh(geometry, towerMaterial(uniforms, kind === 1 || kind === 3), list.length)
    list.forEach((t, i) => {
      dummy.position.copy(t.position); dummy.rotation.set(0, t.turn, 0); dummy.scale.copy(t.size)
      dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix)
      if (t.size.y > 70) tops.push(t.position.clone().setY(t.position.y + t.size.y + 1.5))
    })
    mesh.frustumCulled = false
    group.add(mesh)
    const reflection = new THREE.InstancedMesh(geometry, towerMaterial(uniforms, kind === 1 || kind === 3, true), list.length)
    reflection.instanceMatrix = mesh.instanceMatrix
    reflection.frustumCulled = false
    reflection.renderOrder = -3
    group.add(reflection)
  })
  // Red aviation lights on the tallest roofs.
  group.add(billboards(tops, new THREE.Color(2.4, .25, .2), .9, 1, time, 'blink'))

  // The causeway: a low bridge across the bay with its lamps, pillars and traffic.
  const from = shore(-62, 260), to = shore(-18, 470)
  const span = to.clone().sub(from), spanLength = span.length()
  const heading = Math.atan2(-span.z, span.x)
  const deckParts: THREE.BufferGeometry[] = [new THREE.BoxGeometry(spanLength, 1.2, 7).rotateY(heading).translate((from.x + to.x) / 2, WATERLINE + 3.2, (from.z + to.z) / 2)]
  const lamps: THREE.Vector3[] = []
  for (let i = 0; i <= 40; i++) {
    const p = from.clone().lerp(to, i / 40)
    deckParts.push(new THREE.BoxGeometry(1.6, 3.2, 1.6).translate(p.x, WATERLINE + 1.2, p.z))
    if (i % 2 === 0) lamps.push(p.clone().setY(WATERLINE + 6))
  }
  const deck = mergeGeometries(deckParts.map(g => g.toNonIndexed()))
  deckParts.forEach(g => g.dispose())
  group.add(new THREE.Mesh(deck, new THREE.MeshBasicMaterial({ color: 0x160d1c, fog: false })))
  const lampColor = new THREE.Color(1.9, 1.05, .5)
  group.add(billboards(lamps, lampColor, .75, 1, time, 'glow'))
  group.add(billboards(lamps.map(p => p.clone().setY(SEA_Y + .03)), lampColor, .5, 8, time, 'reflection'))
  group.add(traffic(from, to, time))

  // The port: a cruise ship dressed in lights, bow toward downtown.
  const ship = cruiseShip(uniforms)
  ship.position.copy(shore(33, 420)); ship.rotation.y = -.35
  group.add(ship)
  group.add(billboards(Array.from({ length: 12 }, (_, i) => ship.position.clone().add(new THREE.Vector3(-26 + i * 4.6, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), -.35)).setY(SEA_Y + .03)),
    new THREE.Color(1.4, 1.1, .8), .9, 6, time, 'reflection'))

  // Two yachts idling on the bay with their cabin lights on.
  const yachts = [yacht(), yacht()]
  const yachtHome = [new THREE.Vector3(-58, SEA_Y, -120), new THREE.Vector3(74, SEA_Y, -190)]
  yachts.forEach((y, i) => { y.position.copy(yachtHome[i]); y.rotation.y = i ? .9 : -1.2; y.scale.setScalar(i ? 1.2 : 1); group.add(y) })
  const yachtGlow = billboards(yachtHome.map(p => p.clone().setY(SEA_Y + .03)), new THREE.Color(1.5, 1, .6), .8, 5, time, 'reflection')
  group.add(yachtGlow)

  return {
    group,
    update(dt: number) {
      if (!motion) return
      time.value += dt
      yachts.forEach((y, i) => {
        y.position.x = yachtHome[i].x + Math.sin(time.value * .02 + i * 2) * 14
        y.position.y = SEA_Y + Math.sin(time.value * .9 + i) * .05
        y.rotation.z = Math.sin(time.value * .7 + i) * .012
      })
    },
  }
}

/** Head- and tail-lights streaming both ways along the causeway, animated on the GPU. */
function traffic(from: THREE.Vector3, to: THREE.Vector3, time: { value: number }) {
  const count = 70
  const geometry = new THREE.InstancedBufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3))
  geometry.setIndex([0, 1, 2, 0, 2, 3])
  geometry.setAttribute('psCar', new THREE.InstancedBufferAttribute(new Float32Array(Array.from({ length: count }, (_, i) => [rand(i + 900), i % 2, .012 + rand(i + 901) * .01]).flat()), 3))
  geometry.instanceCount = count
  const material = new THREE.ShaderMaterial({
    uniforms: { psTime: time, psFrom: { value: from.clone().setY(from.y + 4.1) }, psTo: { value: to.clone().setY(to.y + 4.1) } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    vertexShader: /* glsl */ `
      attribute vec3 psCar; uniform float psTime; uniform vec3 psFrom; uniform vec3 psTo;
      varying vec2 vUv; varying float vDir;
      void main() {
        float t = fract(psCar.x + psTime * psCar.z * (psCar.y > .5 ? 1. : -1.));
        vec3 lane = normalize(cross(psTo - psFrom, vec3(0., 1., 0.))) * (psCar.y > .5 ? 1.4 : -1.4);
        vec4 center = viewMatrix * vec4(mix(psFrom, psTo, t) + lane, 1.);
        center.xy += position.xy * .45 * (1. + -center.z * .003);
        vUv = position.xy; vDir = psCar.y;
        gl_Position = projectionMatrix * center;
      }`,
    fragmentShader: /* glsl */ `
      varying vec2 vUv; varying float vDir;
      void main() {
        float a = exp(-dot(vUv, vUv) * 4.);
        gl_FragColor = vec4(mix(vec3(2.2, .25, .15), vec3(1.9, 1.7, 1.3), vDir) * a, 1.);
      }`,
  })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.frustumCulled = false
  return mesh
}

function cruiseShip(uniforms: SkyUniforms) {
  const ship = new THREE.Group()
  const hull = new THREE.Mesh(new THREE.BoxGeometry(62, 6, 10).translate(0, 3, 0), new THREE.MeshBasicMaterial({ color: 0x241c2c, fog: false }))
  ship.add(hull)
  const decks = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, .5, 0), towerMaterial(uniforms, false), 5)
  const geometry = decks.geometry
  geometry.setAttribute('psStyle', new THREE.InstancedBufferAttribute(new Float32Array(Array.from({ length: 5 }, (_, i) => [rand(i + 40), .75, i === 4 ? 2 : 0, 1]).flat()), 4))
  geometry.setAttribute('psGlass', new THREE.InstancedBufferAttribute(new Float32Array(Array.from({ length: 5 }, () => [.55, .52, .56]).flat()), 3))
  const dummy = new THREE.Object3D()
  for (let i = 0; i < 5; i++) {
    dummy.position.set(-4 + i * 2, 6 + i * 2.6, 0); dummy.scale.set(52 - i * 7, 2.6, 9 - i * .6)
    dummy.updateMatrix(); decks.setMatrixAt(i, dummy.matrix)
  }
  decks.frustumCulled = false
  ship.add(decks)
  const funnel = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2, 5, 12).translate(8, 21.5, 0), new THREE.MeshBasicMaterial({ color: 0x3a1f2f, fog: false }))
  ship.add(funnel)
  return ship
}

function yacht() {
  const boat = new THREE.Group()
  const shape = new THREE.Shape()
  shape.moveTo(-5, 0); shape.lineTo(4.2, 0); shape.lineTo(6, 1.3); shape.lineTo(-5.2, 1.3); shape.closePath()
  const hull = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 2.4, bevelEnabled: false }).translate(0, 0, -1.2), new THREE.MeshStandardMaterial({ color: 0xe8e2dc, roughness: .35 }))
  boat.add(hull)
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(4.4, 1, 1.9).translate(-.8, 1.8, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 1.05, .62) }))
  boat.add(cabin)
  const roof = new THREE.Mesh(new THREE.BoxGeometry(4.8, .25, 2.1).translate(-.8, 2.42, 0), new THREE.MeshStandardMaterial({ color: 0xd9d4ce, roughness: .4 }))
  boat.add(roof)
  const nav = new THREE.Mesh(new THREE.SphereGeometry(.14, 8, 6).translate(-.6, 3.1, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.5, 2.4, 2.2) }))
  boat.add(nav)
  return boat
}
