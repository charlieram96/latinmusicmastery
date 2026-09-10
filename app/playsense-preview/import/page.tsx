import { notFound } from 'next/navigation';
import { ImportPreview } from './import-preview';

export default function ImportPreviewPage() {
  if (process.env.NODE_ENV !== 'development') notFound();
  return <ImportPreview />;
}
