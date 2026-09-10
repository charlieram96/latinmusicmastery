import { interludeProgress } from '@/lib/playsense-studio/lesson-notation';

/** A quiet video-time segment in the score, independent of VexFlow's ink theme. */
export function createNotationInterlude(parent: HTMLElement, options: {
  kind: 'leading' | 'trailing'; x: number; y: number; width: number; height: number; staffHeight: number;
  startMs: number; durationMs: number; detail: string;
}) {
  const segment = document.createElement('section');
  segment.className = 'ps-notation-interlude';
  segment.dataset.scoreInterlude = options.kind;
  segment.dataset.compact = String(options.staffHeight < 40);
  segment.setAttribute('aria-label', options.kind === 'leading' ? 'Before the score' : 'Video interlude');
  segment.title = options.detail;
  Object.assign(segment.style, {
    left: `${options.x}px`, top: `${options.y}px`, width: `${options.width}px`, height: `${options.height}px`,
  });
  const elapsed = document.createElement('span');
  elapsed.className = 'ps-interlude-elapsed';
  elapsed.setAttribute('aria-hidden', 'true');
  // SVG gives the dots consistent spacing at every notation zoom level.
  const NS = 'http://www.w3.org/2000/svg';
  const outline = document.createElementNS(NS, 'svg');
  outline.setAttribute('class', 'ps-interlude-outline');
  outline.setAttribute('viewBox', `0 0 ${options.width} ${options.height}`);
  outline.setAttribute('aria-hidden', 'true');
  const frame = document.createElementNS(NS, 'rect');
  frame.setAttribute('x', '.5');
  frame.setAttribute('y', '.5');
  frame.setAttribute('width', `${Math.max(0, options.width - 1)}`);
  frame.setAttribute('height', `${Math.max(0, options.height - 1)}`);
  frame.setAttribute('rx', '4');
  frame.setAttribute('fill', 'none');
  outline.appendChild(frame);
  const staff = document.createElement('span');
  staff.className = 'ps-interlude-staff';
  staff.setAttribute('aria-hidden', 'true');
  staff.style.height = `${options.staffHeight}px`;
  for (let line = 0; line < 5; line++) {
    const rule = document.createElement('i');
    rule.style.top = `${line * 25}%`;
    staff.appendChild(rule);
  }
  const label = document.createElement('span');
  label.className = 'ps-interlude-label';
  label.textContent = options.kind === 'leading' ? 'Intro' : 'Video';
  const remaining = document.createElement('span');
  remaining.className = 'ps-interlude-countdown';
  const playhead = document.createElement('i');
  playhead.className = 'ps-interlude-playhead';
  playhead.setAttribute('aria-hidden', 'true');
  segment.append(elapsed, staff, outline, label, remaining, playhead);
  // Video time is not a selectable musical beat.
  segment.addEventListener('pointerdown', event => event.stopPropagation());
  segment.addEventListener('pointermove', event => event.stopPropagation());
  if (options.kind === 'leading') parent.prepend(segment);
  else parent.appendChild(segment);
  return { update(ms: number) {
    const { remaining: value, progress } = interludeProgress(ms, options.startMs, options.durationMs);
    const state = ms < options.startMs ? 'upcoming' : progress >= 1 ? 'completed' : 'active';
    if (segment.dataset.state !== state) segment.dataset.state = state;
    if (remaining.textContent !== value) {
      remaining.textContent = value;
      remaining.setAttribute('aria-label', `${value} remaining`);
    }
    segment.style.setProperty('--interlude-progress', `${progress * 100}%`);
  } };
}
