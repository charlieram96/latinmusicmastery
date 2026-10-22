 'use client'
import { useSyncExternalStore } from 'react'
const EVENT = 'playsense-instrument-order'
const EMPTY: string[] = []
const cache = new Map<string, {raw:string|null; order:string[]}>()
function subscribe(fn:()=>void) {
  window.addEventListener('storage',fn); window.addEventListener(EVENT,fn)
  return ()=>{window.removeEventListener('storage',fn);window.removeEventListener(EVENT,fn)}
}
export function useLaneOrder(instrument:string,scope:'admin'|'student'='student') {
  const key = `lmm-playsense-lane-order-v2:${scope}:${instrument}`
  const order = useSyncExternalStore(subscribe,()=>{
    try {
      const raw = localStorage.getItem(key)
      const previous = cache.get(key)
      if(previous?.raw === raw) return previous.order
      const value:unknown = raw ? JSON.parse(raw) : []
      let order = Array.isArray(value) && value.every(id=>typeof id==='string') ? [...new Set(value as string[])] : EMPTY
      // Migrate only the previous factory layout; preserve deliberately customized orders.
      const oldDefault = ['paila-low','jamblock','chacha-bell','contracampana','bongo-bell','paila-high','cymbal','reserved-snare','reserved-kick','reserved-tom']
      if(instrument==='timbale' && JSON.stringify(order)===JSON.stringify(oldDefault)) order=['reserved-snare',...oldDefault.filter(id=>id!=='reserved-snare')]
      cache.set(key,{raw,order}); return order
    } catch {return EMPTY}
  },()=>EMPTY)
  const save = (next:string[]) => {
    try {localStorage.setItem(key,JSON.stringify(next))} catch {return false}
    window.dispatchEvent(new Event(EVENT));return true
  }
  return [order,save] as const
}

const DEFAULT_HIDDEN = ['reserved-snare','reserved-kick','reserved-tom']
export function useHiddenInstruments(instrument:string,scope:'admin'|'student'='student') {
  const key=`lmm-hidden-instruments-v1:${scope}:${instrument}`
  const hidden=useSyncExternalStore(subscribe,()=>{
    try {
      const raw=localStorage.getItem(key), previous=cache.get(key)
      if(previous?.raw===raw)return previous.order
      const value:unknown=raw?JSON.parse(raw):DEFAULT_HIDDEN
      const order=Array.isArray(value)?value.filter((id):id is string=>typeof id==='string'):DEFAULT_HIDDEN
      cache.set(key,{raw,order});return order
    }catch{return DEFAULT_HIDDEN}
  },()=>DEFAULT_HIDDEN)
  return [hidden,(ids:string[])=>{
    try{localStorage.setItem(key,JSON.stringify(ids));window.dispatchEvent(new Event(EVENT));return true}catch{return false}
  }] as const
}
