// components/play-sense/glass-highway/style.ts
//
// Every tunable visual constant for the Obsidian Glass highway lives here.
// The /highway-lab sliders bind 1:1 to this object; values are read live each
// frame so changes apply without re-initializing the app.

export interface GlassStyle {
  /** Seconds a note takes to travel from the top edge to the hit line. */
  approachSec: number
  /** Hit line position as a fraction of stage height (0..1). */
  hitLineFraction: number

  // ── Lanes / scene ──
  laneLineAlpha: number
  hitLineGlowAlpha: number
  hitLineShimmerSpeed: number
  glassSheenAlpha: number
  glareSpeed: number
  glareAlpha: number
  dustCount: number
  dustAlpha: number
  bgGlowAlpha: number

  // ── Notes ──
  /** Note pill height as a fraction of its width (clamped to sane px). */
  noteAspect: number
  noteGlowAlpha: number
  trailLength: number
  trailAlpha: number
  reflectionAlpha: number
  /** Fraction of the approach over which the reflection fades in (0..1). */
  reflectionFalloff: number

  // ── Perfect splash ──
  splashDropletCount: number
  splashSpeed: number
  splashGravity: number
  flashAlpha: number
  mistAlpha: number

  // ── Good crack ──
  chunkCount: number
  chunkSpeed: number

  // ── Miss ──
  missShakeAmp: number
  missShakeFreq: number
  missSinkAlpha: number
  rippleAlpha: number
  redGlowAlpha: number

  // ── Receptors ──
  padFillAlpha: number
  padStrokeAlpha: number
  padFlashAlpha: number
  keyLightAlpha: number
}

export const DEFAULT_GLASS_STYLE: GlassStyle = {
  approachSec: 2.6,
  hitLineFraction: 0.8,

  laneLineAlpha: 0.5,
  hitLineGlowAlpha: 0.55,
  hitLineShimmerSpeed: 2.4,
  glassSheenAlpha: 0.1,
  glareSpeed: 7,
  glareAlpha: 0.09,
  dustCount: 14,
  dustAlpha: 0.45,
  bgGlowAlpha: 0.12,

  noteAspect: 0.36,
  noteGlowAlpha: 0.7,
  trailLength: 7,
  trailAlpha: 0.5,
  reflectionAlpha: 0.22,
  reflectionFalloff: 0.45,

  splashDropletCount: 14,
  splashSpeed: 420,
  splashGravity: 1500,
  flashAlpha: 0.95,
  mistAlpha: 0.35,

  chunkCount: 4,
  chunkSpeed: 160,

  missShakeAmp: 3,
  missShakeFreq: 38,
  missSinkAlpha: 0.4,
  rippleAlpha: 0.7,
  redGlowAlpha: 0.45,

  padFillAlpha: 0.1,
  padStrokeAlpha: 0.4,
  padFlashAlpha: 0.85,
  keyLightAlpha: 0.9,
}
