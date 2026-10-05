export const SOBAO_EFFECTS_ITEM_ID = '8965d41a-569b-4295-a449-afbcbbcb4fad'
export const SOBAO_EFFECTS_TITLE = 'Cáscara con Sobao Simple'

/** This demo's camera cut was checked against the source video. */
export const SOBAO_OVERHEAD_START = 14.180833

export function videoPreviewCues(time: number, duration: number, sobao: boolean, lastRound: boolean, roundTime = time) {
  const windows = sobao
    ? [[3.5, 6.5]]
    : [[duration * .12, duration * .24], [duration * .36, duration * .48], [duration * .61, duration * .73], [duration * .82, duration * .94]]
  const tip = windows.findIndex(([start, end]) => time >= start && time < end)
  const overhead = sobao && time >= SOBAO_OVERHEAD_START
  const annotations: string[] = []
  if (sobao) {
    if (time >= 6.5 && time < 11.5) annotations.push('cascara')
    if (time >= 9 && time < SOBAO_OVERHEAD_START) annotations.push('sobao-front')
    if (overhead && time < 20) annotations.push('sobao-overhead')
    if (overhead && time >= 18 && time < 21.5) annotations.push('cascara-overhead')
  }
  const technique = annotations.length > 0
  const finalNotice = lastRound && roundTime >= 0 && roundTime < 2
  const tipOpacity = tip < 0 ? 0 : Math.max(0, Math.min(1, (time - windows[tip][0]) / .25, (windows[tip][1] - time) / .3))
  return { tip: finalNotice || technique ? -1 : tip, tipOpacity, technique, annotations, finalNotice, roundCounter: !overhead && tip < 0 && !technique && !finalNotice }
}

/** Each round is two 4/4 measures; seeking derives the same round as playback. */
export function videoRoundAt(time: number, bpm: number, anchorSeconds: number, totalRounds: number) {
  const secondsPerRound = 8 * 60 / (Number.isFinite(bpm) && bpm > 0 ? bpm : 120)
  const elapsed = Math.max(0, time - anchorSeconds)
  const round = Math.min(totalRounds, Math.floor(elapsed / secondsPerRound) + 1)
  return { round, roundTime: elapsed - (round - 1) * secondsPerRound }
}
