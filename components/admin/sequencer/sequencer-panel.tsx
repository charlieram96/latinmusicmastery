'use client'

import type { Instrument } from '@/lib/play-sense/types'
import { getInstrumentCategory } from '@/lib/play-sense/types'
import { PercussionSequencer } from './percussion-sequencer'
import { PianoRollSequencer } from './piano-roll-sequencer'
import type { UseSequencerStateResult } from '@/hooks/use-sequencer-state'

interface SequencerPanelProps {
  sequencer: UseSequencerStateResult
  instrument: Instrument
  measures: number
  timeSignature: [number, number]
  subdivision: number
  zoom: number
}

export function SequencerPanel(props: SequencerPanelProps) {
  const category = getInstrumentCategory(props.instrument)

  if (category === 'pitched') {
    return <PianoRollSequencer {...props} />
  }

  return <PercussionSequencer {...props} />
}
