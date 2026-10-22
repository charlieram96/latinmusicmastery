/** Notifications only: sound and clicks always share the player's audio clock. */
export type BookPulse={start:number;beat:number;beatsPerBar:number;beatSeconds:number}
export type BookPlaybackState={playing:boolean;beat:number;beatsPerBar:number;count:number}
export const BOOK_PLAYBACK_STATE='lmm-book-playback-state'
export const BOOK_SOUND_STOP='lmm-book-sound-start'
export function publishBookPlayback(state:BookPlaybackState){window.dispatchEvent(new CustomEvent(BOOK_PLAYBACK_STATE,{detail:state}))}
export function meterPulse(meter='4/4'){
 const [n,d]=meter.split('/').map(Number),numerator=n>0?n:4,denominator=d>0?d:4
 const compound=numerator>3&&numerator%3===0&&denominator===8
 return {beatsPerBar:compound?numerator/3:numerator,quarterNotes:4/denominator*(compound?3:1)}
}
