'use client';
import { useStudioText } from '@/components/playsense-studio/studio/use-studio-text';

// PlaySense Studio — the app bar's quiet save status: a small, glow-free pip
// (mockup: 6px, no box-shadow — `.st-status-pip`'s own glow is for the sync
// status card, not this chrome-level readout) plus Saved / Saving… / Save
// failed · Retry. Shared by score-section-editor.tsx and studio-workspace.tsx
// (Task 10 fix round 1: the block was duplicated between the two) so the
// wording and pip modifiers live in exactly one place.
import type { StudioDraftApi } from './use-studio-draft';

export function SaveStatus({
  saveState,
  pending,
  flush,
}: {
  saveState: StudioDraftApi['saveState'];
  pending: boolean;
  flush: () => void | Promise<unknown>;
}) {
  const st = useStudioText();
  return (
    <span role="status" className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span
        className={`st-status-pip${saveState === 'error' ? ' bad' : pending || saveState === 'saving' ? ' warn' : ''}`}
        style={{ width: 6, height: 6, boxShadow: 'none' }}
      />
      {saveState === 'error' ? (
        <>
          {st("Save failed · ")}{st(' ')}
          <button type="button" className="underline" onClick={() => void flush()}>
            {st("Retry")}</button>
        </>
      ) : pending || saveState === 'saving' ? (
        st('Saving…')
      ) : (
        st('Saved')
      )}
    </span>
  );
}
