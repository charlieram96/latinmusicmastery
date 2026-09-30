import { useStudioText } from '@/components/playsense-studio/studio/use-studio-text';
import { cn } from '@/lib/utils';

export function UnpublishedDot({ className }: { className?: string }) {
  const st = useStudioText();
  return <span className={cn('st-unpub-dot', className)} role="img" aria-label={st("Unpublished changes")} />;
}
