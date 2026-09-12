import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import {
  getExerciseMedia,
  getScoreDocumentForClassItem,
  getScoreSectionsForClassItem,
} from '@/app/actions/playsense-studio';
import { ExerciseStudio } from './exercise-studio';
import { StudioWorkspace } from './studio-workspace';
import { VideoSectionsWorkspace } from './video-sections-workspace';
import { StudioSetup } from '@/components/playsense-studio/studio/studio-setup';
import { adminStudioBackHref } from '@/lib/playsense-studio/admin-nav';

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
    .select(
      'id, title, item_type, video_url, video_duration_seconds, score_document_id, class:classes(section:course_sections(course_id))'
    )
    .eq('id', classItemId)
    .single();
  if (!classItem) notFound();

  // The Studio's back link returns to the owning course's overview page.
  const courseId = (classItem.class as { section: { course_id: string } | null } | null)?.section
    ?.course_id;
  const backHref = adminStudioBackHref(courseId);

  // VIDEO lessons support MULTIPLE scored sections (each anchored at a different
  // point in the video). They're authored in their own sections workspace, which
  // handles the empty list itself — no page-level setup screen.
  if (classItem.item_type === 'VIDEO') {
    const sections = await getScoreSectionsForClassItem(classItemId);
    if (sections.error) notFound();
    return (
      <VideoSectionsWorkspace
        classItemId={classItemId}
        backHref={backHref}
        title={classItem.title}
        videoUrl={classItem.video_url}
        videoDurationSeconds={classItem.video_duration_seconds}
        initialSections={sections.data ?? []}
      />
    );
  }

  // EXERCISE items have TWO parts: scored sections synced to the demo video
  // (the student's Watch & Learn) and a separate graded score for the rhythm
  // highway. ExerciseStudio shells both workspaces behind a part toggle.
  if (classItem.item_type === 'EXERCISE') {
    const sections = await getScoreSectionsForClassItem(classItemId);
    if (sections.error) notFound();
    const scoreResult = classItem.score_document_id
      ? await getScoreDocumentForClassItem(classItemId)
      : null;
    const exerciseMedia = (await getExerciseMedia(classItemId)).data ?? {
      videoUrl: null,
      videoStartSeconds: 0,
      timeMap: null,
      backingTracks: [],
    };
    return (
      <ExerciseStudio
        // Remount when the graded score is attached/replaced, so the editor
        // reseeds from the new document instead of keeping stale state.
        key={classItem.score_document_id ?? 'no-score'}
        classItemId={classItemId}
        backHref={backHref}
        title={classItem.title}
        videoUrl={classItem.video_url}
        videoDurationSeconds={classItem.video_duration_seconds}
        initialSections={sections.data ?? []}
        scoreDocumentId={classItem.score_document_id}
        initialScore={scoreResult?.data?.scoreDocument.parsedScore ?? null}
        activeTimeMap={scoreResult?.data?.activeTimeMap ?? null}
        initialExerciseMedia={exerciseMedia}
        // Bound server actions — ExerciseStudio must not import the actions
        // module itself (deadlocks the Turbopack production build; see its note).
        fetchSections={getScoreSectionsForClassItem.bind(null, classItemId)}
        fetchExercise={getScoreDocumentForClassItem.bind(null, classItemId)}
        fetchExerciseMedia={getExerciseMedia.bind(null, classItemId)}
      />
    );
  }

  // No score yet → setup (import/create) lives here in the Studio.
  if (!classItem.score_document_id) {
    return (
      <StudioSetup classItemId={classItemId} classItemTitle={classItem.title} backHref={backHref} />
    );
  }

  const result = await getScoreDocumentForClassItem(classItemId);
  if (!result.data) notFound();

  return (
    <StudioWorkspace
      // Remount when the attached score changes (e.g. after Replace), so the
      // editor reseeds from the new document instead of keeping stale state.
      key={classItem.score_document_id}
      owner={{ kind: 'classItem', classItemId }}
      backHref={backHref}
      mode="video"
      title={classItem.title}
      videoUrl={classItem.video_url}
      scoreDocumentId={classItem.score_document_id}
      initialScore={result.data.scoreDocument.parsedScore}
      activeTimeMap={result.data.activeTimeMap}
      videoDurationSeconds={classItem.video_duration_seconds}
    />
  );
}
