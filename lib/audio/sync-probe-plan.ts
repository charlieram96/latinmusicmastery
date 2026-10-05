import type { ExerciseDefinition } from '@/lib/play-sense/types'
import { PROBE_COUNT } from './loopback-latency'
export const SYNC_BPM = 100
export const SYNC_BEAT_SECONDS = 60 / SYNC_BPM
export const SYNC_COUNT_IN_SECONDS = 4 * SYNC_BEAT_SECONDS
export const SYNC_FIRST_NOTE = .5 + SYNC_COUNT_IN_SECONDS
/** The same bar starts drive both emitted probes and the 3D note centers. */
export const SYNC_OFFSETS = Array.from({length:PROBE_COUNT},(_,i)=>SYNC_FIRST_NOTE+i*4*SYNC_BEAT_SECONDS)
export const SYNC_EXERCISE: ExerciseDefinition = {
  id:'equipment-sync-probe',title:'Synchronization',description:'',instrument:'timbale',bpm:SYNC_BPM,
  timeSignature:[4,4],measures:PROBE_COUNT,loopCount:1,swing:0,difficulty:'beginner',
  events:Array.from({length:PROBE_COUNT},(_,i)=>({measure:i+1,beat:1,instrument:'timbale',technique:'shell',surface:'cascara',hand:'R',duration:1,vexKey:'c/4',accent:true})),
}
