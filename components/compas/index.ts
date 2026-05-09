// Compás — custom Soundslice replacement.
// See plan: /Users/charlieramirez/.claude/plans/take-a-long-and-streamed-breeze.md
//
// Subsystems:
//   - player/    student-facing video + notation player
//   - editor/    admin notation authoring + sync tools
//   - shared/    score model, time-map abstraction, audio engine
//
// Each subsystem lands with its milestone (M1 score model, M2 staff renderer,
// M3 player shell, M4 instrument renderers, M5 looping/clips, M6 import,
// M7 sync, M8 visual editor, M9 cutover). Until then, only the foundational
// types in shared/ are populated.
