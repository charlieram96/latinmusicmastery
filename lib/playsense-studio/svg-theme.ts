// PlaySense Studio — make VexFlow's SVG follow the active theme.
//
// VexFlow renders with explicit black `fill` and `stroke` attributes on its
// elements. To make the rendered notation track the user's light/dark mode,
// we walk the freshly-mounted SVG once and rewrite those black attributes to
// `currentColor`. Combined with a wrapper element that sets
// `color: hsl(var(--playsense-studio-notation))`, this gives us automatic theme support
// without re-rendering the score on theme change.
//
// We treat any color matching black or near-black (#000, #000000, "black",
// "rgb(0,0,0)") as a candidate. We leave non-black colors alone so explicit
// brand-color highlights (which we apply intentionally) survive.

const BLACK_TOKENS = new Set<string>([
  '#000',
  '#000000',
  'black',
  'rgb(0,0,0)',
  'rgb(0, 0, 0)',
]);

function isBlack(value: string | null): boolean {
  if (!value) return false;
  return BLACK_TOKENS.has(value.toLowerCase());
}

/**
 * Walk the SVG and replace any explicit black fill/stroke attributes with
 * `currentColor`, so the wrapper element's CSS color cascades into the
 * VexFlow output. Idempotent — safe to call multiple times.
 */
export function themeVexflowSvg(svg: SVGElement): void {
  for (const el of Array.from(svg.querySelectorAll('[fill]'))) {
    if (isBlack(el.getAttribute('fill'))) {
      el.setAttribute('fill', 'currentColor');
    }
  }
  for (const el of Array.from(svg.querySelectorAll('[stroke]'))) {
    if (isBlack(el.getAttribute('stroke'))) {
      el.setAttribute('stroke', 'currentColor');
    }
  }
}
