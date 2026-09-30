import {it,expect,vi,afterEach} from 'vitest';
import {loadClipAudio,clearClipAudioCache} from '../clip-audio-cache';
afterEach(()=>{clearClipAudioCache();vi.unstubAllGlobals();});
it('continues loading other MP3s after a failed download',async()=>{
 const buffer={duration:10} as AudioBuffer;
 const ctx={decodeAudioData:vi.fn(async()=>buffer)} as unknown as BaseAudioContext;
 vi.stubGlobal('fetch',vi.fn(async(url:string)=>({ok:url!=='bad.mp3',status:404,arrayBuffer:async()=>new ArrayBuffer(8)})));
 await expect(loadClipAudio(ctx,'bad.mp3')).rejects.toThrow();
 await expect(loadClipAudio(ctx,'good.mp3')).resolves.toBe(buffer);
 expect(ctx.decodeAudioData).toHaveBeenCalledTimes(1);
});
it('a remount replaces an aborted shared request without poisoning the replacement',async()=>{
 const buffer={duration:10} as AudioBuffer;
 const ctx={decodeAudioData:vi.fn(async()=>buffer)} as unknown as BaseAudioContext;
 vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(8)})));
 const aborted=new AbortController();
 const old=loadClipAudio(ctx,'track.mp3',aborted.signal);aborted.abort();
 const fresh=loadClipAudio(ctx,'track.mp3',new AbortController().signal);
 await expect(old).rejects.toMatchObject({name:'AbortError'});
 await expect(fresh).resolves.toBe(buffer);
 expect(loadClipAudio(ctx,'track.mp3')).toBe(fresh);
});
