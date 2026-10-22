// @vitest-environment jsdom
import React,{act} from 'react'
import {createRoot} from 'react-dom/client'
import {expect,it,vi} from 'vitest'
vi.mock('@/components/language-provider',()=>({useTranslation:()=>({locale:'es'})}))
import {CourseSequenceContext,CourseSequenceNavigation} from '../course-sequence-navigation'
it('keeps class links at boundaries and uses independent activity actions within the class',async()=>{
 Object.assign(globalThis,{React,IS_REACT_ACT_ENVIRONMENT:true})
 const host=document.createElement('div'),root=createRoot(host),advance=vi.fn(),back=vi.fn()
 const course={previous:{title:'Pentagrama',href:'/admin/course?class=2'},current:{title:'Clave de Sol'},next:{title:'Líneas adicionales',href:'/admin/course?class=4'}}
 await act(async()=>root.render(<CourseSequenceContext.Provider value={course}><CourseSequenceNavigation activity="Lección" nextActivity={{title:'Ejercicio 1',onClick:advance}}/></CourseSequenceContext.Provider>))
 expect(host.querySelector('a')?.getAttribute('href')).toBe('/admin/course?class=2')
 expect(host.querySelector('[aria-current="step"]')?.textContent).toContain('Clave de Sol · Lección')
 await act(async()=>host.querySelector('button')!.click())
 expect(advance).toHaveBeenCalledTimes(1)
 await act(async()=>root.render(<CourseSequenceContext.Provider value={course}><CourseSequenceNavigation activity="Quiz" previousActivity={{title:'Ejercicio 2',onClick:back}}/></CourseSequenceContext.Provider>))
 expect(host.querySelector('a')?.getAttribute('href')).toBe('/admin/course?class=4')
 await act(async()=>host.querySelector('button')!.click())
 expect(back).toHaveBeenCalledTimes(1)
 await act(async()=>root.unmount())
})
