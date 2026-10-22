import type { ExerciseEvent } from './types'
/** Physical setup; notation/stroke ids never change when a player moves a piece. */
export const TIMBAL_SETUP = [
  {id:'reserved-snare',en:'Snare',es:'Caja',strokes:['snare']},
  {id:'paila-low',en:'Low paila',es:'Paila grave',strokes:['low','low-mute','cascara-low','low-cross-stick','elbow-strike']},
  {id:'jamblock',en:'Jam block',es:'Jamblock',strokes:['jam-block']},
  {id:'chacha-bell',en:'Cha-cha bell',es:'Campana de chachachá',strokes:['chacha-bell-mouth','chacha-bell-body']},
  {id:'contracampana',en:'Timbal bell',es:'Contracampana',strokes:['timbal-bell']},
  {id:'bongo-bell',en:'Bongo hand bell',es:'Campana de mano / bongó',strokes:['bongo-bell-mouth','bongo-bell-body']},
  {id:'paila-high',en:'High paila',es:'Paila aguda',strokes:['high','rim','high-mute','cascara']},
  {id:'cymbal',en:'Cymbal',es:'Platillo',strokes:['cymbal']},
  {id:'reserved-kick',en:'Kick',es:'Bombo',strokes:['kick']},
  {id:'reserved-tom',en:'Tom',es:'Tom',strokes:['tom']},
] as const
export function timbalLaneId(event: ExerciseEvent): string {
  const authored=TIMBAL_SETUP.find(piece=>(piece.strokes as readonly string[]).includes(event.strokeId ?? ''))
  if(authored)return authored.id
  const legacy:Record<string,string>={snare:'reserved-snare',kick:'reserved-kick',tom:'reserved-tom',macho:'paila-high',hembra:'paila-low',cascara:'paila-high','cascara-low':'paila-low',campana:'contracampana',cencerro:'bongo-bell',jamblock:'jamblock',cymbal:'cymbal'}
  return legacy[event.surface ?? ''] ?? event.strokeId ?? event.surface ?? event.technique
}
