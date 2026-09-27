import * as THREE from 'three'
import type { HitGrade } from '@/lib/play-sense/types'

const QUAD = [-1, 0, 0, 1, 0, 0, 1, 1, 0, -1, 1, 0]

function instanced(count: number, attributes: Record<string, number>) {
  const geometry = new THREE.InstancedBufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(QUAD, 3))
  geometry.setIndex([0, 1, 2, 0, 2, 3])
  const arrays: Record<string, Float32Array> = {}
  for (const [name, size] of Object.entries(attributes)) {
    arrays[name] = new Float32Array(count * size)
    // Unborn instances sit far in the past so they never draw.
    if (name === 'psBirth') arrays[name].fill(-1e5)
    geometry.setAttribute(name, new THREE.InstancedBufferAttribute(arrays[name], size).setUsage(THREE.DynamicDrawUsage))
  }
  geometry.instanceCount = count
  return { geometry, arrays }
}

/**
 * Hit effects animated entirely on the GPU from each instance's birth time:
 * velocity-stretched sparks with drag and gravity (white-hot, cooling to the
 * lane colour), rising embers, a flat shockwave on the deck, an impact flash and
 * a light beam over the drum. Spawning writes a few attributes; nothing runs per
 * particle on the CPU.
 */
export function createHitFx(sparkCapacity = 1400, flareCapacity = 96, physics: { drag: number; gravity: number; trail: number; hot?: number } = { drag: 3.2, gravity: 9.5, trail: .075 }) {
  const time = { value: 0 }
  const sparks = instanced(sparkCapacity, { psOrigin: 3, psVelocity: 3, psColor: 3, psBirth: 1, psLife: 1, psSize: 1, psLift: 1 })
  const sparkMaterial = new THREE.ShaderMaterial({
    uniforms: { psTime: time },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    // Streak quads follow each spark's screen direction, so their winding varies.
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      attribute vec3 psOrigin; attribute vec3 psVelocity; attribute vec3 psColor;
      attribute float psBirth; attribute float psLife; attribute float psSize; attribute float psLift;
      uniform float psTime;
      varying vec3 vColor; varying float vAcross; varying float vAlong; varying float vFade;
      const float DRAG = ${physics.drag.toFixed(3)};
      vec3 at(float t) {
        float travel = (1. - exp(-DRAG * t)) / DRAG;
        return psOrigin + psVelocity * travel + vec3(0., -${physics.gravity.toFixed(3)} * psLift * .5 * t * t, 0.);
      }
      void main() {
        float age = psTime - psBirth;
        if (age < 0. || age > psLife) { gl_Position = vec4(2., 2., 2., 1.); return; }
        float life = age / psLife;
        vec4 head = viewMatrix * vec4(at(age), 1.);
        vec4 tail = viewMatrix * vec4(at(max(0., age - ${physics.trail.toFixed(3)})), 1.);
        vec2 dir = head.xy - tail.xy;
        float len = length(dir);
        dir = len > 1e-4 ? dir / len : vec2(0., 1.);
        vec2 across = vec2(-dir.y, dir.x);
        float width = psSize * (1. - life * .6);
        vec4 p = mix(tail, head, position.y);
        p.xy += across * position.x * width + dir * (position.y - .5) * width * 1.5;
        vAcross = position.x; vAlong = position.y;
        vColor = mix(vec3(1.5, 1.42, 1.3), psColor, smoothstep(.0, ${(physics.hot ?? .2).toFixed(3)}, life));
        vFade = (1. - smoothstep(.55, 1., life)) * smoothstep(0., .04, age);
        gl_Position = projectionMatrix * p;
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vColor; varying float vAcross; varying float vAlong; varying float vFade;
      void main() {
        float core = exp(-vAcross * vAcross * 5.) * (.35 + .65 * vAlong);
        gl_FragColor = vec4(vColor * core * vFade * 2.1, 1.);
      }`,
  })
  const sparkMesh = new THREE.Mesh(sparks.geometry, sparkMaterial)
  sparkMesh.frustumCulled = false; sparkMesh.renderOrder = 5

  // Flares: 0 = shockwave on the deck, 1 = impact flash, 2 = beam of light.
  const flares = instanced(flareCapacity, { psOrigin: 3, psColor: 3, psBirth: 1, psLife: 1, psSize: 1, psKind: 1 })
  flares.geometry.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3))
  const flareMaterial = new THREE.ShaderMaterial({
    uniforms: { psTime: time },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      attribute vec3 psOrigin; attribute vec3 psColor; attribute float psBirth; attribute float psLife; attribute float psSize; attribute float psKind;
      uniform float psTime;
      varying vec2 vUv; varying vec3 vColor; varying float vLife; varying float vKind;
      void main() {
        float age = psTime - psBirth;
        if (age < 0. || age > psLife) { gl_Position = vec4(2., 2., 2., 1.); return; }
        vLife = age / psLife; vUv = position.xy; vColor = psColor; vKind = psKind;
        if (psKind < .5) {
          // Shockwave: a flat quad on the deck that grows with an ease-out.
          float grow = 1. - pow(max(0., 1. - vLife), 3.);
          vec3 world = psOrigin + vec3(position.x, 0., position.y) * psSize * (.25 + grow);
          gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.);
        } else if (psKind < 1.5) {
          vec4 center = viewMatrix * vec4(psOrigin, 1.);
          center.xy += position.xy * psSize * (.6 + vLife * .8);
          gl_Position = projectionMatrix * center;
        } else {
          // Beam: stands vertically, turned toward the camera around its own axis.
          vec3 toCamera = normalize(vec3(cameraPosition.x - psOrigin.x, 0., cameraPosition.z - psOrigin.z));
          vec3 side = normalize(cross(vec3(0., 1., 0.), toCamera));
          vec3 world = psOrigin + side * position.x * psSize * (1. - vLife * .5) + vec3(0., (position.y * .5 + .5) * psSize * 7., 0.);
          gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.);
        }
      }`,
    fragmentShader: /* glsl */ `
      varying vec2 vUv; varying vec3 vColor; varying float vLife; varying float vKind;
      void main() {
        float fade = 1. - vLife;
        float a;
        if (vKind < .5) {
          float r = length(vUv);
          float front = .82;
          float thin = (r - front) / .07, wide = (r - front) / .22;
          a = exp(-thin * thin) * 1.2 + exp(-wide * wide) * .35 + (1. - smoothstep(0., front, r)) * .12;
          a *= fade * fade * step(r, 1.);
        } else if (vKind < 1.5) {
          float r = length(vUv);
          a = (exp(-r * r * 10.) * .9 + exp(-r * 3.5) * .15) * pow(max(0., fade), 2.5);
        } else {
          float y = vUv.y * .5 + .5;
          a = exp(-vUv.x * vUv.x * 14.) * pow(max(0., 1. - y), 1.6) * smoothstep(0., .08, y) * pow(max(0., fade), 1.8) * 1.3;
        }
        gl_FragColor = vec4(mix(vColor, vec3(1.4, 1.35, 1.25), vKind > .5 && vKind < 1.5 ? .25 : .1) * a, 1.);
      }`,
  })
  const flareMesh = new THREE.Mesh(flares.geometry, flareMaterial)
  flareMesh.frustumCulled = false; flareMesh.renderOrder = 4

  let sparkCursor = 0, flareCursor = 0, seed = 7
  const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
  const sparkAttributes = ['psOrigin', 'psVelocity', 'psColor', 'psBirth', 'psLife', 'psSize', 'psLift']
  const flareAttributes = ['psOrigin', 'psColor', 'psBirth', 'psLife', 'psSize', 'psKind']
  const flag = (geometry: THREE.InstancedBufferGeometry, names: string[]) => names.forEach(name => { geometry.getAttribute(name).needsUpdate = true })

  const spark = (x: number, y: number, z: number, vx: number, vy: number, vz: number, color: THREE.Color, life: number, size: number, lift: number) => {
    const i = sparkCursor++ % sparkCapacity, a = sparks.arrays
    a.psOrigin.set([x, y, z], i * 3); a.psVelocity.set([vx, vy, vz], i * 3); a.psColor.set([color.r, color.g, color.b], i * 3)
    a.psBirth[i] = time.value; a.psLife[i] = life; a.psSize[i] = size; a.psLift[i] = lift
  }
  const flare = (kind: number, x: number, y: number, z: number, color: THREE.Color, size: number, life: number) => {
    const i = flareCursor++ % flareCapacity, a = flares.arrays
    a.psOrigin.set([x, y, z], i * 3); a.psColor.set([color.r, color.g, color.b], i * 3)
    a.psBirth[i] = time.value; a.psLife[i] = life; a.psSize[i] = size; a.psKind[i] = kind
  }
  const tint = new THREE.Color(), ember = new THREE.Color()

  return {
    meshes: [flareMesh, sparkMesh],
    /** Raw emitters for composed effects such as fireworks; call `commit` after a batch. */
    spark, flare, time,
    commit() { flag(sparks.geometry, sparkAttributes); flag(flares.geometry, flareAttributes) },
    burst(x: number, y: number, z: number, color: THREE.Color, strength: HitGrade, scale = 1) {
      if (strength === 'miss') {
        tint.setRGB(.9, .22, .3)
        flare(0, x, y + .01, z, tint, 1.3 * scale, .45)
        flag(flares.geometry, flareAttributes)
        return
      }
      const power = strength === 'perfect' ? 1 : strength === 'good' ? .7 : .45
      tint.copy(color).multiplyScalar(1.25)
      flare(0, x, y + .01, z, tint, 2.3 * scale * (.75 + power * .45), .6)
      if (strength === 'perfect') flare(0, x, y + .015, z, ember.copy(color).lerp(new THREE.Color(1, 1, 1), .5), 1.6 * scale, .35)
      flare(1, x, y + .4, z + .15, tint, 1.25 * scale * (.6 + power * .5), .2)
      flare(2, x, y, z, tint, .7 * scale * (.6 + power * .5), .42 + power * .18)
      const count = Math.round(16 + power * 30)
      for (let i = 0; i < count; i++) {
        const a = random() * Math.PI * 2, up = .35 + random() * .65
        const speed = (3.5 + random() * 5) * (.7 + power * .4) * Math.max(.55, scale)
        spark(x, y + .12, z, Math.cos(a) * speed * (1 - up * .5) * .8, up * speed * 1.2, Math.sin(a) * speed * .5, color, .35 + random() * .35, (.04 + random() * .035) * Math.max(.6, scale), 1.3)
      }
      if (strength === 'perfect') for (let i = 0; i < 16; i++) {
        ember.copy(color).lerp(new THREE.Color(1, .85, .6), .35)
        spark(x + (random() - .5) * 1.2 * scale, y + .2, z + (random() - .5) * .6, (random() - .5) * .6, 1.2 + random() * 1.6, (random() - .5) * .3, ember, 1.2 + random() * .8, .055, -.04)
      }
      flag(sparks.geometry, sparkAttributes); flag(flares.geometry, flareAttributes)
    },
    update(dt: number) { time.value += dt },
    reset() {
      sparks.arrays.psBirth.fill(-1e5); flares.arrays.psBirth.fill(-1e5)
      flag(sparks.geometry, ['psBirth']); flag(flares.geometry, ['psBirth'])
    },
  }
}
