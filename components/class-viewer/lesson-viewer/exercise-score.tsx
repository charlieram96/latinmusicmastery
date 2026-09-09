'use client'

import { useMemo, useState } from 'react'
import { AudioLines, Columns2, LocateFixed, Minus, Music2, PanelLeft, PanelRight, PanelTop, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types'
import { StaffRenderer, type StaffFollowMode } from '@/components/playsense-studio/player/notation/renderers/staff-renderer'
import { repeatProjection } from '@/lib/playsense-studio/repeats'
import { trackDurationMs, walkMeasures } from '@/lib/playsense-studio/time-mapping'
import { exerciseReadingScore, exerciseReadingTime } from '@/lib/playsense-studio/exercise-reading-score'
import { useExerciseWorkspace } from './exercise-workspace'
import './exercise-score.css'

interface ExerciseScoreProps {
  score: ScoreDocument
  currentMs: number
  getCurrentMs?: () => number
  playing: boolean
  pass: number
  getPass?: () => number
  passCount: number
  onDurationKnown: (duration: number) => void
}

export function ExerciseScore({ score, currentMs, getCurrentMs, playing, pass, getPass, passCount, onDurationKnown }: ExerciseScoreProps) {
  const [follow, setFollow] = useState<StaffFollowMode>('measure')
  const [autoFollow, setAutoFollow] = useState(true)
  const [zoom, setZoom] = useState(1)
  const workspace = useExerciseWorkspace()
  const vertical = !!workspace && workspace.position !== 'top'
  const readingScore = useMemo(() => vertical ? exerciseReadingScore(score, passCount) : score, [score, passCount, vertical])
  const passDuration = useMemo(() => score.tracks[0] ? trackDurationMs(score.tracks[0], score) : 0, [score])
  const readingMs = vertical ? exerciseReadingTime(currentMs, pass, passCount, passDuration) : currentMs
  const readClock = getCurrentMs ? () => vertical
    ? exerciseReadingTime(getCurrentMs(), getPass?.() ?? pass, passCount, passDuration)
    : getCurrentMs() : undefined
  const projection = useMemo(() => repeatProjection(readingScore, 0), [readingScore])
  const displayScore = projection?.score ?? readingScore
  const measures = useMemo(() => displayScore.tracks[0] ? [...walkMeasures(displayScore.tracks[0], displayScore)] : [], [displayScore])
  const displayMs = projection?.toCompactMs(readingMs) ?? readingMs
  let measureIndex = 0
  while (measureIndex + 1 < measures.length && measures[measureIndex + 1].state.cumulativeMs <= displayMs) measureIndex++
  const active = measures[measureIndex]
  const signature = active?.state.timeSignature ?? score.initialTimeSignature
  const beatMs = 60_000 / (active?.state.tempo ?? score.initialTempo) * 4 / signature[1]
  const beat = Math.min(signature[0] - 1, Math.floor(Math.max(0, displayMs - (active?.state.cumulativeMs ?? 0)) / beatMs))

  return <section id={workspace?.scoreId} className="ps-lesson-notation ps-exercise-score" data-score-layout={vertical ? 'vertical' : 'horizontal'} aria-label="Musical score">
    <header className="ps-score-toolbar">
      <div className="ps-score-identity"><Music2 size={15}/><strong>Score</strong><span>{displayScore.tracks[0]?.displayName}</span></div>
      {workspace && <Popover>
        <PopoverTrigger asChild><Button size="sm" variant="ghost" className="ps-score-layout-trigger" aria-label="Score layout" title="Score layout"><PanelRight size={14}/><span>Layout</span></Button></PopoverTrigger>
        <PopoverContent align="end" className="ps-score-layout-menu">
          <strong>Make room for your music</strong>
          <p>Choose where your score sits.</p>
          <div className="ps-score-position-options" role="group" aria-label="Score position">
            {([{value:'left',label:'Left',icon:PanelLeft},{value:'top',label:'Top',icon:PanelTop},{value:'right',label:'Right',icon:PanelRight}] as const).map(({value,label,icon:Icon})=>
              <Button key={value} variant="ghost" aria-label={`Score on the ${value}`} aria-pressed={workspace.position === value} onClick={()=>workspace.setPosition(value)}><Icon size={22}/>{label}</Button>)}
          </div>
          {vertical && <div className="ps-score-panel-control">
            <span>{workspace.stacked ? 'Drag the divider above the score to resize.' : 'Drag the divider beside the score to resize.'}</span><Button variant="ghost" size="sm" onClick={workspace.resetSize}>Reset</Button>
          </div>}
          {workspace.stacked && vertical && <p className="ps-score-layout-note">On smaller screens, the score sits below the stage.</p>}
        </PopoverContent>
      </Popover>}
      <div className="ps-score-location" aria-label={`Measure ${measureIndex + 1} of ${measures.length}, beat ${beat + 1}`}>
        <span>Measure <strong>{String(measureIndex + 1).padStart(2, '0')}</strong><i>/ {String(measures.length).padStart(2, '0')}</i></span>
        <div className="ps-score-beats" aria-hidden="true">{Array.from({length:Math.min(12,signature[0])},(_,i)=><i key={i} data-active={playing && i === beat}/>)}</div>
        {passCount > 1 && <small>Pass {Math.min(pass, passCount)} / {passCount}</small>}
      </div>
      <div className="ps-score-tools">
        {vertical ? <Button size="sm" variant="ghost" className="ps-score-autofollow" aria-pressed={autoFollow} aria-label="Follow current measure" title={autoFollow ? 'Following playback. Turn off to browse the score.' : 'Resume following the current measure.'} onClick={()=>setAutoFollow(value=>!value)}><LocateFixed size={13}/><span>Follow</span></Button> : <div className="ps-score-follow" role="group" aria-label="Score scrolling">
          <Button size="sm" variant="ghost" aria-pressed={follow === 'measure'} aria-label="Steady score reading" title="Keep the phrase still. Turn at a measure or beat boundary." onClick={()=>setFollow('measure')}><Columns2 size={13}/><span>Steady</span></Button>
          <Button size="sm" variant="ghost" aria-pressed={follow === 'flow'} aria-label="Continuous score scrolling" title="Follow the playhead smoothly" onClick={()=>setFollow('flow')}><AudioLines size={13}/><span>Flow</span></Button>
        </div>}
        <div className="ps-score-zoom" role="group" aria-label="Notation size">
          <Button size="sm" variant="ghost" aria-label="Smaller notation" disabled={zoom <= .71} onClick={()=>setZoom(z=>Math.max(.7,z-.1))}><Minus size={13}/></Button>
          <span>{Math.round(zoom * 100)}%</span>
          <Button size="sm" variant="ghost" aria-label="Larger notation" disabled={zoom >= 1.39} onClick={()=>setZoom(z=>Math.min(1.4,z+.1))}><Plus size={13}/></Button>
        </div>
      </div>
    </header>
    <div className="ps-score-sheet"><StaffRenderer score={readingScore} trackIndex={0} currentMs={readingMs} getCurrentMs={playing ? readClock : undefined}
      showCursor={playing} compact layoutMode={vertical ? 'wrapped' : 'scroll'} autoFollow={autoFollow} followMode={follow} zoom={zoom * .9}
      onDurationKnown={duration => onDurationKnown(vertical ? duration / Math.max(1, passCount) : duration)}/></div>
    {vertical && <footer className="ps-score-reading-footer"><i data-active={autoFollow}/><span>{autoFollow ? 'Following your music' : 'Browse at your own pace'}</span><small>Scroll to read ahead</small></footer>}
  </section>
}
