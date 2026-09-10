import { notFound } from 'next/navigation';
import { NotationPreview } from './notation-preview';
import { CONGA_TUMBAO_FIXTURE } from '@/lib/playsense-studio/score-fixtures';
import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';

/** Shared engraving in both lesson layouts, with no student data or playback writes. */
export default function NotationPreviewPage() {
  if (process.env.NODE_ENV !== 'development') notFound();
  const score: ScoreDocument = {
    ...CONGA_TUMBAO_FIXTURE,
    tracks: CONGA_TUMBAO_FIXTURE.tracks.map(track => ({ ...track,
      measures: Array.from({ length: 6 }, (_, i) => ({ ...track.measures[i % 2], number: i + 1,
        repeat: { id: 'notation-preview-repeat', length: 2, count: 3, pass: Math.floor(i / 2), offset: i % 2 },
      })),
    })),
  };
  return <NotationPreview score={score} />;
}
