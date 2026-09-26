import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getScoreDocumentForSong } from '@/app/actions/playsense-studio';
import { getStudioDrafts } from '@/app/actions/studio-drafts';
import { StudioWorkspace } from '../../[classItemId]/studio-workspace';

interface PageProps {
  params: Promise<{ songId: string }>;
}

export const dynamic = 'force-dynamic';

export default async function PlaysenseStudioSongPage({ params }: PageProps) {
  const { songId } = await params;
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

  const result = await getScoreDocumentForSong(songId);
  if (!result.data) notFound();

  const { scoreDocument, song } = result.data;

  const drafts = await getStudioDrafts([{ kind: 'song', id: song.id }]);
  // A draft-load error must not open the Studio on live: the next edit would
  // autosave over the unseen draft, and Publish would push live-plus-edit.
  // Same handling as the class item Studio's sections path.
  if (drafts.error) notFound();

  return (
    <StudioWorkspace
      // Songs are always score-backed (created with a blank score) and never have
      // a video — fixed-BPM authoring only, no time map.
      key={scoreDocument.id}
      owner={{
        kind: 'song',
        songId: song.id,
        difficulty: song.difficulty,
        isPublished: song.isPublished,
        trackIndex: song.trackIndex,
      }}
      title={song.title}
      videoUrl={null}
      scoreDocumentId={scoreDocument.id}
      initialScore={scoreDocument.parsedScore}
      activeTimeMap={null}
      videoDurationSeconds={null}
      studioDraft={drafts.data?.[`song:${song.id}`] ?? null}
    />
  );
}
