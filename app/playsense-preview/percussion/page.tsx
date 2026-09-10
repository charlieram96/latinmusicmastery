import { notFound } from 'next/navigation';
import { PercussionPreview } from './percussion-preview';
export default function PercussionPreviewPage() {
  if (process.env.NODE_ENV !== 'development') notFound();
  return <PercussionPreview />;
}
