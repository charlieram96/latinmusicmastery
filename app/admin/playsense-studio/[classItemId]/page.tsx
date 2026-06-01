import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getScoreDocumentForClassItem } from '@/app/actions/playsense-studio';
import { StudioWorkspace } from './studio-workspace';
import { StudioSetup } from '@/components/playsense-studio/studio/studio-setup';

interface PageProps {
  params: Promise<{ classItemId: string }>;
}

export const dynamic = 'force-dynamic';

export default async function PlaysenseStudioPage({ params }: PageProps) {
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
    .select('id, title, video_url, video_duration_seconds, score_document_id')
    .eq('id', classItemId)
    .single();
  if (!classItem) notFound();

  // No score yet → setup (import/create) lives here in the Studio.
  if (!classItem.score_document_id) {
    return <StudioSetup classItemId={classItemId} classItemTitle={classItem.title} />;
  }

  const result = await getScoreDocumentForClassItem(classItemId);
  if (!result.data) notFound();

  return (
    <StudioWorkspace
      // Remount when the attached score changes (e.g. after Replace), so the
      // editor reseeds from the new document instead of keeping stale state.
      key={classItem.score_document_id}
      classItemId={classItemId}
      classItemTitle={classItem.title}
      videoUrl={classItem.video_url}
      scoreDocumentId={classItem.score_document_id}
      initialScore={result.data.scoreDocument.parsedScore}
      activeTimeMap={result.data.activeTimeMap}
      videoDurationSeconds={classItem.video_duration_seconds}
    />
  );
}
