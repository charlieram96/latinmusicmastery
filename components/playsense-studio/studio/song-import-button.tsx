'use client';

import { useRef } from 'react';
import { useRouter } from 'next/navigation';
import { FileUp } from 'lucide-react';
import { createSongFromImport } from '@/app/actions/playsense-studio';
import { Button } from '@/components/ui/button';
import { ScoreImportDialog } from './score-import-dialog';

/** The same reviewed import flow as course scores, saved as an unpublished song. */
export function SongImportButton() {
  const router = useRouter();
  const destinationRef = useRef<string | null>(null);
  return <ScoreImportDialog
    classItemId=""
    mode="fresh"
    trigger={<Button variant="outline"><FileUp className="mr-2 h-4 w-4" />Import score</Button>}
    onConfirm={async scoreDocument => {
      const result = await createSongFromImport({ scoreDocument });
      if (result.error) return { error: result.error };
      if (!result.songId) return { error: 'The song could not be created. Please try again.' };
      destinationRef.current = `/admin/playsense-studio/song/${result.songId}`;
      return {};
    }}
    onImported={() => {
      if (destinationRef.current) router.push(destinationRef.current);
      else router.refresh();
    }}
  />;
}
