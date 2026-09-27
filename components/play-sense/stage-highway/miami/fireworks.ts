import * as THREE from 'three'
import { createHitFx } from './fx'

const PALETTE = [[1.7, .55, 1.1], [.3, 1.3, 1.5], [1.7, 1.05, .35], [1.1, .5, 1.7], [1.6, .35, .4], [1.5, 1.35, 1.1]].map(c => new THREE.Color(...c))

interface Shell { at: number; x: number; y: number; z: number; color: THREE.Color; accent: THREE.Color; size: number; style: 'peony' | 'willow' | 'ring' }

/**
 * Fireworks over the bay for combo milestones, built on the same GPU streak
 * renderer as the hit effects but with air drag and slow gravity: a rising
 * rocket trail, a flash at the break, then a shell of coloured streaks that
 * droop and fade. Nothing is simulated per particle on the CPU.
 */
export function createFireworks() {
  const fx = createHitFx(2600, 24, { drag: 1.15, gravity: 6, trail: .2, hot: .1 })
  const pending: Shell[] = []
  let seed = 3 + Math.floor(Math.random() * 100000)
  const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
  const pick = () => PALETTE[Math.floor(random() * PALETTE.length)]

  const burst = (shell: Shell) => {
    const { x, y, z, size } = shell
    fx.flare(1, x, y, z, shell.color, 11 * size, .35)
    const count = shell.style === 'ring' ? 90 : 150
    const axis = new THREE.Vector3(random() - .5, 1, random() - .5).normalize()
    const basisA = new THREE.Vector3().crossVectors(axis, new THREE.Vector3(1, 0, 0)).normalize()
    const basisB = new THREE.Vector3().crossVectors(axis, basisA)
    for (let i = 0; i < count; i++) {
      let dx: number, dy: number, dz: number
      if (shell.style === 'ring') {
        const a = i / count * Math.PI * 2
        dx = basisA.x * Math.cos(a) + basisB.x * Math.sin(a); dy = basisA.y * Math.cos(a) + basisB.y * Math.sin(a); dz = basisA.z * Math.cos(a) + basisB.z * Math.sin(a)
      } else {
        const u = random() * 2 - 1, a = random() * Math.PI * 2, s = Math.sqrt(1 - u * u)
        dx = Math.cos(a) * s; dy = u; dz = Math.sin(a) * s
      }
      const speed = (shell.style === 'willow' ? 20 : 29) * size * (.85 + random() * .3)
      const color = i % 4 === 0 ? shell.accent : shell.color
      const life = shell.style === 'willow' ? 2.6 + random() * .8 : 1.5 + random() * .7
      fx.spark(x, y, z, dx * speed, dy * speed, dz * speed, color, life, (shell.style === 'willow' ? .7 : .9) * size, shell.style === 'willow' ? 1.4 : .8)
    }
    fx.commit()
  }

  return {
    meshes: fx.meshes,
    launch(count: number) {
      for (let n = 0; n < count; n++) {
        const x = (n - (count - 1) / 2) * 48 + (random() - .5) * 40, z = -140 - random() * 45, apex = 27 + random() * 13
        const rise = 1 + random() * .3 + n * .35
        const start = fx.time.value
        // Rocket: one slow streak climbing to the break point, with a faint shimmer trail.
        // With drag, reaching the apex at `rise` seconds needs this launch speed.
        const climb = (apex + 4) * 1.15 / (1 - Math.exp(-1.15 * rise))
        fx.spark(x, -4, z, 0, climb, 0, new THREE.Color(1.4, 1, .6), rise, .45, 0)
        for (let k = 0; k < 6; k++) fx.spark(x, -4 + k * 1.5, z, (random() - .5) * .8, climb * (.75 - k * .05), 0, new THREE.Color(1, .7, .4), rise * .85, .22, .15)
        const style: Shell['style'] = random() < .2 ? 'ring' : random() < .45 ? 'willow' : 'peony'
        pending.push({ at: start + rise, x, y: apex, z, color: pick(), accent: pick(), size: .8 + random() * .45, style })
      }
      fx.commit()
    },
    update(dt: number) {
      fx.update(dt)
      for (let i = pending.length - 1; i >= 0; i--) {
        if (fx.time.value < pending[i].at) continue
        burst(pending[i]); pending.splice(i, 1)
      }
    },
    reset() { pending.length = 0; fx.reset() },
  }
}
