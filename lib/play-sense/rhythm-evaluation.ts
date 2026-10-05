/** Onset-only F1. Default research reference: ±50 ms; callers may supply
 * an explicitly labelled teaching tolerance (microphone practice uses Good).
 * This evaluates detected attacks, not timbre, technique or pitch.
 * https://mir-eval.readthedocs.io/stable/api/onset.html
 */
export function evaluateRhythm(reference: number[], detected: number[], toleranceMs = 50) {
  const expected = [...reference].sort((a,b)=>a-b)
  const actual = [...detected].sort((a,b)=>a-b)
  if (![...expected,...actual].every(Number.isFinite)) throw new Error('Invalid onset time')
  const offsets: number[] = []
  let i=0,j=0
  // Ordered interval matching: each attack and reference can be used only once.
  while(i<expected.length && j<actual.length) {
    const delta = (actual[j]-expected[i])*1000
    if (delta < -toleranceMs-1e-7) j++
    else if (delta > toleranceMs+1e-7) i++
    else { offsets.push(delta);i++;j++ }
  }
  const matched=offsets.length
  const precision=actual.length ? matched/actual.length : 0
  const recall=expected.length ? matched/expected.length : 0
  const f1=expected.length+actual.length ? 200*matched/(expected.length+actual.length) : 0
  return { version:`onset-f1-${toleranceMs}ms-v1`, toleranceMs, expected:expected.length, detected:actual.length, matched,
    missed:expected.length-matched, extra:actual.length-matched, precision:precision*100, recall:recall*100, f1,
    meanAbsoluteErrorMs:matched ? offsets.reduce((sum,v)=>sum+Math.abs(v),0)/matched : null,
    biasMs:matched ? offsets.reduce((sum,v)=>sum+v,0)/matched : null }
}
