import { expect, it } from 'vitest'
import { ritmoSectionOnSource } from '../ritmo-source-timing'
import type { ClassItemScoreSection } from '@/app/actions/playsense-studio'
it('moves score anchors to the untouched upload on both sides of the extra passage', () => {
  for (const [start, expected] of [[80,69.6898],[223,225.4024]]) {
    const section = { videoStartSeconds:start, videoEndSeconds:start+10, metronomeAnchorSeconds:start, activeTimeMap:{waypoints:[{videoTimeSeconds:start,musicalPositionQN:0}],nudges:[],flex:[{src:start,dst:start,anchor:true}]} } as unknown as ClassItemScoreSection
    const mapped=ritmoSectionOnSource(section)
    expect(mapped.videoStartSeconds).toBeCloseTo(expected)
    expect(mapped.activeTimeMap?.waypoints[0].videoTimeSeconds).toBeCloseTo(expected)
    expect(mapped.metronomeAnchorSeconds).toBeCloseTo(expected)
    expect(mapped.activeTimeMap?.flex?.[0].src).toBeCloseTo(expected)
    expect(section.videoStartSeconds).toBe(start)
  }
})
