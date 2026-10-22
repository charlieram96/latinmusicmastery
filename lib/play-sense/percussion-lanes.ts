import { TIMBAL_SETUP, timbalLaneId } from './timbal-setup'
import type { ExerciseDefinition, ExerciseEvent } from './types'
import { PLAYSENSE_MAPPINGS } from './playsense-mappings'

/** A score stroke is not a sensor: several techniques can share one drum. */
export const percussionLaneId = (event: ExerciseEvent) => event.instrument === 'timbale' ? timbalLaneId(event) : event.strokeId ?? event.surface ?? event.technique
export function percussionLanes(exercise: ExerciseDefinition, locale: 'en'|'es' = 'en') {
  const lanes = new Map<string, {id:string; label:string; surface:string}>()
  if(exercise.instrument==='timbale') for(const piece of TIMBAL_SETUP) lanes.set(piece.id,{id:piece.id,label:piece[locale],surface:piece.id})
  for (const event of exercise.events) {
    const id = percussionLaneId(event)
    if (!lanes.has(id)) lanes.set(id, {id, label:event.strokeLabel ?? id, surface:event.surface ?? id})
  }
  if (!lanes.size) for (const id of Object.values(PLAYSENSE_MAPPINGS[exercise.instrument]?.piezoMap ?? {0:'open'})) {
    lanes.set(id, {id,label:id,surface:id})
  }
  return [...lanes.values()]
}
