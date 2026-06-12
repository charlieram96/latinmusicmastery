// components/play-sense/glass-highway/Effects.ts
//
// Hit choreography particles, all pooled:
//   PERFECT — violent drumhead-water splash: crown of droplets ejected upward
//             with gravity arcs, a hot white flash, rising mist. No ring.
//   GOOD/OK — the note cracks into chunks that tumble down and fade.
//   MISS    — elliptical surface ripple + red glow seeping under the glass
//             (the note's own refract/shake/sink lives in NoteField).
// Plus pooled floating grade text.

import { Container, Graphics, Sprite, Text, TextStyle } from 'pixi.js'
import type { HitGrade } from '@/lib/play-sense/types'
import type { GlassStyle } from './style'
import type { TextureBank } from './textures'
import { FONT_DISPLAY, GRADE_COLORS_HEX, GRADE_LABELS, MISS_RED, NOTE_HOT_TOP } from './constants'

interface Particle {
  sprite: Sprite
  x: number
  y: number
  vx: number
  vy: number
  rot: number
  rotSpeed: number
  life: number
  maxLife: number
  size: number
  gravity: number
  active: boolean
}

interface Ripple {
  gfx: Graphics
  x: number
  life: number
  maxLife: number
  delay: number
  active: boolean
}

interface FloatingText {
  text: Text
  grade: HitGrade
  life: number
  maxLife: number
  baseY: number
  active: boolean
}

function makePool<T>(count: number, make: () => T): T[] {
  return Array.from({ length: count }, make)
}

export class Effects {
  /** Above-glass effects (droplets, chunks, flash, mist, text). */
  readonly container = new Container()
  /** Under-glass effects (red seep) — layered with the reflections. */
  readonly underGlassContainer = new Container()

  private droplets: Particle[]
  private chunks: Particle[]
  private mists: Particle[]
  private flashes: Particle[]
  private seeps: Particle[]
  private ripples: Ripple[]
  private texts: FloatingText[]

  private textures: TextureBank
  private style: GlassStyle
  private hitY = 0

  constructor(textures: TextureBank, style: GlassStyle) {
    this.textures = textures
    this.style = style

    const makeParticle = (parent: Container): Particle => {
      const sprite = new Sprite()
      sprite.visible = false
      sprite.anchor.set(0.5)
      parent.addChild(sprite)
      return { sprite, x: 0, y: 0, vx: 0, vy: 0, rot: 0, rotSpeed: 0, life: 0, maxLife: 1, size: 1, gravity: 0, active: false }
    }

    this.droplets = makePool(64, () => makeParticle(this.container))
    this.chunks = makePool(24, () => makeParticle(this.container))
    this.mists = makePool(12, () => makeParticle(this.container))
    this.flashes = makePool(6, () => makeParticle(this.container))
    this.seeps = makePool(4, () => makeParticle(this.underGlassContainer))

    this.ripples = makePool(6, () => {
      const gfx = new Graphics()
      gfx.visible = false
      this.container.addChild(gfx)
      return { gfx, x: 0, life: 0, maxLife: 1, delay: 0, active: false }
    })

    // Grade texts are fully static (fixed string + style per grade) — Pixi's
    // text-texture refcounting breaks if live Text styles/content are mutated,
    // so we pool 3 instances per grade instead of restyling shared ones.
    this.texts = []
    const grades: HitGrade[] = ['perfect', 'good', 'ok', 'miss']
    for (const grade of grades) {
      for (let i = 0; i < 3; i++) {
        const text = new Text({
          text: GRADE_LABELS[grade],
          style: new TextStyle({
            fontFamily: FONT_DISPLAY,
            fontSize: grade === 'perfect' ? 17 : 14,
            fontWeight: '800',
            letterSpacing: 3,
            fill: GRADE_COLORS_HEX[grade],
          }),
        })
        text.visible = false
        text.anchor.set(0.5)
        this.container.addChild(text)
        this.texts.push({ text, grade, life: 0, maxLife: 1, baseY: 0, active: false })
      }
    }
  }

  setStyle(style: GlassStyle) {
    this.style = style
  }

  resize(hitY: number) {
    this.hitY = hitY
  }

  /** Hit at (x = lane center). Grade decides the choreography. */
  triggerHit(x: number, grade: HitGrade, color: number) {
    if (grade === 'perfect') {
      this.spawnSplash(x, color)
      this.spawnFlash(x, 1)
      this.spawnMist(x)
    } else if (grade === 'good' || grade === 'ok') {
      this.spawnChunks(x, color, grade === 'good' ? this.style.chunkCount : 2)
      this.spawnFlash(x, 0.45)
    }
    this.spawnText(x, grade)
  }

  /** A missed note just broke through the glass at x. */
  triggerMissCross(x: number) {
    this.spawnRipples(x)
    this.spawnSeep(x)
    this.spawnText(x, 'miss')
  }

  // ── spawners ──

  private spawnSplash(x: number, color: number) {
    const count = Math.round(this.style.splashDropletCount)
    const speed = this.style.splashSpeed
    let spawned = 0
    for (const p of this.droplets) {
      if (p.active) continue
      // Crown fan: angles biased upward, ±55° from vertical
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * (Math.PI * 0.61)
      const v = speed * (0.45 + Math.random() * 0.75)
      p.active = true
      p.sprite.texture = this.textures.droplet()
      p.sprite.tint = Math.random() < 0.4 ? NOTE_HOT_TOP : color
      p.sprite.blendMode = 'add'
      p.x = x + (Math.random() - 0.5) * 14
      p.y = this.hitY - 2
      p.vx = Math.cos(angle) * v
      p.vy = Math.sin(angle) * v
      p.gravity = this.style.splashGravity
      p.life = 0
      p.maxLife = 0.55 + Math.random() * 0.3
      p.size = 4 + Math.random() * 7
      p.rot = 0
      p.rotSpeed = 0
      if (++spawned >= count) break
    }
  }

  private spawnChunks(x: number, color: number, count: number) {
    let spawned = 0
    for (const p of this.chunks) {
      if (p.active) continue
      const dir = spawned % 2 === 0 ? -1 : 1
      p.active = true
      p.sprite.texture = this.textures.chunk(spawned)
      p.sprite.tint = color
      p.sprite.blendMode = 'normal'
      p.x = x + dir * (4 + Math.random() * 8)
      p.y = this.hitY - 4
      p.vx = dir * this.style.chunkSpeed * (0.5 + Math.random() * 0.8)
      p.vy = -40 - Math.random() * 60
      p.gravity = 900
      p.life = 0
      p.maxLife = 0.5 + Math.random() * 0.2
      p.size = 10 + Math.random() * 8
      p.rot = Math.random() * Math.PI
      p.rotSpeed = dir * (3 + Math.random() * 5)
      if (++spawned >= count) break
    }
  }

  private spawnMist(x: number) {
    let spawned = 0
    for (const p of this.mists) {
      if (p.active) continue
      p.active = true
      p.sprite.texture = this.textures.mist()
      p.sprite.tint = NOTE_HOT_TOP
      p.sprite.blendMode = 'add'
      p.x = x + (Math.random() - 0.5) * 30
      p.y = this.hitY - 8
      p.vx = (Math.random() - 0.5) * 20
      p.vy = -45 - Math.random() * 30
      p.gravity = -60 // mist accelerates gently upward
      p.life = 0
      p.maxLife = 0.7 + Math.random() * 0.25
      p.size = 40 + Math.random() * 30
      p.rot = 0
      p.rotSpeed = 0
      if (++spawned >= 3) break
    }
  }

  private spawnFlash(x: number, intensity: number) {
    for (const p of this.flashes) {
      if (p.active) continue
      p.active = true
      p.sprite.texture = this.textures.flash()
      p.sprite.tint = 0xffffff
      p.sprite.blendMode = 'add'
      p.x = x
      p.y = this.hitY
      p.vx = 0
      p.vy = 0
      p.gravity = 0
      p.life = 0
      p.maxLife = 0.16
      p.size = (90 + 60 * intensity) * intensity
      p.rot = 0
      p.rotSpeed = 0
      break
    }
  }

  private spawnSeep(x: number) {
    for (const p of this.seeps) {
      if (p.active) continue
      p.active = true
      p.sprite.texture = this.textures.glowDot()
      p.sprite.tint = MISS_RED
      p.sprite.blendMode = 'add'
      p.x = x
      p.y = this.hitY + 26
      p.vx = 0
      p.vy = 18
      p.gravity = 0
      p.life = 0
      p.maxLife = 0.9
      p.size = 110
      p.rot = 0
      p.rotSpeed = 0
      break
    }
  }

  private spawnRipples(x: number) {
    let spawned = 0
    for (const r of this.ripples) {
      if (r.active) continue
      r.active = true
      r.x = x
      r.life = 0
      r.maxLife = 0.6
      r.delay = spawned * 0.12
      if (++spawned >= 2) break
    }
  }

  private spawnText(x: number, grade: HitGrade) {
    for (const t of this.texts) {
      if (t.active || t.grade !== grade) continue
      t.active = true
      t.text.visible = true
      t.text.position.set(x, this.hitY - 34)
      t.baseY = this.hitY - 34
      t.life = 0
      t.maxLife = grade === 'perfect' ? 0.8 : 0.65
      break
    }
  }

  // ── frame update ──

  update(dtSec: number) {
    this.updateParticles(this.droplets, dtSec, true)
    this.updateParticles(this.chunks, dtSec, false)
    this.updateParticles(this.mists, dtSec, true)
    this.updateParticles(this.flashes, dtSec, false, true)
    this.updateParticles(this.seeps, dtSec, false, false, this.style.redGlowAlpha)
    this.updateRipples(dtSec)
    this.updateTexts(dtSec)
  }

  private updateParticles(pool: Particle[], dt: number, shrink: boolean, isFlash = false, alphaScale = 1) {
    for (const p of pool) {
      if (!p.active) {
        p.sprite.visible = false
        continue
      }
      p.life += dt
      if (p.life >= p.maxLife) {
        p.active = false
        p.sprite.visible = false
        continue
      }
      p.vy += p.gravity * dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.rot += p.rotSpeed * dt

      const t = p.life / p.maxLife
      const fade = 1 - t * t // quadratic fade-out
      const sprite = p.sprite
      sprite.visible = true
      sprite.position.set(p.x, p.y)
      sprite.rotation = p.rot
      const scale = isFlash
        ? p.size * (0.55 + t * 1.1) // flash expands as it dies
        : p.size * (shrink ? 1 - t * 0.5 : 1)
      sprite.width = scale
      sprite.height = isFlash ? scale * 0.32 : scale
      if (isFlash) {
        sprite.alpha = this.style.flashAlpha * fade
      } else {
        sprite.alpha = fade * alphaScale
      }
    }
  }

  private updateRipples(dt: number) {
    for (const r of this.ripples) {
      if (!r.active) {
        r.gfx.visible = false
        continue
      }
      if (r.delay > 0) {
        r.delay -= dt
        r.gfx.visible = false
        continue
      }
      r.life += dt
      if (r.life >= r.maxLife) {
        r.active = false
        r.gfx.visible = false
        continue
      }
      const t = r.life / r.maxLife
      const rx = 14 + t * 52
      const ry = (14 + t * 52) * 0.22
      r.gfx.clear()
      r.gfx.ellipse(r.x, this.hitY, rx, ry)
      r.gfx.stroke({ color: 0xfff6e6, width: 1.5, alpha: 1 })
      r.gfx.visible = true
      r.gfx.alpha = this.style.rippleAlpha * (1 - t)
    }
  }

  private updateTexts(dt: number) {
    for (const ft of this.texts) {
      if (!ft.active) {
        ft.text.visible = false
        continue
      }
      ft.life += dt
      if (ft.life >= ft.maxLife) {
        ft.active = false
        ft.text.visible = false
        continue
      }
      const t = ft.life / ft.maxLife
      // quick pop in, drift up, fade out
      const pop = t < 0.18 ? 0.7 + (t / 0.18) * 0.45 : 1.15 - (t - 0.18) * 0.15
      ft.text.scale.set(pop)
      ft.text.y = ft.baseY - t * 40
      ft.text.alpha = t < 0.15 ? t / 0.15 : 1 - Math.max(0, (t - 0.45) / 0.55)
    }
  }

  destroy() {
    this.container.destroy({ children: true })
    this.underGlassContainer.destroy({ children: true })
  }
}
