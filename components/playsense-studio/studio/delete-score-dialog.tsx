'use client';
import { useStudioText } from '@/components/playsense-studio/studio/use-studio-text';


import { useState, useTransition, type ComponentProps } from 'react';
import { useRouter } from 'next/navigation';
import { detachScoreFromClassItem } from '@/app/actions/playsense-studio';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

export function DeleteScoreDialog({ classItemId, beforeDelete, onCloseAutoFocus }: {
  classItemId: string;
  beforeDelete: () => Promise<{ error?: string }>;
  onCloseAutoFocus?: ComponentProps<typeof DialogContent>['onCloseAutoFocus'];
}) {
  const st = useStudioText();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const remove = () => startTransition(async () => {
    setError(null);
    try {
      const saved = await beforeDelete();
      if (saved.error) { setError(saved.error); return; }
      const result = await detachScoreFromClassItem(classItemId);
      if (result.error) { setError(result.error); return; }
      setOpen(false);
      router.refresh();
    } catch {
      setError('Could not delete the score. Please try again.');
    }
  });

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!pending) { setOpen(value); setError(null); } }}>
      <DialogTrigger asChild>
        <button type="button" className="st-mpop-item text-destructive">{st("Delete score")}</button>
      </DialogTrigger>
      <DialogContent onCloseAutoFocus={onCloseAutoFocus} showCloseButton={!pending}>
        <DialogHeader>
          <DialogTitle>{st("Delete score?")}</DialogTitle>
          <DialogDescription>
            {st("This removes the score from this lesson immediately, including its score synchronization and unpublished score changes. The video and backing tracks stay in place.")}</DialogDescription>
        </DialogHeader>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" disabled={pending} onClick={() => setOpen(false)}>{st("Cancel")}</Button>
          <Button variant="destructive" disabled={pending} onClick={remove}>{st(pending ? 'Deleting…' : 'Delete score')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
