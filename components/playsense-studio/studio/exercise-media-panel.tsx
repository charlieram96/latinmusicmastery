'use client';

// EXERCISE play-part media panel (studio left rail).
//
// Two cards: the optional exercise video (uploaded here, cropped with a start
// offset — the visible window is exactly the score's fixed-BPM length) and the
// instrument backing tracks students choose from before playing. Tracks are
// equal-length, pre-synced files; only label + order are editable.
//
// Lives in components/ (NOT the studio route dir) so it can import the server
// actions directly without tripping the known Turbopack build deadlock.

import { Loader2, Music2, Plus, Trash2, Video as VideoIcon, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  addBackingTrack,
  deleteBackingTrack,
  updateBackingTrackLabel,
  updateExerciseVideo,
  type BackingTrack,
  type ExerciseMedia,
} from '@/app/actions/playsense-studio';
import { cropWindow } from '@/lib/play-sense/exercise-media';

export interface ExerciseMediaPanelProps {
  classItemId: string;
  /** The graded score's length at its own tempo — the crop window's size. */
  scoreLengthSeconds: number;
  initialMedia: ExerciseMedia;
}

const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
const AUDIO_TYPES = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/mp4', 'audio/x-m4a'];

export function ExerciseMediaPanel({
  classItemId,
  scoreLengthSeconds,
  initialMedia,
}: ExerciseMediaPanelProps) {
  const [videoUrl, setVideoUrl] = useState(initialMedia.videoUrl);
  const [startSeconds, setStartSeconds] = useState(initialMedia.videoStartSeconds);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [tracks, setTracks] = useState<BackingTrack[]>(initialMedia.backingTracks);
  const [videoUploading, setVideoUploading] = useState(false);
  const [audioUploading, setAudioUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const videoInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLVideoElement>(null);

  const crop = useMemo(
    () => cropWindow(videoDuration, scoreLengthSeconds, startSeconds),
    [videoDuration, scoreLengthSeconds, startSeconds]
  );

  // Persist crop-start edits, debounced so slider drags don't spam the server.
  const cropSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setCropStart = (next: number) => {
    setStartSeconds(next);
    if (previewRef.current) previewRef.current.currentTime = next;
    if (cropSaveTimer.current) clearTimeout(cropSaveTimer.current);
    const url = videoUrl;
    if (!url) return;
    cropSaveTimer.current = setTimeout(() => {
      void updateExerciseVideo({ classItemId, videoUrl: url, startSeconds: next }).then((r) => {
        if (r.error) setError(r.error);
      });
    }, 500);
  };
  useEffect(() => () => {
    if (cropSaveTimer.current) clearTimeout(cropSaveTimer.current);
  }, []);

  const uploadTo = async (bucket: string, file: File): Promise<string> => {
    const supabase = createClient();
    const ext = file.name.split('.').pop();
    const fileName = `${classItemId}-exercise-${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(fileName, file, { cacheControl: '3600', upsert: true });
    if (uploadError) throw uploadError;
    const {
      data: { publicUrl },
    } = supabase.storage.from(bucket).getPublicUrl(fileName);
    return publicUrl;
  };

  const onVideoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!VIDEO_TYPES.includes(file.type)) {
      setError('Use an MP4, WebM, or MOV video.');
      return;
    }
    if (file.size > 500 * 1024 * 1024) {
      setError('Video must be less than 500MB.');
      return;
    }
    setError(null);
    setVideoUploading(true);
    try {
      const url = await uploadTo('course-videos', file);
      const result = await updateExerciseVideo({ classItemId, videoUrl: url, startSeconds: 0 });
      if (result.error) throw new Error(result.error);
      setVideoUrl(url);
      setStartSeconds(0);
      setVideoDuration(null); // re-read from the new file's metadata
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Video upload failed.');
    } finally {
      setVideoUploading(false);
      if (videoInputRef.current) videoInputRef.current.value = '';
    }
  };

  const removeVideo = async () => {
    setError(null);
    const result = await updateExerciseVideo({ classItemId, videoUrl: null, startSeconds: 0 });
    if (result.error) {
      setError(result.error);
      return;
    }
    setVideoUrl(null);
    setStartSeconds(0);
    setVideoDuration(null);
  };

  const onAudioFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!AUDIO_TYPES.includes(file.type)) {
      setError('Use an MP3, WAV, OGG, or WebM audio file.');
      return;
    }
    if (file.size > 100 * 1024 * 1024) {
      setError('Audio must be less than 100MB.');
      return;
    }
    setError(null);
    setAudioUploading(true);
    try {
      const url = await uploadTo('play-sense-audio', file);
      const label = file.name.replace(/\.[^.]+$/, '');
      const result = await addBackingTrack({ classItemId, label, audioUrl: url });
      if (result.error || !result.data) throw new Error(result.error ?? 'Save failed');
      setTracks((prev) => [...prev, result.data!]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Audio upload failed.');
    } finally {
      setAudioUploading(false);
      if (audioInputRef.current) audioInputRef.current.value = '';
    }
  };

  const removeTrack = async (trackId: string) => {
    setError(null);
    const result = await deleteBackingTrack({ trackId });
    if (result.error) {
      setError(result.error);
      return;
    }
    setTracks((prev) => prev.filter((t) => t.id !== trackId));
  };

  const renameTrack = (trackId: string, label: string) => {
    setTracks((prev) => prev.map((t) => (t.id === trackId ? { ...t, label } : t)));
  };
  const persistTrackLabel = (trackId: string, label: string) => {
    void updateBackingTrackLabel({ trackId, label }).then((r) => {
      if (r.error) setError(r.error);
    });
  };

  return (
    <div className="flex flex-col gap-3">
      {/* ---- Exercise video ---- */}
      <div className="st-icard">
        <span className="st-sec-label">Exercise video</span>
        {videoUrl ? (
          <>
            <video
              ref={previewRef}
              src={videoUrl}
              controls
              playsInline
              preload="metadata"
              muted
              className="w-full rounded-md bg-black"
              onLoadedMetadata={(e) => setVideoDuration(e.currentTarget.duration || null)}
            />
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Crop start</span>
                <span className="font-mono tabular-nums text-foreground">
                  {formatSeconds(crop.start)} – {formatSeconds(crop.end)}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={crop.maxStart ?? Math.max(0, startSeconds)}
                step={0.1}
                value={crop.start}
                disabled={crop.maxStart === 0 || crop.maxStart === null}
                onChange={(e) => setCropStart(Number(e.target.value))}
                className="w-full"
                aria-label="Crop start"
              />
              <p className="text-[11px] leading-snug text-muted-foreground">
                {crop.maxStart === null
                  ? 'Loading video length…'
                  : crop.maxStart === 0
                    ? 'Video is not longer than the score — it plays from the top.'
                    : `Window length = score length (${formatSeconds(scoreLengthSeconds)}).`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void removeVideo()}
              className="inline-flex items-center justify-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs transition hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
            >
              <X className="h-3.5 w-3.5" />
              Remove video
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => videoInputRef.current?.click()}
              disabled={videoUploading}
              className="flex w-full flex-col items-center gap-1.5 rounded-md border-2 border-dashed border-border px-3 py-5 text-center text-xs text-muted-foreground transition hover:border-primary/50 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
            >
              {videoUploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <VideoIcon className="h-4 w-4" />
              )}
              {videoUploading ? 'Uploading…' : 'Upload video (optional)'}
            </button>
            <p className="text-[11px] leading-snug text-muted-foreground">
              Plays muted beside the highway while the student is graded. You&apos;ll crop it to
              the score&apos;s length after uploading.
            </p>
          </>
        )}
        <input
          ref={videoInputRef}
          type="file"
          accept={VIDEO_TYPES.join(',')}
          onChange={(e) => void onVideoFile(e)}
          className="hidden"
        />
      </div>

      {/* ---- Backing tracks ---- */}
      <div className="st-icard">
        <span className="st-sec-label">Backing tracks</span>
        {tracks.length === 0 && (
          <p className="text-[11px] leading-snug text-muted-foreground">
            Optional instrument mixes the student can choose to play along with. Upload files of
            the same length, already in sync with the notes.
          </p>
        )}
        {tracks.map((t) => (
          <div key={t.id} className="space-y-1.5 rounded-md border border-border p-2">
            <div className="flex items-center gap-1.5">
              <Music2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <input
                value={t.label}
                onChange={(e) => renameTrack(t.id, e.target.value)}
                onBlur={(e) => persistTrackLabel(t.id, e.target.value)}
                className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 text-xs transition focus:border-border focus:bg-card focus:outline-none"
                aria-label="Backing track label"
              />
              <button
                type="button"
                onClick={() => void removeTrack(t.id)}
                className="rounded p-1 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                title="Delete this backing track"
                aria-label="Delete backing track"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <audio src={t.audioUrl} controls preload="none" className="h-8 w-full" />
          </div>
        ))}
        <button
          type="button"
          onClick={() => audioInputRef.current?.click()}
          disabled={audioUploading}
          className="inline-flex items-center justify-center gap-1.5 rounded-md border border-dashed border-border px-2.5 py-1.5 text-xs text-muted-foreground transition hover:border-primary/50 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
        >
          {audioUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          {audioUploading ? 'Uploading…' : 'Add backing track'}
        </button>
        <input
          ref={audioInputRef}
          type="file"
          accept={AUDIO_TYPES.join(',')}
          onChange={(e) => void onAudioFile(e)}
          className="hidden"
        />
      </div>

      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function formatSeconds(seconds: number): string {
  const s = Math.max(0, seconds);
  const m = Math.floor(s / 60);
  const rest = s - m * 60;
  return `${m}:${rest.toFixed(1).padStart(4, '0')}`;
}
