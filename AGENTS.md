<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Platform visual rules
- Every user-facing video player must expose mouse/touch click-and-drag seeking (and keyboard access), in both authoring and student views. Preserve playback/paused state when seeking and update annotations, round counters and synchronized score from the resulting media time. Decorative background loops and hidden clock media use their owning surface's controls rather than redundant native controls.
- Treat the user's general UI instructions as platform-wide requirements: implement them in shared components and check equivalent desktop/mobile, admin/student and preview surfaces. Do not restrict a general correction to the screenshot or one instrument; keep content-specific timing and geometry scoped to the appropriate content.
- Keep the shared language selector accessible in every application shell, including admin/PlaySense on desktop and mobile; new player views must retain access to it and follow the platform locale.
- Apply the same score heading to lessons, exercises, jam sessions and previews: centered title at the top; instrument/rhythm metadata on the left and composer/credit (default LMM) on the right; BPM immediately above the staff at the left, below the metadata.
- Every app-owned video surface uses the shared VideoWatermark at its lower right, scaled with the visible video picture (excluding letterbox/pillarbox bars), with subtle transparency and brand-colored glow. Preserve the supplied logo and keep branding non-interactive and clear of playback controls.
- Action controls use the established LMM brand colors.

- Keep the selected language consistent across server-rendered course content and client controls. Use authored language variants for descriptions and rich notes; never silently show English notes in Spanish mode. Preserve both variants when editing.

- Keep the floating score playback palette horizontal and rectangular (wide and low), with its own width rather than the narrow symbol-palette width. Keep time, measure, beat and BPM on one row when space allows.

- Keep each control label immediately beside its input or selector. Do not separate labels and their controls across a wide panel with justify-between. Keep related action buttons next to the fields they act on.

## Exercise video presentation (user preference)
- Treat these as a flexible creative direction, not identical effects/copy/timing for every video. Adapt tips, animations, technique markers and repetition counts to the particular exercise. The shared presentation principles are: show the exercise title before the preparation countdown, concise tips for precision/timing/control during playback, a clear last-round notice at the start of the actual final round, and a motivating completion card.
- Use established brand colors, modern restrained animations, the shared VideoWatermark, reduced-motion support, and controls for pausing/replaying and hiding technique annotations. Keep guidance out of the hands and playback controls.
- Technique arrows must be authored for the particular video, hand and timing; never apply the Sobao hand marker to unrelated instruments. Completion encouragement is not a measured performance grade.
- The initial local preview is “Cáscara con Sobao Simple”, class item 8965d41a-569b-4295-a449-afbcbbcb4fad, with left-hand Sobao guidance. This video contains five rounds, each two 4/4 measures; count rounds within the video using BPM and the confirmed first-beat anchor, without replaying the clip between rounds. Do not add a score until the user supplies it.
- Keep coaching cards brief with gaps between them. Do not stack a hand-technique label with a competing coaching card; keep picture-in-picture views unobstructed. Hide or relocate the round counter when a camera composition needs that space. Check camera cuts before timing technique arrows.

- For student-facing changes, complete and verify the same flow in the local student view as well as the authoring view before calling the work done. Share playback/effects logic and authored settings between the two; an editor-only preview does not complete a student-facing change. Keep work local unless publishing is explicitly requested.
