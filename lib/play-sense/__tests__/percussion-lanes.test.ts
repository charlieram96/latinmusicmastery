import { expect, it } from 'vitest'
import { scoreToExerciseDefinition } from '../score-to-exercise'
import { createStageModel } from '@/components/play-sense/stage-highway/model'
import { createLaneLayout } from '@/components/play-sense/glass-highway/LaneLayout'
import { CONGA_TUMBAO_FIXTURE } from '@/lib/playsense-studio/score-fixtures'
import { getPercStrokes, strokeNotation } from '@/lib/playsense-studio/perc-strokes'

it('keeps high and low cáscara in distinct lanes in 3D and 2D', () => {
  const score = structuredClone(CONGA_TUMBAO_FIXTURE)
  score.tracks[0].instrument = 'perc-timbal'
  score.tracks[0].measures = [{number:1,voices:[{number:1,events:[65,68].map(midi=>({kind:'note' as const,midi,durationQN:2}))}]}]
  const exercise = scoreToExerciseDefinition(score)
  expect(exercise.events.map(e=>e.strokeId)).toEqual(['cascara','cascara-low'])
  const {lanes,notes} = createStageModel(exercise)
  expect(notes.map(n=>lanes[n.lane].id)).toEqual(['paila-high','paila-low'])
  expect(new Set(notes.map(n=>n.lane)).size).toBe(2)
  const flat = createLaneLayout(exercise)
  expect(flat.laneCount).toBe(10)
  expect(flat.laneForEvent(exercise.events[0])).not.toBe(flat.laneForEvent(exercise.events[1]))
})
it('routes all sixteen legend strokes to seven physical instruments and reserves three slots', () => {
  const score = structuredClone(CONGA_TUMBAO_FIXTURE)
  score.tracks[0].instrument = 'perc-timbal'
  const strokes = getPercStrokes('perc-timbal')!
  score.tracks[0].measures = strokes.map((s,i)=>({number:i+1,voices:[{number:1,events:[{kind:'note' as const,midi:s.midi,durationQN:4,percussion:strokeNotation(s)}]}]}))
  const exercise = scoreToExerciseDefinition(score)
  const stage = createStageModel(exercise)
  expect(stage.lanes).toHaveLength(10)
  expect(new Set(stage.notes.map(n=>n.lane)).size).toBe(7)
  const flat = createLaneLayout(exercise)
  expect(flat.laneCount).toBe(10)
  expect(new Set(exercise.events.map(e=>flat.laneForEvent(e))).size).toBe(7)
})

it('reordering changes positions, never stroke identity, timing or notation',()=>{
  const score=structuredClone(CONGA_TUMBAO_FIXTURE);score.tracks[0].instrument='perc-timbal'
  const strokes=getPercStrokes('perc-timbal')!
  score.tracks[0].measures=strokes.map((s,i)=>({number:i+1,voices:[{number:1,events:[{kind:'note' as const,midi:s.midi,durationQN:4,percussion:strokeNotation(s)}]}]}))
  const exercise=scoreToExerciseDefinition(score), original=JSON.stringify(score)
  const first=createStageModel(exercise)
  const reverse=createStageModel(exercise,first.lanes.map(l=>l.id).reverse(),'es')
  expect(reverse.lanes.map(l=>l.id)).toEqual(first.lanes.map(l=>l.id).reverse())
  expect(reverse.notes.map(n=>reverse.lanes[n.lane].id)).toEqual(first.notes.map(n=>first.lanes[n.lane].id))
  expect(reverse.notes.map(n=>[n.time,n.notehead,n.strokeId])).toEqual(first.notes.map(n=>[n.time,n.notehead,n.strokeId]))
  expect(reverse.lanes.find(l=>l.id==='paila-high')?.label).toBe('Paila aguda')
  expect(JSON.stringify(score)).toBe(original)
})

it('hides lanes without rerouting their notes or mutating the exercise',()=>{
  const score=structuredClone(CONGA_TUMBAO_FIXTURE);score.tracks[0].instrument='perc-timbal'
  score.tracks[0].measures=[{number:1,voices:[{number:1,events:[65,68].map(midi=>({kind:'note' as const,midi,durationQN:2}))}]}]
  const exercise=scoreToExerciseDefinition(score), original=JSON.stringify(exercise)
  const stage=createStageModel(exercise,[],'en',20,['paila-high'])
  expect(stage.notes).toHaveLength(1)
  expect(stage.notes[0].index).toBe(1)
  expect(stage.lanes[stage.notes[0].lane].id).toBe('paila-low')
  const empty=createStageModel(exercise,[],'en',20,createStageModel(exercise).lanes.map(l=>l.id))
  expect(empty.lanes).toEqual([]);expect(empty.notes).toEqual([])
  expect(JSON.stringify(exercise)).toBe(original)
})

it('routes snare, kick and tom to their existing movable slots without new notation',()=>{
 const score=structuredClone(CONGA_TUMBAO_FIXTURE);score.tracks[0].instrument='perc-timbal'
 const exercise=scoreToExerciseDefinition(score)
 exercise.events=['snare','kick','tom'].map((strokeId,i)=>({...exercise.events[0],instrument:'timbale',strokeId,surface:strokeId,measure:1,beat:i+1}))
 const stage=createStageModel(exercise, ['reserved-tom','reserved-snare','reserved-kick'],'es')
 expect(stage.notes.map(n=>stage.lanes[n.lane].id)).toEqual(['reserved-snare','reserved-kick','reserved-tom'])
 expect(stage.lanes.slice(0,3).map(l=>l.label)).toEqual(['Tom','Caja','Bombo'])
})
