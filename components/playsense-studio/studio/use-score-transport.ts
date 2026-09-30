'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ScoreDocument } from '../shared/score-model/types';
import { measureLengthInQN, qnToMs, walkMeasures } from '@/lib/playsense-studio/time-mapping';
import {scorePlaybackRate,playbackTrack} from '@/lib/playsense-studio/playback-tempo';
import { useTransportCountIn } from '../player/state/use-transport-count-in';
import { ClickTrack, readStoredClickVolume, writeStoredClickVolume } from '@/lib/playsense-studio/click-track';

export function useScoreTransport(score: ScoreDocument, trackIndex: number) {
  const bars = useMemo(() => {
    const track = score.tracks?.[trackIndex];
    return track ? [...walkMeasures(playbackTrack(track,score), score)].map(({ state }) => ({ start: state.cumulativeMs, end: state.cumulativeMs + qnToMs(measureLengthInQN(state.timeSignature), state.tempo), bpm: state.tempo, denominator:state.timeSignature[1], beatMs: qnToMs(4 / state.timeSignature[1], state.tempo) })) : [];
  }, [score, trackIndex]);
  const countIn=useTransportCountIn();
  const [countInBars,setCountInBars]=useState<0|1|2>(0);
  const [rate,setRate]=useState(()=>scorePlaybackRate(score));
  const rateRef=useRef(scorePlaybackRate(score));
  const duration = bars.at(-1)?.end ?? 0;
  const grid = useMemo(() => bars.flatMap(b => Array.from({length: Math.round((b.end-b.start)/b.beatMs)}, (_, i) => (b.start+i*b.beatMs)/1000)), [bars]);
  const [currentMs, setCurrentMs] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [metronome, setMetronome] = useState(true);
  const [volume, setVolume] = useState(readStoredClickVolume);
  const [error, setError] = useState('');
  const click = useRef<ClickTrack | null>(null);
  const position = useRef(0), origin = useRef(0), generation = useRef(0), running = useRef(false);
  const now = () => (click.current?.context?.currentTime ?? 0)*1000;
  const timingKey=JSON.stringify(bars);
  useEffect(() => {
    countIn.cancel(); generation.current++; running.current=false; click.current?.teardown();
    setPlaying(false); position.current=0; setCurrentMs(0);
  }, [timingKey, trackIndex]);
  useEffect(() => () => { generation.current++; click.current?.close(); }, []);
  useEffect(() => { click.current?.setVolume(metronome ? volume : 0); }, [metronome, volume]);
  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    const tick = () => {
      position.current = Math.min(duration, Math.max(0, (now()-origin.current)*rateRef.current));
      setCurrentMs(position.current);
      if (position.current >= duration) { running.current=false; click.current?.teardown(); setPlaying(false); }
      else frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, duration]);
  const startPlayback = async () => {
    if (!duration || running.current) return;
    const token=++generation.current;
    try {
      const engine=click.current ?? (click.current=new ClickTrack());
      const ctx=engine.ensureContext();
      if(ctx.state !== 'running') await ctx.resume();
      if(token!==generation.current) return;
      if(ctx.state !== 'running') throw new Error('Audio unavailable');
      if(position.current>=duration) position.current=0;
      engine.setGrid(grid); engine.setVolume(metronome ? volume : 0);
      const startSeconds=engine.start(position.current/1000,rateRef.current,true);
      origin.current=(startSeconds===undefined ? now() : startSeconds*1000)-position.current/rateRef.current;
      running.current=true; setCurrentMs(position.current); setPlaying(true); setError('');
    } catch { if(token===generation.current) setError('Unable to start audio. Press Play to retry.'); }
  };
  const pause = () => {
    countIn.cancel();
    generation.current++;
    if(running.current) { position.current=Math.min(duration,Math.max(0,(now()-origin.current)*rateRef.current)); setCurrentMs(position.current); }
    running.current=false; click.current?.teardown(); setPlaying(false);
  };
  const seek = (ms:number) => {
    countIn.cancel();
    position.current=Math.max(0,Math.min(duration,ms)); origin.current=now()-position.current/rateRef.current;
    if(running.current && click.current) {
      const start=click.current.start(position.current/1000,rateRef.current,true);
      origin.current=(start===undefined ? now() : start*1000)-position.current/rateRef.current;
    }
    setCurrentMs(position.current);
  };
  const play = () => {
    if(countIn.remaining){countIn.cancel();return;}
    if(!countInBars || running.current){void startPlayback();return;}
    const i=Math.max(0,bars.findIndex(b=>position.current<b.end));
    const bar=bars[i];if(!bar)return;
    // Unlock the playback context in this user gesture, before the count-in.
    const engine=click.current??(click.current=new ClickTrack());
    try {const ctx=engine.ensureContext();if(ctx.state!=='running')void ctx.resume().catch(()=>{});}catch{setError('Unable to start audio. Press Play to retry.');return;}
    seek(bar.start);
    void countIn.start({bpm:bar.bpm*rateRef.current,denominator:bar.denominator,beats:Math.round((bar.end-bar.start)/bar.beatMs),bars:countInBars,volume:volume||.2},()=>{void startPlayback();});
  };
  const changeRate=(next:number)=>{
    if(!Number.isFinite(next)||next<=0)return;
    countIn.cancel();
    if(running.current)position.current=Math.max(0,Math.min(duration,(now()-origin.current)*rateRef.current));
    rateRef.current=Math.max(.1,Math.min(2,next));setRate(rateRef.current);
    origin.current=now()-position.current/rateRef.current;
    if(running.current && click.current) {
      const start=click.current.start(position.current/1000,rateRef.current,true);
      origin.current=(start===undefined ? now() : start*1000)-position.current/rateRef.current;
    }
    setCurrentMs(position.current);
  };
  useEffect(()=>{changeRate(scorePlaybackRate(score));},[score.playbackTempoOverride,score.initialTempo]);
  const stop = () => { pause(); seek(0); };
  const seekBar = (index:number) => seek(bars[Math.max(0,Math.min(bars.length-1,index))]?.start ?? 0);
  const seekEvent = (measureIndex:number, eventIndex=0, voiceIndex=0) => {
    const bar=bars[measureIndex];
    const events=score.tracks[trackIndex]?.measures[measureIndex]?.voices?.[voiceIndex]?.events;
    if(!bar)return;
    const offsetQN=events?.slice(0,eventIndex).reduce((sum,event)=>sum+event.durationQN,0) ?? 0;
    seek(Math.min(bar.end,bar.start+qnToMs(offsetQN,bar.bpm)));
  };
  const index = currentMs>=duration ? Math.max(0,bars.length-1) : Math.max(0,bars.findIndex(b=>currentMs<b.end));
  const beatPosition=bars[index] ? Math.max(0,(currentMs-bars[index].start)/bars[index].beatMs) : 0;
  return { rate,changeRate,countInBars,setCountInBars:(n:0|1|2)=>{countIn.cancel();setCountInBars(n);},countdown:countIn.remaining,bars,duration,currentMs,playing,play,pause,stop,seek,seekBar,seekEvent,index,beat:Math.floor(beatPosition)+1,tick:Math.floor((beatPosition%1)*960),metronome,setMetronome,volume,setVolume:(v:number)=>{setVolume(v);writeStoredClickVolume(v);},error:error||countIn.error };
}
