import { expect, it } from 'vitest'
import { solfeoExerciseQuestions } from '../exercises'
import { gradeQuestionScore } from '@/lib/quiz/grading'
import { percentScore } from '@/lib/quiz/engine'

it.each([1,2] as const)('grades lesson %i with the shared exercise engine', lesson=>{
 const questions=solfeoExerciseQuestions(lesson,true)
 const graded=Object.fromEntries(questions.map(q=>[q.id,gradeQuestionScore(q,q.correct_answer)]))
 expect(percentScore(questions,graded)).toBe(100)
 graded[questions[0].id]=gradeQuestionScore(questions[0],'wrong')
 expect(percentScore(questions,graded)).toBe(75)
 expect(solfeoExerciseQuestions(lesson,false).map(q=>q.correct_answer)).toEqual(questions.map(q=>q.correct_answer))
})
