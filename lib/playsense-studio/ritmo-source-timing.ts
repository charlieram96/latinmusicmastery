import type { ClassItemScoreSection } from '@/app/actions/playsense-studio'
import { ritmoSourceTime } from './ritmo-presentation'

/** Local read projection only. Never writes the reference lesson's synchronization. */
export function ritmoSectionOnSource(section: ClassItemScoreSection): ClassItemScoreSection {
  // Each scored performance is continuous; keep its beat spacing intact, including its trailing boundary.
  const anchor = section.videoStartSeconds ?? section.activeTimeMap?.waypoints[0]?.videoTimeSeconds ?? 0
  const offset = ritmoSourceTime(anchor) - anchor
  const project = (value: number) => Math.max(0, value + offset)
  const time = (value: number | null) => value === null ? null : project(value)
  const map = section.activeTimeMap
  const flex = map?.flex?.map(point => ({ ...point, src: project(point.src), dst: project(point.dst) }))
  return {
    ...section,
    videoStartSeconds: time(section.videoStartSeconds),
    videoEndSeconds: time(section.videoEndSeconds),
    metronomeAnchorSeconds: time(section.metronomeAnchorSeconds),
    activeTimeMap: map ? { ...map, waypoints: map.waypoints.map(point => ({ ...point, videoTimeSeconds: project(point.videoTimeSeconds) })), flex,
      params: { ...map.params, ...(flex ? { flex } : {}) } } : null,
  }
}
