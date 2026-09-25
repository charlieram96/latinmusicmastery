'use client';

// PlaySense Studio — note-duration glyphs shared by the Insert toolbar and the
// measure zoom's floating note toolbar. Unicode music glyphs (𝅝, 𝅗𝅥, 𝅘𝅥𝅯…) are
// tofu in most system fonts, so this draws its own SVG noteheads/stems/flags.

export function NoteIcon({ durationQN }: { durationQN: number }) {
  const hollow = durationQN >= 2; // whole + half
  const stem = durationQN < 4;
  // 0.5 → 1 flag, 0.25 → 2 … 0.03125 → 5.
  const flags = durationQN <= 0.5 ? Math.round(Math.log2(0.5 / durationQN)) + 1 : 0;
  return (
    <svg viewBox="0 0 16 22" width="13" height="19" aria-hidden focusable="false">
      <ellipse
        cx="6"
        cy="17.6"
        rx="4.3"
        ry="3"
        transform="rotate(-18 6 17.6)"
        fill={hollow ? 'none' : 'currentColor'}
        stroke="currentColor"
        strokeWidth="1.5"
      />
      {stem && <rect x="9.5" y="2.5" width="1.4" height="15" rx="0.7" fill="currentColor" />}
      {Array.from({ length: flags }, (_, i) => (
        <path
          key={i}
          d={`M10.9 ${2.8 + i * 2.6} c3.2 1.5 3.7 3.2 2.5 5.6`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}
