import {mergeBeatGrids} from './beat-grid';
import {pickActiveSection,type SectionRange} from './active-section';

/** Only the active section may contribute clicks. A later section owns its
 * entire range, including its silent lead-in before the confirmed anchor. */
export function sectionClickGrid(sections: Array<SectionRange & {grid:readonly number[]}>, general:readonly number[]=[]):number[]{
 return mergeBeatGrids([
  general.filter(t=>pickActiveSection(sections,t)<0),
  ...sections.map((s,i)=>s.grid.filter(t=>pickActiveSection(sections,t)===i)),
 ]);
}
