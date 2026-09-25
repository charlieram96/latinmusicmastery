import { cn } from '@/lib/utils';

export function UnpublishedDot({ className }: { className?: string }) {
  return <span className={cn('st-unpub-dot', className)} role="img" aria-label="Unpublished changes" />;
}
