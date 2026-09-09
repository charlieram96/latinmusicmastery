import { notFound } from 'next/navigation'
import { ScorePreview } from './score-preview'

export default function ScorePreviewPage() {
  if (process.env.NODE_ENV !== 'development') notFound()
  return <ScorePreview/>
}
