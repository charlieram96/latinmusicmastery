export type ScorePosition = 'left' | 'top' | 'right'

/** Keep room for both the notation and the instrument stage at every size. */
export function scorePanelBounds(width: number, height: number, stacked: boolean) {
  const extent = Math.max(1, stacked ? height : width)
  const min = Math.min(stacked ? 200 : 280, extent * .45)
  const max = Math.max(min, Math.min(stacked ? extent * .65 : 960, extent - (stacked ? 220 : 340)))
  return { min: Math.round(min), max: Math.round(max), extent }
}

export function scorePanelSize(fraction: number, bounds: ReturnType<typeof scorePanelBounds>) {
  return Math.round(Math.max(bounds.min, Math.min(bounds.max, fraction * bounds.extent)))
}
