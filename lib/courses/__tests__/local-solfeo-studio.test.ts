import { beforeEach, describe, expect, it, vi } from 'vitest'
const state=vi.hoisted(()=>({disk:'',allowed:true,write:vi.fn()}))
vi.mock('node:fs/promises',()=>({readFile:vi.fn(async()=>state.disk),writeFile:vi.fn(async(_p:string,value:string)=>{state.disk=value;state.write(value)}),rename:vi.fn()}))
vi.mock('../local-solfeo-draft',()=>({usesLocalSolfeo:vi.fn(async()=>state.allowed),readLocalSolfeo:vi.fn(async()=>({sections:[]})),localItem:vi.fn()}))
import { addLocalSection, localStudioSections, saveLocalDraft } from '../local-solfeo-studio'
import { EMPTY_TIMING } from '@/lib/playsense-studio/drafts/timing'
import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types'
const score:ScoreDocument={schemaVersion:1,title:'Prueba',sourceFormat:'native',initialTempo:60,initialTimeSignature:[4,4],initialKeyFifths:0,tracks:[]}
beforeEach(()=>{state.disk=JSON.stringify({sections:[],media:{}});state.allowed=true;state.write.mockClear()})
describe('local Studio persistence',()=>{
 it('creates and reloads a section from the local file',async()=>{const created=await addLocalSection('local-solfeo-video',score);const loaded=await localStudioSections('local-solfeo-video');expect(loaded.data[0].sectionId).toBe(created.sectionId);expect(loaded.data[0].scoreDocument.parsedScore).toEqual(score)})
 it('keeps unpublished changes separate from the student score',async()=>{const created=await addLocalSection('local-solfeo-video',score);await saveLocalDraft(created.sectionId,{...score,title:'Draft'},EMPTY_TIMING);expect((await localStudioSections('local-solfeo-video')).data[0].studioDraft?.score.title).toBe('Draft');const student=(await localStudioSections('local-solfeo-video',false)).data[0];expect(student.studioDraft).toBeNull();expect(student.scoreDocument.title).toBe('Prueba')})
 it('refuses writes when the localhost guard fails',async()=>{state.allowed=false;await expect(addLocalSection('local-solfeo-video',score)).rejects.toThrow('unavailable');expect(state.write).not.toHaveBeenCalled()})
})
