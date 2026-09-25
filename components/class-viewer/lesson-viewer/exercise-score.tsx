'use client'

import { useMemo, useState } from 'react'
import { LocateFixed, Minus, Music2, PanelLeft, PanelRight, PanelTop, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types'
import { StaffRenderer } from '@/components/playsense-studio/player/notation/renderers/staff-renderer'
import { StaffLayoutSwitch, staffLayoutMode, useStaffLayoutPreference } from '@/components/playsense-studio/player/notation/staff-layout-switch'
import { useTranslation } from '@/components/language-provider'
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
  const { t } = useTranslation()
  const [layout, setLayout] = useStaffLayoutPreference()
  const stacked = layout === 'stacked'
  const [autoFollow, setAutoFollow] = useState(true)
  const [zoom, setZoom] = useState(1)
  const workspace = useExerciseWorkspace()
  // The panel's shape (a side column or a strip on top) is separate from the staff layout.
  const vertical = !!workspace && workspace.position !== 'top'
  // Both layouts read every pass forward, so a page never turns back at a loop.
  const readingScore = useMemo(() => exerciseReadingScore(score, passCount), [score, passCount])
  const passDuration = useMemo(() => score.tracks[0] ? trackDurationMs(score.tracks[0], score) : 0, [score])
  const readingMs = exerciseReadingTime(currentMs, pass, passCount, passDuration)
  const readClock = getCurrentMs
    ? () => exerciseReadingTime(getCurrentMs(), getPass?.() ?? pass, passCount, passDuration)
    : undefined
  const projection = useMemo(() => repeatProjection(readingScore, 0), [readingScore])
  const displayScore = projection?.score ?? readingScore
  const measures = useMemo(() => displayScore.tracks[0] ? [...walkMeasures(displayScore.tracks[0], displayScore)] : [], [displayScore])
  const displayMs = projection?.toCompactMs(readingMs) ?? readingMs
  const passBars = Math.max(1, Math.round(measures.length / Math.max(1, passCount)))
  let measureIndex = 0
  while (measureIndex + 1 < measures.length && measures[measureIndex + 1].state.cumulativeMs <= displayMs) measureIndex++
  const active = measures[measureIndex]
  const signature = active?.state.timeSignature ?? score.initialTimeSignature
  const beatMs = 60_000 / (active?.state.tempo ?? score.initialTempo) * 4 / signature[1]
  const beat = Math.min(signature[0] - 1, Math.floor(Math.max(0, displayMs - (active?.state.cumulativeMs ?? 0)) / beatMs))

  // The HUD counts bars within the current pass.
  const bar = measureIndex % passBars + 1

  return <section id={workspace?.scoreId} className="ps-lesson-notation ps-exercise-score" data-score-layout={vertical ? 'vertical' : 'horizontal'} data-staff-layout={layout} aria-label={t('staff.scoreAria')}>
    <header className="ps-score-toolbar">
      <div className="ps-score-identity"><Music2 size={15}/><strong>{t('staff.score')}</strong><span>{displayScore.tracks[0]?.displayName}</span></div>
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
      <div className="ps-score-location" aria-label={t('staff.barAria', { bar, total: passBars, beat: beat + 1 })}>
        <span>{t('staff.bar')} <strong>{String(bar).padStart(2, '0')}</strong><i>/ {String(passBars).padStart(2, '0')}</i></span>
        <div className="ps-score-beats" aria-hidden="true">{Array.from({length:Math.min(12,signature[0])},(_,i)=><i key={i} data-active={playing && i === beat}/>)}</div>
        {passCount > 1 && <small>{t('staff.pass', { pass: Math.min(pass, passCount), total: passCount })}</small>}
      </div>
      <div className="ps-score-tools">
        <StaffLayoutSwitch value={layout} onChange={setLayout}/>
        {stacked && <Button size="sm" variant="ghost" className="ps-score-autofollow" aria-pressed={autoFollow} aria-label={t('staff.followAria')} title={autoFollow ? t('staff.followOnTitle') : t('staff.followOffTitle')} onClick={()=>setAutoFollow(value=>!value)}><LocateFixed size={13}/><span>{t('staff.follow')}</span></Button>}
        <div className="ps-score-zoom" role="group" aria-label={t('staff.size')}>
          <Button size="sm" variant="ghost" aria-label={t('staff.smaller')} disabled={zoom <= .71} onClick={()=>setZoom(z=>Math.max(.7,z-.1))}><Minus size={13}/></Button>
          <span>{Math.round(zoom * 100)}%</span>
          <Button size="sm" variant="ghost" aria-label={t('staff.larger')} disabled={zoom >= 1.39} onClick={()=>setZoom(z=>Math.min(1.4,z+.1))}><Plus size={13}/></Button>
        </div>
      </div>
    </header>
    <div className="ps-score-sheet"><StaffRenderer score={readingScore} trackIndex={0} currentMs={readingMs} getCurrentMs={playing ? readClock : undefined}
      showCursor={playing} compact layoutMode={staffLayoutMode(layout)} autoFollow={autoFollow} zoom={zoom * .9}
      onDurationKnown={duration => onDurationKnown(duration / Math.max(1, passCount))}/></div>
    {stacked && vertical && <footer className="ps-score-reading-footer"><i data-active={autoFollow}/><span>{autoFollow ? t('staff.following') : t('staff.browsing')}</span><small>{t('staff.scrollHint')}</small></footer>}
  </section>
}
