'use client'

import { ScoreExerciseGame } from '@/components/class-viewer/lesson-viewer/score-exercise-game'
import { CONGA_TUMBAO_FIXTURE } from '@/lib/playsense-studio/score-fixtures'
import { scoreToExerciseDefinition } from '@/lib/play-sense/score-to-exercise'
import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types'

// A longer local phrase makes scrolling and measure transitions easy to review.
// The real exercise view and its preview save guard are used without student data.
const score: ScoreDocument = {
  ...CONGA_TUMBAO_FIXTURE,
  title:'Tumbao · Find the pulse',
  initialTempo:100,
  tracks: [{ ...CONGA_TUMBAO_FIXTURE.tracks[0],
    measures:Array.from({length:8},(_,i)=>({...CONGA_TUMBAO_FIXTURE.tracks[0].measures[i % 2],number:i + 1})),
  }],
}
const exercise = {...scoreToExerciseDefinition(score, {id:'score-design-preview'}),loopCount:2}

export function ScorePreview() {
  return <ScoreExerciseGame exercise={exercise} score={score} preview/>
}
