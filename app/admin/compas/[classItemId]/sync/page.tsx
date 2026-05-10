import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getScoreDocumentForClassItem } from '@/app/actions/compas';
import { SyncWorkspace } from './sync-workspace';

interface PageProps {
  params: Promise<{ classItemId: string }>;
}

export const dynamic = 'force-dynamic';

export default async function CompasSyncPage({ params }: PageProps) {
  const { classItemId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();
  if (!profile?.is_admin) redirect('/dashboard');

  const { data: classItem } = await supabase
    .from('class_items')
    .select('id, title, video_url, score_document_id')
    .eq('id', classItemId)
    .single();
  if (!classItem) notFound();
  if (!classItem.score_document_id || !classItem.video_url) {
    redirect(`/admin/courses`);
  }

  const result = await getScoreDocumentForClassItem(classItemId);
  if (!result.data) notFound();

  return (
    <SyncWorkspace
      classItemId={classItemId}
      classItemTitle={classItem.title}
      videoUrl={classItem.video_url}
      scoreDocumentId={classItem.score_document_id}
      score={result.data.scoreDocument.parsedScore}
      tracks={result.data.tracks}
      activeTimeMap={result.data.activeTimeMap}
    />
  );
}
