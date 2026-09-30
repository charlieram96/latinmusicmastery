// @vitest-environment jsdom
import React, {act} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it} from 'vitest';
import {LessonWrittenContent} from '../lesson-written-content';
import {ScoreHeading} from '@/components/playsense-studio/shared/score-heading';
import {GUITAR_LICK_FIXTURE} from '@/lib/playsense-studio/score-fixtures';
let root:Root,host:HTMLDivElement;
beforeEach(()=>{Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();});
const rich=(text:string)=>({type:'doc',content:[{type:'paragraph',content:[{type:'text',text}]}]});
it('shows description and updates rich notes when navigating between lesson parts',async()=>{
 await act(async()=>root.render(<LessonWrittenContent description="First description" richContent={rich('First notes')} locale="en"/>));
 expect(host.textContent).toContain('First description');
 expect(host.textContent).toContain('First notes');
 await act(async()=>root.render(<LessonWrittenContent description="Second description" richContent={rich('Second notes')} locale="en"/>));
 expect(host.textContent).toContain('Second description');
 expect(host.textContent).toContain('Second notes');
 expect(host.textContent).not.toContain('First');
 expect(host.querySelector('[contenteditable="true"]')).toBeNull();
});
it('does not leave an empty text section',async()=>{
 await act(async()=>root.render(<LessonWrittenContent description="  " richContent={null} locale="es"/>));
 expect(host.innerHTML).toBe('');
});
it('shows published metadata with the default author and no editing controls',async()=>{
 const score={...GUITAR_LICK_FIXTURE,composer:undefined};
 await act(async()=>root.render(<ScoreHeading score={score}/>));
 expect(host.querySelector('h2')?.textContent).toBe(score.title);
 expect(host.textContent).toContain(score.tracks[0].displayName);
 expect(host.textContent).toContain('LMM');
 expect(host.querySelector('input,button,select,[contenteditable="true"]')).toBeNull();
});
