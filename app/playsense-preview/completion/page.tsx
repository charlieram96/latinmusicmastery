import { notFound } from 'next/navigation'
import { CompletionPreview } from './completion-preview'

export default function CompletionPreviewPage() {
  if (process.env.NODE_ENV !== 'development') notFound()
  return <CompletionPreview />
}
