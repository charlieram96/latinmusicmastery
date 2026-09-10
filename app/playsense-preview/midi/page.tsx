import { notFound } from 'next/navigation';
import { MidiPreview } from './midi-preview';
export default function MidiPreviewPage() {
  if (process.env.NODE_ENV !== 'development') notFound();
  return <MidiPreview />;
}
