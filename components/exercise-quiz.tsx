'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { submitExerciseAttempt } from '@/app/actions/progress'
import { CheckCircle2, XCircle, RotateCcw } from 'lucide-react'

interface ExerciseQuizProps {
  exercise: {
    id: string
    question: string
    question_type: 'multiple_choice' | 'text' | 'audio'
    options: string[] | null
    correct_answer: string
    explanation: string | null
  }
  userId: string
}

export function ExerciseQuiz({ exercise, userId }: ExerciseQuizProps) {
  const [selectedAnswer, setSelectedAnswer] = useState<string>('')
  const [submitted, setSubmitted] = useState(false)
  const [isCorrect, setIsCorrect] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async () => {
    if (!selectedAnswer.trim()) {
      alert('Please select or enter an answer')
      return
    }

    setIsLoading(true)
    try {
      // Check if answer is correct
      const correct = selectedAnswer.toLowerCase().trim() === exercise.correct_answer.toLowerCase().trim()
      setIsCorrect(correct)

      // Submit attempt
      const result = await submitExerciseAttempt(
        exercise.id,
        userId,
        selectedAnswer,
        correct
      )

      if (result.error) {
        console.error('Failed to submit attempt:', result.error)
        alert('Failed to save your attempt. Please try again.')
        return
      }

      setSubmitted(true)
    } catch (error) {
      console.error('Error submitting attempt:', error)
      alert('An error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleReset = () => {
    setSelectedAnswer('')
    setSubmitted(false)
    setIsCorrect(false)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Question</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Question */}
        <div>
          <p className="text-lg font-medium mb-4">{exercise.question}</p>
        </div>

        {/* Answer Input */}
        {!submitted && (
          <div className="space-y-4">
            {exercise.question_type === 'multiple_choice' && exercise.options && (
              <div className="space-y-2">
                {exercise.options.map((option, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedAnswer(option)}
                    className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                      selectedAnswer === option
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50 hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          selectedAnswer === option
                            ? 'border-primary bg-primary'
                            : 'border-border'
                        }`}
                      >
                        {selectedAnswer === option && (
                          <div className="w-2 h-2 rounded-full bg-primary-foreground" />
                        )}
                      </div>
                      <span>{option}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {exercise.question_type === 'text' && (
              <Input
                placeholder="Type your answer here..."
                value={selectedAnswer}
                onChange={(e) => setSelectedAnswer(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSubmit()
                  }
                }}
              />
            )}

            {exercise.question_type === 'audio' && (
              <Textarea
                placeholder="Type what you hear..."
                value={selectedAnswer}
                onChange={(e) => setSelectedAnswer(e.target.value)}
                rows={3}
              />
            )}

            <Button
              onClick={handleSubmit}
              disabled={isLoading || !selectedAnswer.trim()}
              className="w-full"
              size="lg"
            >
              {isLoading ? 'Submitting...' : 'Submit Answer'}
            </Button>
          </div>
        )}

        {/* Feedback */}
        {submitted && (
          <div className="space-y-4">
            <div
              className={`p-6 rounded-lg border-2 ${
                isCorrect
                  ? 'bg-green-50 border-green-200'
                  : 'bg-red-50 border-red-200'
              }`}
            >
              <div className="flex items-start gap-3 mb-3">
                {isCorrect ? (
                  <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
                ) : (
                  <XCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-1" />
                )}
                <div className="flex-1">
                  <h3 className={`text-lg font-semibold mb-1 ${
                    isCorrect ? 'text-green-900' : 'text-red-900'
                  }`}>
                    {isCorrect ? 'Correct!' : 'Not quite right'}
                  </h3>
                  <p className={`text-sm ${
                    isCorrect ? 'text-green-700' : 'text-red-700'
                  }`}>
                    Your answer: <strong>{selectedAnswer}</strong>
                  </p>
                  {!isCorrect && (
                    <p className="text-sm text-red-700 mt-1">
                      Correct answer: <strong>{exercise.correct_answer}</strong>
                    </p>
                  )}
                </div>
              </div>

              {exercise.explanation && (
                <div className={`pt-3 border-t ${
                  isCorrect ? 'border-green-200' : 'border-red-200'
                }`}>
                  <h4 className={`font-medium mb-1 text-sm ${
                    isCorrect ? 'text-green-900' : 'text-red-900'
                  }`}>
                    Explanation:
                  </h4>
                  <p className={`text-sm ${
                    isCorrect ? 'text-green-700' : 'text-red-700'
                  }`}>
                    {exercise.explanation}
                  </p>
                </div>
              )}
            </div>

            <Button
              onClick={handleReset}
              variant="outline"
              className="w-full"
              size="lg"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
