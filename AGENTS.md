<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Platform visual rules
- Apply the same score heading to lessons, exercises, jam sessions and previews: centered title at the top; instrument/rhythm metadata on the left and composer/credit (default LMM) on the right; BPM immediately above the staff at the left, below the metadata.
- Every app-owned video surface uses the shared VideoWatermark at its lower right, scaled with the visible video picture (excluding letterbox/pillarbox bars), with subtle transparency and brand-colored glow. Preserve the supplied logo and keep branding non-interactive and clear of playback controls.
- Action controls use the established LMM brand colors.

- Keep the selected language consistent across server-rendered course content and client controls. Use authored language variants for descriptions and rich notes; never silently show English notes in Spanish mode. Preserve both variants when editing.

- Keep the floating score playback palette horizontal and rectangular (wide and low), with its own width rather than the narrow symbol-palette width. Keep time, measure, beat and BPM on one row when space allows.

- Keep each control label immediately beside its input or selector. Do not separate labels and their controls across a wide panel with justify-between. Keep related action buttons next to the fields they act on.
