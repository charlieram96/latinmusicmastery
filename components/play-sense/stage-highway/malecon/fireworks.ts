import * as THREE from 'three'

const PALETTE = [[1.6, .78, .16], [1.5, .22, .7], [.2, 1.3, 1.15], [1.5, 1.25, .9], [.8, .45, 1.6], [1.6, .3, .22]].map(c => new THREE.Color(...c))

interface Rocket { active: boolean; x: number; y: number; z: number; vy: number; targetY: number; color: THREE.Color; size: number }

/**
 * Fireworks over the bay for combo milestones. A fixed pool of points is updated
 * on the CPU (a few thousand floats per frame); nothing is allocated while playing.
 */
export function createFireworks(capacity = 1400) {
  const positions = new Float32Array(capacity * 3)
  const colors = new Float32Array(capacity * 3)
  const life = new Float32Array(capacity)
  const velocity = new Float32Array(capacity * 3)
  const maxLife = new Float32Array(capacity)
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage))
  geometry.setAttribute('psColor', new THREE.BufferAttribute(colors, 3).setUsage(THREE.DynamicDrawUsage))
  geometry.setAttribute('psLife', new THREE.BufferAttribute(life, 1).setUsage(THREE.DynamicDrawUsage))
  const material = new THREE.ShaderMaterial({
    uniforms: { psScale: { value: 1250 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    vertexShader: /* glsl */ `
      attribute vec3 psColor; attribute float psLife;
      uniform float psScale;
      varying vec3 vColor; varying float vLife;
      void main() {
        vec4 view = modelViewMatrix * vec4(position, 1.);
        vColor = psColor; vLife = psLife;
        gl_PointSize = psLife > 0. ? psScale * (.9 + psLife * .6) / -view.z : 0.;
        gl_Position = projectionMatrix * view;
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vColor; varying float vLife;
      void main() {
        float r = length(gl_PointCoord - .5) * 2.;
        float a = (exp(-r * r * 14.) + exp(-r * r * 3.) * .25) * smoothstep(0., .25, vLife);
        // Embers crackle as they fade.
        a *= vLife < .3 ? step(.4, fract(sin(dot(gl_FragCoord.xy, vec2(12.9, 78.2))) * 43758.5)) : 1.;
        gl_FragColor = vec4(vColor * a * (.5 + vLife * .9), 1.);
      }`,
  })
  const points = new THREE.Points(geometry, material)
  points.frustumCulled = false
  const rockets: Rocket[] = Array.from({ length: 6 }, () => ({ active: false, x: 0, y: 0, z: 0, vy: 0, targetY: 0, color: PALETTE[0], size: 1 }))
  let cursor = 0, seed = 1
  const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }

  const emit = (x: number, y: number, z: number, vx: number, vy: number, vz: number, color: THREE.Color, ttl: number) => {
    const i = cursor++ % capacity
    positions.set([x, y, z], i * 3); velocity.set([vx, vy, vz], i * 3)
    colors.set([color.r, color.g, color.b], i * 3)
    life[i] = 1; maxLife[i] = ttl
  }
  const burst = (rocket: Rocket) => {
    const count = Math.round(150 * rocket.size)
    const twoTone = random() > .5 ? PALETTE[Math.floor(random() * PALETTE.length)] : rocket.color
    for (let i = 0; i < count; i++) {
      const u = random() * 2 - 1, a = random() * Math.PI * 2, s = Math.sqrt(1 - u * u)
      const speed = (22 + random() * 4) * rocket.size
      emit(rocket.x, rocket.y, rocket.z, Math.cos(a) * s * speed, u * speed + 3, Math.sin(a) * s * speed, i % 3 ? rocket.color : twoTone, 1.9 + random() * .9)
    }
  }
  return {
    points,
    launch(count: number) {
      for (let n = 0; n < count; n++) {
        const rocket = rockets.find(r => !r.active)
        if (!rocket) return
        Object.assign(rocket, {
          active: true, x: (random() - .5) * 150, y: -4, z: -170 - random() * 60,
          vy: 70 + random() * 12, targetY: 30 + random() * 16, color: PALETTE[Math.floor(random() * PALETTE.length)], size: .8 + random() * .5,
        })
        rocket.y -= n * 14
      }
    },
    update(dt: number) {
      for (const rocket of rockets) {
        if (!rocket.active) continue
        rocket.y += rocket.vy * dt
        if (rocket.y > -4) emit(rocket.x, rocket.y, rocket.z, 0, -4, 0, rocket.color, .45)
        if (rocket.y >= rocket.targetY) { rocket.active = false; burst(rocket) }
      }
      let alive = false
      for (let i = 0; i < capacity; i++) {
        if (life[i] <= 0) continue
        alive = true
        life[i] = Math.max(0, life[i] - dt / maxLife[i])
        const drag = Math.pow(.25, dt)
        velocity[i * 3] *= drag; velocity[i * 3 + 1] = velocity[i * 3 + 1] * drag - 9 * dt; velocity[i * 3 + 2] *= drag
        positions[i * 3] += velocity[i * 3] * dt; positions[i * 3 + 1] += velocity[i * 3 + 1] * dt; positions[i * 3 + 2] += velocity[i * 3 + 2] * dt
      }
      points.visible = alive || rockets.some(r => r.active)
      if (!points.visible) return
      for (const name of ['position', 'psColor', 'psLife']) geometry.getAttribute(name).needsUpdate = true
    },
    reset() { life.fill(0); rockets.forEach(r => { r.active = false }) },
  }
}
