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
} from './constants'
import type { Highway } from './Highway'

interface ShardParticle {
  gfx: Graphics
  x: number
  y: number
  vx: number
  vy: number
  rotation: number
  rotSpeed: number
  life: number
  maxLife: number
  color: number
  size: number
  active: boolean
}

interface FloatingText {
  text: Text
  vy: number
  life: number
  maxLife: number
  active: boolean
}

interface DrumFlash {
  gfx: Graphics
  life: number
  active: boolean
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
 * Visual effects: shatter/break on hit, floating grade text, drum flash,
 * and combo fire embers. Notes breaking into shards on hit is the primary effect.
 */
export class HitEffects {
  readonly container = new Container()

  private shards: ShardParticle[] = []
  private floatingTexts: FloatingText[] = []
  private drumFlashes: DrumFlash[] = []
  private embers: Ember[] = []
  private highway: Highway
  private laneCount = 3
  private width = 0
  private height = 0

  constructor(highway: Highway) {
    this.highway = highway

    // Pre-allocate shards (more for impressive break effect)
    for (let i = 0; i < 80; i++) {
      const gfx = new Graphics()
      gfx.visible = false
      this.container.addChild(gfx)
      this.shards.push({
        gfx, x: 0, y: 0, vx: 0, vy: 0, rotation: 0, rotSpeed: 0,
        life: 0, maxLife: 0, color: 0, size: 0, active: false,
      })
    }

    // Floating texts
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

    // Drum flashes (glow on the conga when hit)
    for (let i = 0; i < 6; i++) {
      const gfx = new Graphics()
      gfx.visible = false
      this.container.addChild(gfx)
      this.drumFlashes.push({ gfx, life: 0, active: false })
    }

    // Embers
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

  /** Trigger break/shatter effect when a note is hit */
  triggerHit(laneIndex: number, grade: HitGrade, noteColor: number) {
    const hitY = this.highway.getHitZoneY()
    const x = this.highway.getLaneX(laneIndex, hitY)

    if (grade !== 'miss') {
      // Shatter the note into shards
      this.spawnShards(x, hitY, grade, noteColor)
      // Flash the conga drum
      this.spawnDrumFlash(x, hitY, grade)
    }

    // Floating grade text
    this.spawnGradeText(x, hitY - 40, grade)
  }

  /** Spawn combo fire embers along the rails */
  updateComboFire(combo: number) {
    if (combo < COMBO_FIRE_THRESHOLD) return
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

  /** Update all active effects each frame */
  update(dt: number) {
    // Shards
    for (const s of this.shards) {
      if (!s.active) continue
      s.life -= dt
      if (s.life <= 0) {
        s.active = false
        s.gfx.visible = false
        continue
      }

      s.x += s.vx * dt * 60
      s.y += s.vy * dt * 60
      s.vy += 0.15 // gravity
      s.rotation += s.rotSpeed * dt * 60

      const progress = 1 - s.life / s.maxLife
      const alpha = 1 - progress * progress // quadratic fade

      s.gfx.clear()
      // Draw shard as a small oval fragment
      const sz = s.size * (1 - progress * 0.5)
      s.gfx.ellipse(0, 0, sz, sz * 0.6)
      s.gfx.fill({ color: s.color, alpha: alpha * 0.8 })
      // Shard glow
      s.gfx.ellipse(0, 0, sz + 2, sz * 0.6 + 1)
      s.gfx.fill({ color: s.color, alpha: alpha * 0.2 })

      s.gfx.x = s.x
      s.gfx.y = s.y
      s.gfx.rotation = s.rotation
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
      if (progress < 0.15) {
        ft.text.alpha = progress / 0.15
      } else if (progress > 0.6) {
        ft.text.alpha = (1 - progress) / 0.4
      } else {
        ft.text.alpha = 1
      }
      ft.text.scale.set(1 + Math.sin(progress * Math.PI) * 0.1)
    }

    // Drum flashes
    for (const df of this.drumFlashes) {
      if (!df.active) continue
      df.life -= dt
      if (df.life <= 0) {
        df.active = false
        df.gfx.visible = false
        continue
      }
      df.gfx.alpha = df.life / 0.25
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

  /** Spawn oval-shaped shards that fly outward like the note shattered */
  private spawnShards(x: number, y: number, grade: HitGrade, noteColor: number) {
    const count = PARTICLE_COUNTS[grade]
    const gradeColor = GRADE_COLORS_HEX[grade]

    for (let i = 0; i < count; i++) {
      const s = this.shards.find(s => !s.active)
      if (!s) break

      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.6
      const speed = 2.5 + Math.random() * 4

      s.active = true
      s.x = x + (Math.random() - 0.5) * 10
      s.y = y + (Math.random() - 0.5) * 6
      s.vx = Math.cos(angle) * speed
      s.vy = Math.sin(angle) * speed - 2 // strong upward bias
      s.rotation = Math.random() * Math.PI * 2
      s.rotSpeed = (Math.random() - 0.5) * 0.3
      s.life = PARTICLE_LIFETIME_SEC + Math.random() * 0.3
      s.maxLife = s.life
      // Mix note color and grade color for variety
      s.color = i % 3 === 0 ? gradeColor : noteColor
      s.size = 3 + Math.random() * 4
      s.gfx.visible = true
    }
  }

  /** Flash the conga drum head on hit */
  private spawnDrumFlash(x: number, y: number, grade: HitGrade) {
    const df = this.drumFlashes.find(d => !d.active)
    if (!df) return

    const color = GRADE_COLORS_HEX[grade]

    df.active = true
    df.life = 0.25
    df.gfx.visible = true
    df.gfx.clear()

    // Bright oval flash on the drum head
    df.gfx.ellipse(x, y, 30, 14)
    df.gfx.fill({ color, alpha: 0.35 })
    // Wider soft glow
    df.gfx.ellipse(x, y, 42, 20)
    df.gfx.fill({ color, alpha: 0.12 })
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
}
