import { expect, it } from 'vitest'
import { activitySequence } from '../activity-sequence'
const classes = [{id:'a',title:'Introduction'},{id:'b',title:'Basic Timbal Rhythm'},{id:'c',title:'Next module first class'}]
const parts = [{id:'v',title:'Video',item_type:'VIDEO'}, ...[1,2,3,4].map(n=>({id:'q'+n,title:'Topic '+n,item_type:'QUIZ'}))]
const t = (key:string)=>key.endsWith('quiz')?'Quiz':'Lesson'
const sequence = (activeIndex:number,classId='a')=>activitySequence({courseId:'son',classId,classes,parts,activeIndex,t})
it('shows quiz 2, current quiz 3 and quiz 4 independently of question/grade state',()=>{
 const result=sequence(3)
 expect(result.previous?.title).toBe('Quiz 2 · Topic 2')
 expect(result.current.title).toBe('Introduction · Quiz 3 · Topic 3')
 expect(result.next?.href).toContain('itemId=q4')
})
it('continues from the final quiz into the next class, and across module boundaries',()=>{
 expect(sequence(4).next?.href).toBe('/dashboard/course/son/class/b')
 expect(sequence(4,'b').next?.title).toBe('Next module first class')
 expect(sequence(0,'b').previous?.title).toBe('Introduction')
 expect(sequence(0).previous).toBeUndefined()
 expect(sequence(4,'c').next).toBeUndefined()
})
