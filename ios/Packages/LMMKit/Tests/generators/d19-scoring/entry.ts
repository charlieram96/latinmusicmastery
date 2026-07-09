// D19 golden-fixture generator entry point. Re-exports the REAL lib/play-sense +
// lib/playsense-studio modules (unmodified) so the bundle below is provably the
// production algorithm, not a hand-transcription. Lives only in scratchpad — never
// committed to the web app.
export * from '@/lib/play-sense/types'
export * from '@/lib/play-sense/scoring'
export * from '@/lib/play-sense/exercise-utils'
export * from '@/lib/play-sense/score-to-exercise'
export * from '@/lib/play-sense/onset-config'
export * from '@/lib/play-sense/playsense-mappings'
export * from '@/lib/playsense-studio/score-fixtures'
export * from '@/lib/playsense-studio/time-mapping'
export * from '@/lib/playsense-studio/perc-strokes'
export * from '@/lib/playsense-studio/score-to-vexflow'
