'use client';

// PlaySense Studio clips panel — saved A/B ranges per user, per class item.
//
// Renders below the player. Save flow: name + current A/B + rate, validates,
// inserts via server action. Load flow: click a clip to apply its loop range
// (and rate) to the active clock. Delete flow: trash button per row.

import { useTranslation } from '@/components/language-provider';
import { studioText } from '@/lib/playsense-studio/i18n/text';
import { Bookmark, Plus, Repeat, Trash2 } from 'lucide-react';
import { useEffect, useState, useTransition } from 'react';
import {
  createClip,
  deleteClip,
  listClipsForClassItem,
  logPlaysenseStudioEvent,
  type PlaysenseStudioClip,
} from '@/app/actions/playsense-studio';

interface ClipsPanelProps {
  classItemId: string;
  loopA: number | null;
  loopB: number | null;
  playbackRate: number;
  onLoadClip: (clip: PlaysenseStudioClip) => void;
}

export function ClipsPanel({
  classItemId,
  loopA,
  loopB,
  playbackRate,
  onLoadClip,
}: ClipsPanelProps) {
  const { locale } = useTranslation();
  const st = (text: string) => studioText(text, locale);
  const [clips, setClips] = useState<PlaysenseStudioClip[]>([]);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    listClipsForClassItem(classItemId).then((result) => {
      if (cancelled) return;
      setIsLoading(false);
      if (result.error) {
        setError(result.error);
      } else {
        setClips(result.data ?? []);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [classItemId]);

  const canSave =
    loopA !== null &&
    loopB !== null &&
    loopB > loopA &&
    name.trim().length > 0 &&
    !isPending;

  const handleSave = () => {
    if (!canSave || loopA === null || loopB === null) return;
    setError(null);
    startTransition(async () => {
      const result = await createClip({
        classItemId,
        name: name.trim(),
        startSeconds: loopA,
        endSeconds: loopB,
        playbackRate,
      });
      if (result.error) {
        setError(result.error);
      } else if (result.data) {
        setClips((prev) => [result.data!, ...prev]);
        setName('');
        void logPlaysenseStudioEvent({
          eventType: 'playsense_studio_clip_saved',
          classItemId,
          metadata: {
            duration_seconds: result.data!.endSeconds - result.data!.startSeconds,
            playback_rate: result.data!.playbackRate,
          },
        });
      }
    });
  };

  const handleDelete = (clipId: string) => {
    startTransition(async () => {
      const result = await deleteClip(clipId);
      if (result.error) {
        setError(result.error);
      } else {
        setClips((prev) => prev.filter((c) => c.id !== clipId));
      }
    });
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Bookmark className="w-4 h-4 text-muted-foreground" />
        <h3 className="text-sm font-medium">{st('Saved clips')}</h3>
      </div>

      {/* Save form */}
      <div className="flex items-center gap-2 flex-wrap">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={
            loopA === null || loopB === null
              ? st('Set A/B on the transport bar first')
              : st('Name this clip')
          }
          disabled={loopA === null || loopB === null}
          className="flex-1 min-w-[180px] px-3 py-1.5 text-sm rounded-md border border-foreground/25 bg-background placeholder:text-muted-foreground disabled:cursor-not-allowed focus-visible:outline-none focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary/40"
          aria-label={st('Clip name')}
        />
        <span className="text-xs font-mono text-muted-foreground tabular-nums">
          {loopA !== null && loopB !== null
            ? `${formatSeconds(loopA)} → ${formatSeconds(loopB)} @ ${playbackRate}x`
            : '— → —'}
        </span>
        <button
          onClick={handleSave}
          disabled={!canSave}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          <Plus className="w-4 h-4" />
          {st('Save clip')}
        </button>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {/* Clip list */}
      {isLoading ? (
        <p className="text-xs text-muted-foreground">{st('Loading clips…')}</p>
      ) : clips.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {st('No clips yet. Set A and B on the transport, name it, and save.')}
        </p>
      ) : (
        <ul className="space-y-1.5">
          {clips.map((clip) => (
            <li
              key={clip.id}
              className="flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-card hover:bg-muted/40 transition"
            >
              <button
                onClick={() => onLoadClip(clip)}
                className="flex-1 text-left flex items-center gap-2 min-w-0"
              >
                <Repeat className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                <span className="truncate text-sm font-medium">{clip.name}</span>
                <span className="font-mono text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                  {formatSeconds(clip.startSeconds)} → {formatSeconds(clip.endSeconds)}
                  {clip.playbackRate !== 1 && ` · ${clip.playbackRate}x`}
                </span>
              </button>
              <button
                onClick={() => handleDelete(clip.id)}
                className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition"
                aria-label={st('Delete clip')}
                title={st('Delete clip')}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function formatSeconds(s: number): string {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const total = Math.floor(s);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
