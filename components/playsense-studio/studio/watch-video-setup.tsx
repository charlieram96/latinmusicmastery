'use client';
import { useStudioText } from '@/components/playsense-studio/studio/use-studio-text';


// EXERCISE Watch-part setup — shown when the lesson has no demo video yet.
// Upload one here (same course-videos bucket the class-item editor uses), read
// its duration client-side, persist via updateClassItemVideo, then refresh into
// the sections workspace where scored sections get synced to it.
//
// Lives in components/ (NOT the studio route dir) so it can import the server
// action directly without tripping the known Turbopack build deadlock.

import { ArrowLeft, Loader2, MonitorPlay, Upload } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { updateClassItemVideo } from '@/app/actions/playsense-studio';

export interface WatchVideoSetupProps {
  classItemId: string;
  classItemTitle: string;
  /** Extra header content (the exercise Watch/Exercise part toggle). */
  appBarExtra?: React.ReactNode;
}

const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];

/** Read a video file's duration from its metadata via a detached element. */
function readVideoDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const probe = document.createElement('video');
    probe.preload = 'metadata';
    probe.onloadedmetadata = () => {
      const d = probe.duration;
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(d) ? d : null);
    };
    probe.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    probe.src = url;
  });
}

export function WatchVideoSetup({ classItemId, classItemTitle, appBarExtra }: WatchVideoSetupProps) {
  const st = useStudioText();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!VIDEO_TYPES.includes(file.type)) {
      setError('Use an MP4, WebM, or MOV video.');
      return;
    }
    if (file.size > 1024 * 1024 * 1024) {
      setError('Video must be less than 1GB.');
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const supabase = createClient();
      const ext = file.name.split('.').pop();
      const fileName = `${classItemId}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('course-videos')
        .upload(fileName, file, { cacheControl: '3600', upsert: true });
      if (uploadError) throw uploadError;
      const {
        data: { publicUrl },
      } = supabase.storage.from('course-videos').getPublicUrl(fileName);

      const duration = await readVideoDuration(file);
      const result = await updateClassItemVideo({
        classItemId,
        videoUrl: publicUrl,
        videoDurationSeconds: duration,
      });
      if (result.error) throw new Error(result.error);
      // Reload the page props — the studio re-enters with the video attached.
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Video upload failed.');
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-card px-6 py-3">
        <Link
          href="/admin/courses"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {st("Admin")}</Link>
        <span className="text-muted-foreground">/</span>
        <h1 className="text-base font-semibold">{st("PlaySense Studio — ")}{classItemTitle}</h1>
        {appBarExtra && <div className="ml-2">{appBarExtra}</div>}
      </header>

      <main className="mx-auto max-w-2xl px-6 py-10">
        <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold">
          <MonitorPlay className="h-5 w-5 text-muted-foreground" />
          {st("Add the demo video")}</h2>
        <p className="mb-5 text-sm text-muted-foreground">
          {st("The Watch part is the instructor&apos;s demo. Upload the video here, then sync scored sections to it — exactly like a video lesson. Students watch it before playing the graded exercise.")}</p>

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="block w-full cursor-pointer rounded-lg border-2 border-dashed border-border px-6 py-10 text-center transition hover:border-primary/50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <div className="flex flex-col items-center gap-2 text-sm">
            {uploading ? (
              <>
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="font-medium">{st("Uploading video…")}</span>
              </>
            ) : (
              <>
                <Upload className="h-6 w-6 text-muted-foreground" />
                <span className="font-medium">{st("Upload the demo video")}</span>
                <span className="text-xs text-muted-foreground">{st("MP4, WebM, or MOV (max 1GB)")}</span>
              </>
            )}
          </div>
        </button>

        <input
          ref={inputRef}
          type="file"
          accept={VIDEO_TYPES.join(',')}
          onChange={(e) => void onFile(e)}
          className="hidden"
        />

        {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
      </main>
    </div>
  );
}
