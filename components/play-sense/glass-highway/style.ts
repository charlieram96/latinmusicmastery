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

// Values tuned in /highway-lab and locked in by the user (June 2026).
export const DEFAULT_GLASS_STYLE: GlassStyle = {
  approachSec: 1.7,
  hitLineFraction: 0.8,

  laneLineAlpha: 0.64,
  hitLineGlowAlpha: 0.66,
  hitLineShimmerSpeed: 3.2,
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

  splashDropletCount: 22,
  splashSpeed: 560,
  splashGravity: 1800,
  flashAlpha: 0.64,
  mistAlpha: 0.39,

  chunkCount: 8,
  chunkSpeed: 230,

  missShakeAmp: 4.5,
  missShakeFreq: 21,
  missSinkAlpha: 0.34,
  rippleAlpha: 0.53,
  redGlowAlpha: 0.37,

  padFillAlpha: 0.1,
  padStrokeAlpha: 0.08,
  padFlashAlpha: 0.6,
  keyLightAlpha: 0.75,
}
