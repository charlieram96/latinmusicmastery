// @vitest-environment jsdom
import { beforeEach,expect,it } from 'vitest'
import { acousticProfileKey,readAcousticProfile,saveAcousticProfile } from '../acoustic-profile'
beforeEach(()=>localStorage.clear())
it('reuses profiles across classes but isolates users, devices, instruments and output modes',()=>{
 const key=acousticProfileKey('alice','camera','claps','headphones')
 localStorage.setItem(key,JSON.stringify({version:3,noise:.001,floor:.003,mode:'rhythm-only',at:new Date().toISOString()}))
 expect(readAcousticProfile(key)?.floor).toBe(.003)
 for(const args of [['bob','camera','claps','headphones'],['alice','usb','claps','headphones'],['alice','camera','voice','headphones'],['alice','camera','claps','speaker-safe']]) {
 expect(readAcousticProfile(acousticProfileKey(args[0],args[1],args[2],args[3]))).toBeNull()
 }
})
it('rejects stale or corrupted calibration',()=>{
 localStorage.setItem('bad',JSON.stringify({version:2,noise:.001,floor:.003,mode:'rhythm-only'}))
 expect(readAcousticProfile('bad')).toBeNull()
 localStorage.setItem('bad','broken')
 expect(readAcousticProfile('bad')).toBeNull()
})
it('retains the old profile until completion and appends a local history on save',()=>{
 const key=acousticProfileKey('alice','camera','claps','headphones')
 const first={version:3 as const,noise:.001,floor:.003,mode:'rhythm-only' as const,at:'2026-10-01T10:00:00Z'}
 saveAcousticProfile(key,first)
 expect(readAcousticProfile(key)).toEqual(first)
 const second={...first,floor:.002,at:'2026-10-02T10:00:00Z'}
 saveAcousticProfile(key,second)
 expect(readAcousticProfile(key)).toEqual(second)
 expect(JSON.parse(localStorage.getItem(`${key}.history`)!)).toEqual([first,second])
})
