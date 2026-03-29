// components/play-sense/rhythm-highway/HitEffects.ts
import { Container, Graphics, Text, TextStyle } from 'pixi.js'
import type { HitGrade } from '@/lib/play-sense/types'
import {
  GRADE_COLORS_HEX,
  GRADE_LABELS,
  GRADE_POINTS_DISPLAY,
  PARTICLE_COUNTS,
  PARTICLE_LIFETIME_SEC,
  COMBO_FIRE_THRESHOLD,
  RAIL_COLOR,
  HUD_FONT_FAMILY,
  HIGHWAY_BOTTOM_WIDTH,
  HIT_ZONE_Y_FRACTION,
} from './constants'
import type { Highway } from './Highway'

interface Particle {
  gfx: Graphics
  vx: number
  vy: number
  life: number
  maxLife: number
  active: boolean
}

interface FloatingText {
  text: Text
  vy: number
  life: number
  maxLife: number
  active: boolean
}

interface ReceptorFlash {
  gfx: Graphics
  life: number
  active: boolean
  laneIndex: number
}

interface Ember {
  gfx: Graphics
  x: number
  y: number
  vy: number
  life: number
  active: boolean
}

/**
 * Visual effects layer: particle bursts, floating grade text, receptor flashes,
 * and combo fire embers. Call triggerHit() when a note is hit, and update() each frame.
 */
export class HitEffects {
  readonly container = new Container()

  private particles: Particle[] = []
  private floatingTexts: FloatingText[] = []
  private receptorFlashes: ReceptorFlash[] = []
  private embers: Ember[] = []
  private highway: Highway
  private laneCount = 3
  private width = 0
  private height = 0

  constructor(highway: Highway) {
    this.highway = highway
    // Pre-allocate particles
    for (let i = 0; i < 60; i++) {
      const gfx = new Graphics()
      gfx.visible = false
      this.container.addChild(gfx)
      this.particles.push({ gfx, vx: 0, vy: 0, life: 0, maxLife: 0, active: false })
    }
    // Pre-allocate floating texts
    for (let i = 0; i < 8; i++) {
      const text = new Text({
        text: '',
        style: new TextStyle({
          fontFamily: HUD_FONT_FAMILY,
          fontSize: 24,
          fontWeight: '900',
          fill: 0xffffff,
          letterSpacing: 3,
        }),
      })
      text.anchor.set(0.5)
      text.visible = false
      this.container.addChild(text)
      this.floatingTexts.push({ text, vy: 0, life: 0, maxLife: 0, active: false })
    }
    // Pre-allocate receptor flashes
    for (let i = 0; i < 6; i++) {
      const gfx = new Graphics()
      gfx.visible = false
      this.container.addChild(gfx)
      this.receptorFlashes.push({ gfx, life: 0, active: false, laneIndex: 0 })
    }
    // Pre-allocate embers
    for (let i = 0; i < 20; i++) {
      const gfx = new Graphics()
      gfx.visible = false
      this.container.addChild(gfx)
      this.embers.push({ gfx, x: 0, y: 0, vy: 0, life: 0, active: false })
    }
  }

  setLaneCount(count: number) {
    this.laneCount = count
  }

  resize(width: number, height: number) {
    this.width = width
    this.height = height
  }

  /** Trigger visual effects for a hit on a specific lane */
  triggerHit(laneIndex: number, grade: HitGrade) {
    const hitY = this.highway.getHitZoneY()
    const x = this.highway.getLaneX(laneIndex, hitY)

    // Particle burst
    this.spawnParticles(x, hitY, grade)

    // Floating grade text
    this.spawnGradeText(x, hitY - 30, grade)

    // Receptor flash
    this.spawnReceptorFlash(laneIndex, grade)
  }

  /** Spawn combo fire embers along the rails */
  updateComboFire(combo: number) {
    if (combo < COMBO_FIRE_THRESHOLD) return
    // Spawn an ember on each rail occasionally
    if (Math.random() > 0.3) return

    const hitY = this.highway.getHitZoneY()
    const cx = this.width / 2
    const halfW = (this.width * HIGHWAY_BOTTOM_WIDTH) / 2
    const side = Math.random() > 0.5 ? 1 : -1
    const x = cx + side * halfW

    const ember = this.embers.find(e => !e.active)
    if (!ember) return

    ember.active = true
    ember.x = x + (Math.random() - 0.5) * 6
    ember.y = hitY
    ember.vy = -(1 + Math.random() * 2)
    ember.life = 1.0
    ember.gfx.visible = true
  }

  /** Update all active effects. dt is delta time in seconds. */
  update(dt: number) {
    // Particles
    for (const p of this.particles) {
      if (!p.active) continue
      p.life -= dt
      if (p.life <= 0) {
        p.active = false
        p.gfx.visible = false
        continue
      }
      p.gfx.x += p.vx * dt * 60
      p.gfx.y += p.vy * dt * 60
      p.gfx.alpha = p.life / p.maxLife
    }

    // Floating texts
    for (const ft of this.floatingTexts) {
      if (!ft.active) continue
      ft.life -= dt
      if (ft.life <= 0) {
        ft.active = false
        ft.text.visible = false
        continue
      }
      ft.text.y += ft.vy * dt * 60
      const progress = 1 - ft.life / ft.maxLife
      // Fade in quickly, hold, then fade out
      if (progress < 0.15) {
        ft.text.alpha = progress / 0.15
      } else if (progress > 0.6) {
        ft.text.alpha = (1 - progress) / 0.4
      } else {
        ft.text.alpha = 1
      }
      ft.text.scale.set(1 + Math.sin(progress * Math.PI) * 0.1)
    }

    // Receptor flashes
    for (const rf of this.receptorFlashes) {
      if (!rf.active) continue
      rf.life -= dt
      if (rf.life <= 0) {
        rf.active = false
        rf.gfx.visible = false
        continue
      }
      rf.gfx.alpha = rf.life / 0.2
    }

    // Embers
    for (const e of this.embers) {
      if (!e.active) continue
      e.life -= dt
      if (e.life <= 0) {
        e.active = false
        e.gfx.visible = false
        continue
      }
      e.y += e.vy * dt * 60
      e.x += (Math.random() - 0.5) * 0.5
      e.gfx.clear()
      const size = 1.5 + e.life * 2
      e.gfx.circle(0, 0, size)
      e.gfx.fill({ color: RAIL_COLOR, alpha: e.life * 0.6 })
      e.gfx.x = e.x
      e.gfx.y = e.y
    }
  }

  // ── Private ──

  private spawnParticles(x: number, y: number, grade: HitGrade) {
    const count = PARTICLE_COUNTS[grade]
    const color = GRADE_COLORS_HEX[grade]

    for (let i = 0; i < count; i++) {
      const p = this.particles.find(p => !p.active)
      if (!p) break

      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5
      const speed = 2 + Math.random() * 3

      p.active = true
      p.vx = Math.cos(angle) * speed
      p.vy = Math.sin(angle) * speed - 1 // Bias upward
      p.life = PARTICLE_LIFETIME_SEC
      p.maxLife = PARTICLE_LIFETIME_SEC
      p.gfx.visible = true
      p.gfx.clear()
      const size = 2 + Math.random() * 2
      p.gfx.circle(0, 0, size)
      p.gfx.fill(color)
      p.gfx.x = x
      p.gfx.y = y
    }
  }

  private spawnGradeText(x: number, y: number, grade: HitGrade) {
    const ft = this.floatingTexts.find(f => !f.active)
    if (!ft) return

    const label = GRADE_LABELS[grade]
    const points = GRADE_POINTS_DISPLAY[grade]
    const displayText = points ? `${label}\n${points}` : label

    ft.active = true
    ft.text.text = displayText
    ft.text.style.fill = GRADE_COLORS_HEX[grade]
    ft.text.style.fontSize = grade === 'perfect' ? 28 : 22
    ft.text.x = x
    ft.text.y = y
    ft.text.alpha = 0
    ft.text.visible = true
    ft.vy = -1.2
    ft.life = 1.0
    ft.maxLife = 1.0
  }

  private spawnReceptorFlash(laneIndex: number, grade: HitGrade) {
    const rf = this.receptorFlashes.find(r => !r.active)
    if (!rf) return

    const hitY = this.highway.getHitZoneY()
    const x = this.highway.getLaneX(laneIndex, hitY)
    const scale = this.highway.getScaleAtDepth(1)
    const w = 50 * scale
    const h = 28 * scale
    const color = GRADE_COLORS_HEX[grade]

    rf.active = true
    rf.life = 0.2
    rf.laneIndex = laneIndex
    rf.gfx.visible = true
    rf.gfx.clear()
    rf.gfx.roundRect(-w / 2, -h / 2, w, h, 6)
    rf.gfx.fill({ color, alpha: 0.3 })
    rf.gfx.roundRect(-w / 2, -h / 2, w, h, 6)
    rf.gfx.stroke({ color, width: 2, alpha: 0.8 })
    rf.gfx.x = x
    rf.gfx.y = hitY
  }
}
