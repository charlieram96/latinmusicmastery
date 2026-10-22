import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {expect,it,vi} from 'vitest'
import {TimbalAssemblyStage} from '../timbal-assembly-stage'
const state=vi.hoisted(()=>({mode:'classic',theme:'light'}))
vi.mock('../store',()=>({useLearningMode:()=>state.mode}))
vi.mock('@/components/theme-provider',()=>({useTheme:()=>state}))
it('leaves classic mode untouched in either theme',()=>{
 for(const theme of ['light','dark']){state.mode='classic';state.theme=theme;expect(renderToStaticMarkup(<TimbalAssemblyStage/>)).toBe('')}
})
it('renders a non-interactive kids backdrop matching day and night',()=>{
 state.mode='kids'
 for(const theme of ['light','dark']){state.theme=theme;const html=renderToStaticMarkup(<TimbalAssemblyStage/>);expect(html).toContain(`data-night="${theme==='dark'}"`);expect(html).toContain('pointer-events-none');expect(html).toContain('aria-hidden="true"')}
})
