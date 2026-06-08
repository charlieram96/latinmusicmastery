import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import {
  getScoreDocumentForClassItem,
  getScoreSectionsForClassItem,
} from '@/app/actions/playsense-studio';
import { StudioWorkspace } from './studio-workspace';
import { VideoSectionsWorkspace } from './video-sections-workspace';
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
    .select('id, title, item_type, video_url, video_duration_seconds, score_document_id')
    .eq('id', classItemId)
    .single();
  if (!classItem) notFound();

  // VIDEO lessons support MULTIPLE scored sections (each anchored at a different
  // point in the video). They're authored in their own sections workspace, which
  // handles the empty list itself — no page-level setup screen.
  if (classItem.item_type === 'VIDEO') {
    const sections = await getScoreSectionsForClassItem(classItemId);
    if (sections.error) notFound();
    return (
      <VideoSectionsWorkspace
        classItemId={classItemId}
        title={classItem.title}
        videoUrl={classItem.video_url}
        videoDurationSeconds={classItem.video_duration_seconds}
        initialSections={sections.data ?? []}
      />
    );
  }

  // EXERCISE items don't sync the score to the video — the demo plays through,
  // then the student plays the graded highway. Everything else uses video sync.
  const mode = classItem.item_type === 'EXERCISE' ? 'exercise' : 'video';

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
      owner={{ kind: 'classItem', classItemId }}
      mode={mode}
      title={classItem.title}
      videoUrl={classItem.video_url}
      scoreDocumentId={classItem.score_document_id}
      initialScore={result.data.scoreDocument.parsedScore}
      activeTimeMap={result.data.activeTimeMap}
      videoDurationSeconds={classItem.video_duration_seconds}
    />
  );
}
