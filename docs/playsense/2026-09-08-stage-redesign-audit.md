# PlaySense: 3D stage redesign and implementation audit

Scope: web lessons, standalone practice, and author previews. Native iOS is unchanged.

## Review the three directions

Open `/playsense-preview` on the local project server. The comparison uses the production 3D renderer with a separate demo transport. It never saves practice attempts. Each direction supports congas, timbales, and piano; the production renderer also derives lanes from the other existing instrument definitions.

| Direction | Visual treatment |
| --- | --- |
| Orbit | Cool concert lighting, open arches, illuminated runway, mint/violet/amber instruments and notes. |
| Voltage | Angular arcade gates, sculptural colored blocks, lime/pink/cyan lighting. |
| Afterhours | Courtyard band setting, large wooden congas, complete backline, warm lamps and cool night shadows. |

The scenes contain actual geometry: lathed drum shells, drumheads, hoops, tension rods, bell/pad assemblies, piano keys, runway chassis, notes, and impact particles. These are runtime meshes rather than background pictures. Appearance is selectable during playback. Practice and lesson appearance preferences are shared on the current device.

## Architecture

The application is Next.js with React. The previous production renderer was `glass-highway/GlassApp.ts` (PixiJS); an older perspective renderer and the old highway lab also remain in the repository. `StageHighway.tsx` now provides the shared production visual boundary. Practice, lesson exercises, and author previews import it directly. The old `GlassHighway` export is a compatibility alias; old lab tools remain available.

`StageRenderer.ts` owns Three.js, the GPU context, scene resources, viewport observation, bloom, instance buffers, and animation. It reads committed props and the session's audio clock; it does not decide whether a note was played correctly. `model.ts` maps authored event identities to instrument lanes, including repeated exercises and piano key geometry. `themes.ts` and `objects.ts` select environments; `afterhours.ts`, `instruments.ts`, and `craft.ts` author the courtyard, detailed instruments, materials, and geometry batching.

The session hook owns input selection, count-in, backing-track scheduling, matching, grading, and results. MIDI and microphone/prototype inputs use the same scoring timeline, while preserving their different information quality. MIDI notes are exact; microphone estimates keep the existing pitch tolerances.

## Afterhours refinement — selected direction

The follow-up adopts Afterhours as the default for the preview and for lesson/practice devices without an existing appearance preference. The supplied Afterlight reference informs the layered courtyard composition, material variation, warm/cool lighting, and grounded objects; it is not used as a flat background.

- Larger congas have custom curved stave profiles, seams, textured hide, rolled metal hoops, individual tuning hooks, and inset badges. Main piano keys have a wood-sided chassis, supports and pedals; keys depress on judgments. Timbales, bells and blocks have modeled hardware and floor-reaching supports.
- The custom band set includes a five-piece kit with shaped cymbals, keyboard, four-string bass, amplifiers, microphone stands, monitors, cable runs, rugs, potted plants, shuttered walls, arched windows, suspended lamps and a distant skyline.
- Lighting combines warm and cool sources, physical material reflections, a static shadow map, contact shadows, restrained bloom, atmospheric fog and custom light-shaft shaders. The performance camera and shorter visual runway preserve the same 3.5-second approach window and scoring timeline.
- The preview dedicates more space to the stage. **Explore the stage** provides a separate orbit/zoom view; returning to performance restores the fixed reading angle. Exploration is preview-only.
- Static geometry is merged by material so individual hardware pieces do not each require a draw call. The courtyard shadow is generated once. Demo resets now clear judgments with an attempt identifier instead of destroying/recreating the GPU scene.
- All new geometry and surface textures are authored in code. This is a procedural 3D art pass, not a set of externally sculpted or photogrammetry assets. A subsequent hero-asset pass can add sculpted silhouettes, painted wear and baked normal maps through the [Blender glTF export pipeline](https://docs.blender.org/manual/en/5.0/addons/import_export/scene_gltf2.html) and [Three.js GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html).

Follow-up checks: the 18 focused scene, scoring, input and mounted-session regression tests pass; TypeScript and targeted lint pass. Browser review covers congas, timbales, piano, camera switching, a 1280×800 laptop viewport and a 390×844 narrow viewport. No browser application errors were observed. The full suite results below belong to the initial implementation; physical hardware has not been tested in this visual refinement.

## Blender asset pass — 2026-09-09

Blender 5.2.1 LTS and Blender MCP 1.9.1 are installed locally. The MCP connection was verified with scene queries, asset creation, export, rendering, and add-on status. The MCP server is registered in Codex; telemetry is disabled in both the server environment and add-on preferences.

Five original Blender masters replace the foreground procedural congas and timbales in Afterhours: walnut quinto, honey oak conga, mahogany tumba, and two steel timbales. Custom staves, tensioned skins, machined crowns, lugs, threaded hooks, enamel badges and image textures are editable in `art/playsense/afterhours-instruments.blend`. The other scene assets retain the previous authored Three.js geometry.

The self-contained web collection is **2.46 MB**, down from approximately 29 MB before Draco geometry and WebP texture compression. A locally hosted decoder avoids a third-party runtime dependency. Loading is asynchronous with the existing procedural instruments as fallback; compatibility mode retains the lighter models. Abort handling, decoder cleanup and explicit ImageBitmap disposal cover scene changes. The scorer and input timeline are unchanged.

TypeScript, targeted lint, the production build and the exported-asset validation pass. Browser checks cover congas, timbales and repeated performance/explore transitions with no application errors observed. Modeling/re-export commands and asset budgets are documented in `scripts/blender/README.md`.

## Latin backline and rhythm effects — 2026-09-09

Afterhours now uses a Latin rehearsal-room arrangement: terracotta plaster, teal shutters, patterned ceramic runners, a custom Descarga print, freestanding acoustic screens, a larger four-string bass with a stand, keyboard, amplifiers and stage monitors. The generic five-piece drum kit has been removed. Conga exercises place a timbales rig with two mounted bells in the backing band; timbale exercises place a pair of congas there. Bass and keyboard remain in both scenes. Other instruments use the timbales backline. The same existing 2.46 MB Blender collection supplies the foreground and backing percussion; no additional model download is needed. Procedural fallbacks remain available while loading and in compatibility mode.

Notes have new beveled eight-sided chassis, raised luminous faces with per-lane emission, inlaid direction arrows, and fading ribbon tails. They are larger for percussion while piano notes retain their key alignment. Successful judgments trigger two bounded shockwaves, an upward light plume, elongated sparks, and instrument recoil. Misses retain a restrained red response. Side meters and warm/cool band lighting follow the exercise clock; successful hits add a short lighting accent. Reduced motion suppresses nonessential effects. The renderer still reads audio time directly and only reacts to actual scorer judgments. No scoring or input implementation changed in this pass.

Visual checks cover conga/timbale backline swaps, piano, wide and narrow viewports, and the orbit camera. The bass and keyboard are intentionally outside the central note path; narrow portrait layouts prioritize the playing surfaces and crop parts of the side band. Browser checks showed no application errors. TypeScript, targeted lint, the production build, and all 18 focused timing/input/session regressions passed. Physical input hardware was not exercised in this visual pass.

## Blender playfield and cozy studio — 2026-09-09

The Afterhours note geometry and board now come from a second original Blender collection. The board has an oiled walnut chassis, textured recessed fabric playing bed, stitched edges, brass hardware, side vents and trestle supports. Three modeled note components form each instanced note: a machined brass shell, faceted pearlescent enamel face, and luminous arrow/glints. The entrance is a three-layer illuminated wood arch over a recessed acoustic chamber with a brass sunburst medallion. Notes emerge through a soft animated light threshold. Blender-authored boucle seating, woven pendant lamps, pillows and small lounge objects accompany warmer, softer room lighting.

The new GLB is **0.84 MB** with six named masters, 2,928 triangles per complete note, embedded WebP color/normal/roughness maps and Draco geometry. The playfield loader validates all required roots before installation, retains immediate procedural fallback, aborts abandoned downloads and disposes detached results. Note components remain instanced and use the existing audio-clock positions and scorer judgments. All Afterhours instruments, including piano, use the authored note geometry. Compatibility mode and other themes retain their lighter procedural models. No scoring or input logic changed.

The source scene and review camera are saved in `art/playsense/afterhours-playfield.blend`; texture PNGs are editable separately. Export scripts now limit themselves to the active scene, preventing unrelated selected review objects from being exported. `validate_playfield.mjs` checks the scene selection, named roots, centered component pivots, lane bounds, required textures and budgets.

Verification: the production build, TypeScript, targeted lint, exported-asset validation, and all 18 focused timing/input/session tests pass. The Blender review render was inspected. Browser checks cover congas, timbales, piano, the narrow viewport, repeated scene transitions and the orbit camera without observed application errors. The default viewport and performance view are restored after review.

## Label, keyboard clearance and branding refinement — 2026-09-09

Instrument labels now use tightly cropped, high-contrast nameplates with lane-color dots. Their projected height stays compact and readable as the camera resizes or orbits, while lane-width bounds prevent adjacent tags from colliding. The backing keyboard moves outward and back to clear the wooden rail. The playable piano station moves forward and slightly lower to clear the board apron, with matching supports and a portrait-camera adjustment that keeps the complete keyboard visible. Visible studio branding, the appearance picker and preview copy now say PlaySense; internal asset paths and the persisted `studio` theme identifier stay compatible.

TypeScript, targeted lint and browser checks cover six timbale labels, conga labels, the separate piano station, and narrow-screen framing. Scoring and note timing are unchanged.

## Transparent lettering and a studio window — 2026-09-09

The instrument nameplates have been replaced with cream lettering and a fine lane-colored underline. The canvas is transparent, with only a subtle letter shadow for contrast. Projected sizing and lane-width bounds still keep the labels compact as the camera changes.

The dark arched chamber, sunburst and plaque have been removed from the Blender entrance master. Its replacement is a deep celadon window with walnut trim, brass casement details, gathered linen curtains and side shutters. Original tiled rooftops, balconies, illuminated windows and modeled palms occupy several depths beyond the frame; a packed dusk-sky gradient, moon and small stars complete the exterior. The note source has a lower, softer light spill so the view stays clear.

The updated collection is **1.04 MB**, within its 2 MB budget, and preserves all six masters and the existing 2,928-triangle note geometry. TypeScript, targeted lint and the asset validator pass. The updated Blender review render was inspected; browser checks cover congas, all six timbale labels and the separate piano station at desktop and phone widths, with no application warnings or errors observed. Scoring and input timing are unchanged.

## Quieter labels, clear branding and window movement — 2026-09-09

Instrument labels now use smaller regular-weight title case, a muted cream color, lower opacity and a shorter, fainter colored underline. The PlaySense wall sign has moved above the front window lintel, removing the overlap with the frame and deep reveal. On phone layouts it moves higher to clear the exercise title as well.

The existing Blender curtain meshes billow below fixed tops, palm fronds sway around stationary crowns, and soft cloud wisps drift through the dusk-sky material. GPU deformation updates the surface normals with the fabric and leaves. A shared ambient time uniform advances only while the stage is visible; it does not modify the exercise clock. Reduced motion bypasses the animation setup. Animated surfaces do not cast stale shadows into the static room shadow bake. There are no new models, texture downloads or per-frame geometry allocations.

TypeScript and targeted lint pass. Desktop and phone browser checks verify the unobstructed sign and subtle conga/timbale labels. The movement shaders compile successfully, with visible changes in the window while the note board is paused.

## Preview in the actual app — 2026-09-09

The authenticated local practice route now accepts `?preview=studio` in development only. It renders the actual `StagePlayer` within the dashboard navigation and header, using shared synthetic conga, timbale and piano phrases. A visible demo label distinguishes simulated performances. The showcase has its own silent animation clock and transport; it opens no input devices, produces no attempt statistics for persistence, and explicitly bypasses `saveAttempt`. The ordinary published-exercise route and production behavior are unchanged.

This preview was added because the current practice catalog returned no published exercises. The existing signed-in Chrome session displays the integrated player. TypeScript and targeted lint pass. Chrome reports extension-injected hydration attributes and MetaMask extension messages; these do not come from the PlaySense renderer.

## Studio scoreboard and shared results — 2026-09-09

The tall practice stats panel is replaced by a compact smoked-green display with a large score, gold combo count, ten small combo lights and a slim mint accuracy bar. Combo is explicitly labeled as notes played in a row. Unstarted attempts show a dash for score and accuracy. A brief accent marks ten-note milestones; continuous number pulsing is removed. The appearance preview and lesson highway use a horizontal version of the same component.

Practice and lessons now share one results card. A custom engraved SVG medallion displays the score out of 100 and the existing letter grade, with the existing star thresholds. Accuracy, best combo and perfect streak sit together above a note distribution with counts outside the colored segments. One next-take suggestion uses the actual missed-note, pitch, extra-hit or timing statistics. Optional timing details express offsets as early/late; the former tempo-drift field is accurately labeled as recent timing over the last eight attacks. Empty and all-miss attempts do not claim centered timing. Lesson retry and watch-demo actions are preserved.

The app retains the studio behind results. A focus-managed dialog supports keyboard navigation and Escape, and respects reduced motion. Score animation frames are canceled on unmount. Both previews offer View results; demo reviews use the current simulated statistics, stay paused for inspection, and retain the explicit save-attempt guard. Practice uses Choose exercise to accurately describe its existing selection action.

Verification: TypeScript, targeted lint and the production build pass. Desktop and phone visual checks cover the live scoreboard, medallion, metrics, distribution, actions, empty attempts and all-miss timing details. The integrated app review and retry flow were also verified. Mobile preview spacing keeps the score display clear of the room controls and sign. The preview has no observed browser errors, and the temporary viewport override is reset. No scoring formulas or input timing changed.

## Lesson video and score preview — 2026-09-09

In development, an authenticated lesson URL can use `?preview=exercise` to show its first published, synchronized video/notation section inside the actual exercise game. This supports reviewing the video, scrolling staff and 3D stage together while the current exercise catalog has no attached exercise videos. The preview derives the notes from the lesson score, repeats four passes, uses simulated judgments, keeps the instructor video muted and skips attempt persistence. It has a compact stage height to fit the lesson shell, plus replay and review controls. Normal lessons and production ignore the preview flag. Input devices are not opened.

The preview was visually checked with Basic Timbal Rhythm in Son. TypeScript and lint for the two affected components pass; route lint reports its pre-existing `any` declarations and image warning. No lesson content or scores were changed in the database.

## Immersive lesson exercise mode — 2026-09-09

Lesson exercises and the local lesson showcase now enter an immersive layout automatically. Dashboard navigation, the course sidebar, lesson heading/parts, prose and completion footer fold away, leaving a slim PlaySense toolbar, notation band, larger instructor reference video and a stage that fills the remaining browser viewport. Video and Score toggles let the student choose their reference panels. Lesson view or Escape restores the surrounding lesson without restarting the active performance. Watch demo returns to the lesson's instructional player when one is available.

The frame resizes the existing DOM tree in place rather than creating a second player or entering browser fullscreen. CSS is scoped to the mounted immersive exercise; navigating away restores the normal dashboard automatically. Sidebar preferences remain untouched. Input setup and results use the same frame, while transport statistics that duplicate the stage HUD are hidden. Input controls appear after the student chooses a source. Phone layouts preserve clearance around the scoreboard, video and PlaySense sign. Results remain scrollable; reduced-motion preferences are respected.

Verification: production build and TypeScript pass, with no new targeted lint errors (the existing transport component retains three unused-variable warnings). All five mounted session lifecycle tests pass. Browser review covers desktop and 390×844 layouts, video/score toggles, Escape, results/retry, the actual exercise input setup, and navigation restoration. Switching to lesson view preserved the running combo (34 → 36). Temporary viewport overrides were reset. The signed-in Chrome session still reports its pre-existing extension-injected hydration/MetaMask messages. No physical input device was opened and no preview attempt was saved.

## App design alignment — 2026-09-09

PlaySense chrome now consumes the application's Studio Amber theme tokens across lessons, practice and the comparison preview. Results use the LMM logo, Montserrat headings, an amber score ring, separate metric cards, a warm coaching panel and shared application buttons. The live score card uses the same surfaces, borders and primary color. The lesson toolbar, notation surroundings, transport, exercise list, preview controls and settings now follow the app's light and dark themes. Practice transport and exercise panels use the app's card corner treatment. Text directly over the 3D scene retains a stable light color for readability.

Removed local overrides of global `--border`, `--accent` and `--secondary` variables. These previously mixed complete CSS colors with the app's HSL channel tokens and could invalidate nested shared component colors. Stage aliases and preview variables are now namespaced. Low-specificity button resets preserve shared button styling. Raised the practice toolbar above the HUD so the settings menu is readable and operable.

Verification: final production build and TypeScript pass. Targeted ESLint reports no errors and the same three pre-existing unused-variable warnings in the transport component. Browser review covers dark/light lesson results and live cards, practice controls and settings, the in-app comparison preview, and 390×844 embedded/dialog results. Expanded timing details scroll and retry remains accessible; no horizontal overflow was observed at 390px. Restored dark mode and reset temporary viewport overrides. The in-app preview reports no console errors; Chrome retains its existing extension errors. This pass changes presentation only; preview save guards and scoring logic are preserved.

## Musical score redesign — 2026-09-09

The shared VexFlow player now presents a clean, numbered measure surface with app-theme borders, restrained amber active-measure and note/rest emphasis, a measure progress rail, and beat guides. The exercise score has its own compact toolbar: measure/pass position, beat pulse, continuous or measure-based following, and notation-size controls. The old cropped staff strip is replaced with a complete engraving area; pitch-aware vertical space keeps ledger notes clear of the beat guides. The same engraving also appears in the standard lesson player, including wrapped staves.

Exercise notation reads the live session clock on animation frames. Repeat projection applies to that clock as well as React time samples. Short phrases keep their opening clef and final bar visible. Final-note interpolation now stops at the barline using the actual duration, and enlarged measures can pan to keep their last notes on screen. The renderer uses notehead anchors, authored percussion clefs/cross noteheads, and articulations. A discovered accidental parsing bug is fixed: natural B no longer receives a flat sign. Read-only exercise scores no longer show a misleading seek/selection cursor.

A development-only `/playsense-preview/score` page uses the real exercise component with an eight-measure phrase so the new following behavior can be reviewed without signing in or saving an attempt. The existing lesson showcase remains available with video and score.

Verification: the final production build and TypeScript pass. All 31 timing, repeat and pitch regression tests pass, along with targeted lint checks (the pre-existing unused key-fifths parameter is unchanged). Browser review covers the immersive lesson, both follow modes, notation zoom, 390px layouts, standard wrapped notation in light mode, and melodic/chord/percussion fixtures. App dark mode and viewport sizes were restored. No attempt, clip, or authored score was saved. The signed-in Chrome session retains pre-existing navigation-translation and extension hydration messages; the refreshed standalone score preview renders without a runtime error.

## Correctness findings fixed

| Finding | Previous behavior | Change |
| --- | --- | --- |
| Input history rollover | The history was capped at 500 events, while the consumer used array length as a cursor. At capacity, new inputs could stop being graded. | Consume unseen event identities from the bounded history. A regression sends 1,500 inputs through a 500-entry window. |
| First downbeat | The first playing render discarded all existing onsets, including a valid first note. | Filter by the count-in boundary and actual tolerance window, retaining valid first-note input. |
| Premature visual misses | The Pixi note field could mark a note missed after 30 ms, before the beginner scoring window closed. | The new renderer only reacts to grades from the session. |
| Same-length corrections | Replacing a tentative miss with a hit did not increase array length, so the old visual bridge could miss the correction. | Diff by event index and grade, not result count. |
| MIDI support | No MIDI source was present in the web session. | Added Web MIDI input, note-on and velocity-zero note-off handling, hot-plug detection, recoverable errors, and input controls in both lesson and practice players. MIDI does not request microphone access. |
| Simultaneous hardware notes | At a shared timestamp, the first authored event could win even when another key or drum was played. | Choose the matching MIDI pitch or prototype drum surface among simultaneous events. |
| MIDI pitch rules | Microphone octave forgiveness would be inappropriate for exact MIDI notes. | MIDI grading uses the exact key and octave; a wrong key is a miss. Acoustic pitch tolerances remain separate. |
| Prototype packet batching | Scoring consumed React's latest-reading state, which could collapse multiple packets into one render. | The provider exposes a direct notification subscription. UI readings remain available separately. |
| Prototype delivery latency | The hook timestamped a reading when React processed it. | Convert the original hardware packet receipt time into the audio clock domain. This removes UI delivery delay, not firmware/radio latency. |
| Expensive duplicate pitch path | Pitched exercises could open a second microphone and run autocorrelation on the animation thread. | Reuse the same microphone stream and audio context, with the repository's existing MPM pitch AudioWorklet. A silent output keeps processing active without playing microphone audio. |
| Async score ordering | Deferred chord/pitch results could arrive after later notes; combo calculation followed arrival order. | Sort grades in musical time before publishing statistics. Live and final combos count graded notes consistently. |
| Stale finish callback | The animation callback could retain the initial finish callback and stop the wrong input source. | Keep the current finish function behind a ref. |
| Exercise replacement | Selecting another exercise could leave the old countdown, backing audio, or deferred grading alive. | Explicit cancellation releases input and clears timers/animation before selection or retry. |
| Repeated Play clicks | Repeated clicks during async input startup could schedule multiple count-ins. | Guard startup and invalidate abandoned asynchronous work with a generation counter. |
| Last-note grading | Ending precisely at the song duration could cancel pending analysis. | Allow a short final delivery/analysis grace period before generating results. |
| Calibration worklet handle | Starting calibration immediately after opening the mic could use a stale render's null worklet. | Read the current worklet handle after input startup. |
| Percussion pitch accuracy | `pitchCorrect: null` could count as failed pitch detection. | Only applicable boolean pitch judgments enter pitch accuracy; missed pitched notes are explicitly marked false. |
| Input selection | Persisted modes and mode-switch buttons could leave a new instrument on an unsupported source. | Centralize supported input choices, include MIDI in the cycle, clear incompatible choices, and prevent source changes mid-performance. |
| Misleading Stop icon | Practice used a pause icon for an action that ended the attempt. | Display a stop icon for that action. |

## Performance and resilience

- Three.js is loaded behind the client renderer boundary. Production callers bypass the legacy Pixi barrel exports.
- Notes use reusable instanced meshes. Capacity follows the densest visible time window rather than allocating an object for every note in the song.
- Binary search limits rendering work to the visible note window.
- Hit particles and expanding rings use bounded pools.
- The renderer reads audio time on each graphics frame. React progress updates are limited to approximately 30 Hz.
- Pixel density is capped. Sustained slow rendering disables bloom and lowers pixel density without changing scoring tolerances.
- Rendering is skipped for a hidden document or offscreen stage.
- Reduced-motion preferences remove particles and ambient motion; note travel remains because it is essential to gameplay.
- Resize observation refits the camera to the embedding container.
- Teardown releases animation callbacks, observers, meshes, materials, textures, render targets, and the graphics context.
- A graphics failure shows a visible compatibility-mode retry instead of an empty canvas.

Resource handling and instancing follow the [Three.js cleanup manual](https://threejs.org/manual/en/cleanup.html) and [InstancedMesh documentation](https://threejs.org/docs/pages/InstancedMesh.html).

## Verification

- Existing test suite plus 18 added regression tests: **1,065 tests passed across 103 test files** with the repository's current test discovery configuration (which includes tests in a nested existing worktree).
- New mounted React session tests cover MIDI startup without a microphone, first-chord scoring, early first notes, cancellation during count-in, automatic completion with the correct input source, retry, and duplicate-start prevention.
- Pure tests cover input rollover, timestamp conversion, MIDI messages, simultaneous drum/key matching, strict MIDI octaves, piano range, loop identities, visible-window lookup, and same-length grade corrections.
- Production build completed successfully. TypeScript validation completed successfully.
- Local browser checks exercised all three appearances, instrument switching, transport, manual mode and its controls, and help. No application console errors were observed in those checks.

## Remaining product decisions and hardware validation

1. **Vocal exercises need a dedicated product path.** The current exercise vocabulary has no `voice` instrument. The improved microphone pipeline supplies pitch, but this patch does not add a vocal curriculum, vocal score authoring, or continuous legato-note matching. Singing that changes pitch without a new onset needs a pitch-transition matcher and voice-specific thresholds.
2. **Prototype firmware semantics must be confirmed.** This implementation preserves the existing Bluetooth UUIDs, packet shape, and piezo-to-surface mappings. A positive piezo value currently means a hit. If the firmware sends continuously sampled levels, it needs explicit hit identifiers or agreed debouncing before those packets can be graded reliably. Device-origin timestamps/sequence numbers would allow radio-delay compensation and packet-loss accounting beyond host receipt timing.
3. **Physical device tests are still required.** No MIDI keyboard, microphone performance, or prototype session was recorded during this work. Verify permission flows, disconnect/reconnect, simultaneous notes, soft/hard hits, and measured latency using the intended hardware and target browsers. Browser MIDI availability varies; unsupported cases expose a recoverable input error.
4. **Sustain remains limited.** Existing grading emphasizes onset timing and pitch/surface. Duration reporting still uses an approximate signal-level model, and individual MIDI key releases/sustain-pedal events are not yet a separately weighted hold score. The visible piano tails communicate authored durations, not verified hold accuracy.
5. **Variable tempo/meter and multiple voices remain limitations of exercise conversion.** The score converter emits the primary voice and retains one initial tempo/time signature in the exercise definition. Mid-exercise tempo or meter changes need an explicit timing map before they can be claimed to stay synchronized. The current renderer follows the same generated timeline as scoring.
6. **Native iOS parity is a subsequent task.** The SpriteKit player has not been visually redesigned or updated with these web scoring fixes. Align shared scoring semantics before comparing web/iOS attempt results, especially strict MIDI behavior and pitch-accuracy applicability.

The changes are local and reviewable. No deployment, database migration, hardware protocol change, or saved student attempt was made by the comparison preview.

## Steady score reading and glass refinement — 2026-09-09

The immersive exercise now defaults to **Steady** reading. Whole phrases remain stationary until a measure boundary. Measures wider than the viewport advance at a visible beat, falling back to a note onset when a single beat is exceptionally dense. Planned offsets are looked up against the existing live score clock, so visual easing does not delay musical timing. Only a brief opacity transition accompanies a turn; reduced-motion preferences disable it. Continuous Flow remains available.

Horizontal engraving uses each measure's own density rather than stretching all bars to the widest bar. Short complete scores are centered. Zoom and resize rebuild the reading plan, while seeking and repetitions select the appropriate phrase directly. The conventional notation, authored note timing, repeat projection, and loop/seek interactions remain in use.

Removed the filled/outlined measure boxes and rectangular note focus. A small measure label and progress accent, a fine playhead, beat guides, and a restrained tint on the active note carry playback emphasis. The notation card uses a translucent surface, soft edge highlights, and background blur. The live score/combo card also uses real blur and a 70% opaque themed surface, with the studio visible through it. Light and dark colors continue to use the app's tokens.

Validation: 36 targeted notation/pitch/repeat/time-mapping tests pass, including five new steady-reading regressions for fixed phrases, wide bars, dense beats, resizing, seeks, repeats, and final holds. Targeted lint and production compilation/type validation pass. Browser review covers the eight-bar preview, the 220 BPM lesson with instructor video, light/dark themes, and a 390px viewport at 100% and 140% notation size. No horizontal page overflow was observed. Existing Chrome extension hydration/MetaMask messages are unrelated to the notation changes. Preview save guards remain in place; these checks do not record student attempts.

## Resizable side score — 2026-09-09

Added a score workspace with Left, Top, and Right placements. Right is the initial exercise view. Side placements arrange measures vertically, reflowing between one and two measures per row as the panel width and notation zoom change. The top placement retains Steady/Flow horizontal reading. Grid placement preserves the stage and instructor video while changing layouts; position and panel-size preferences remain in session state across results and retries.

The shared edge resizes the panel by dragging, arrow keys, or the Layout menu's range control. Bounds preserve room for both score and stage. Double-clicking the edge or choosing Reset restores the default proportions. Below a 760px workspace width, side layouts become a score panel below the stage with an adjustable height; desktop width and mobile height keep separate proportions.

Added a Follow toggle for uninterrupted manual browsing, keyboard-focusable score scrolling, and follow restoration after resizing. Oversized notation retains glyph spacing and uses beat/note-aligned horizontal reading only when a row cannot fit at the chosen zoom. A narrower stage also moves and scales the instructor video to avoid the live score card.

Validation: 40 targeted tests pass, including four panel-sizing regressions; targeted lint, production compilation/type validation, and diff whitespace checks pass. Browser checks covered left/right/top placement, keyboard resizing, manual reading, follow resumption, 390px mobile layout and height limits, enlarged notation, a 960px score panel reflowing eight measures into four rows, and the lesson with instructor video. Existing preview save guards remain in place.

Follow-up browser checks confirmed left-side placement and adjusted width survive Play again, hiding the score also removes the divider, and light-theme notation remains legible. During the retry check, the results counter briefly went below zero because an animation frame timestamp preceded its effect's start timestamp. Its interpolation progress now clamps to both 0 and 1.

## Adaptive measure rows and direct resizing — 2026-09-09

Side scores now fit up to three measures per row. Each row is packed from its own measures' required widths, so one dense measure no longer forces every other row into a single column. Opening clef/time-signature space is reserved only where needed; notation zoom and available panel width determine whether one, two, or three measures fit. Oversized measures keep their readable spacing. Resize reflow is throttled to update during a drag.

Removed the Layout menu's width/height slider. A visible grip on the shared edge provides direct dragging, with a larger pointer target, hover/focus feedback, and a size readout during adjustment. Arrow-key resizing, double-click reset, and the menu's Reset button remain available. On small screens, the horizontal grip adjusts the score's height.

Validation: all 46 targeted notation, layout, repeat, pitch, and time-mapping tests pass; targeted lint, production compilation/type validation, and diff whitespace checks pass. Browser checks confirmed three-measure rows in a 960px panel, two-measure rows at intermediate widths, the slider's removal, actual pointer drags on both left and right panels, width limits, double-click reset, and vertical dragging at a 390px viewport. No horizontal page overflow was observed. Temporary viewport overrides were reset after testing.

## Stage resize flicker correction — 2026-09-09

The stage previously resized its WebGL drawing buffer directly from ResizeObserver. Those notifications can arrive after the animation callback and before browser paint, clearing a completed frame before another image is drawn. Resize notifications now mark pending work; the stage applies the latest size inside its drawing loop, immediately before rendering. Duplicate notifications skip buffer allocation, zero-sized panels preserve the last valid surface, and teardown discards pending work. CSS controls the canvas's displayed size so the completed image continues to fill the panel between drawing frames. Temporary resize frames are excluded from automatic graphics-quality reduction.

Validation: 19 targeted stage and score-layout tests pass, including five resize regressions for preserving the completed frame, coalescing drag updates, duplicate sizes, hidden panels, and disposal. Targeted lint, TypeScript validation, and diff whitespace checks pass. Live browser drags widened and narrowed the score while the stage remained visible, continued playback, and matched its container size without a loading overlay. The development preview still logged the previously observed score-control hydration-ID mismatch on reload; this is separate from the canvas resize path.

## Warm stage loading panel — 2026-09-09

Replaced the navy loading overlay and pre-canvas background with the app's warm surface tokens. A softly lit arch holds the existing Latin Music Mastery logo, with restrained amber rhythm bars and an indeterminate loading accent. The artwork uses CSS and the existing SVG, so it is available while Three.js loads. The compatibility message shares the same themed surface and button colors. Short panels use a compact layout; reduced-motion settings disable animation.

The development-only `/playsense-preview/loading` route holds the actual component for design review without adding a delay to exercise startup. Browser review covered the full panel, a 390×400 compact viewport, and loading through to the running exercise. Targeted lint, TypeScript validation, and diff whitespace checks pass. Temporary viewport sizing was reset.

## Lesson viewport fitting — 2026-09-09

Lesson view now measures the player’s unscrolled position, the visible viewport, and the actual fixed lesson footer, then sizes the entire exercise frame to the remaining height. The stage and score share the flexible space beneath the toolbar and above playback controls; the duplicate lesson-preview heading is omitted when there are no backing-track controls. Resize observation updates the fit when the surrounding layout changes. Normal page scrolling does not change the player's height, and immersive mode retains its full-viewport layout.

Short score panels condense their toolbar and omit the secondary reading footer, leaving more room for notation. Mobile preview controls use the same compact sizing as immersive mode. Long scores continue to scroll within the score container. Results, calibration, and setup overlays retain internal scrolling within the fitted frame.

Validation: 19 targeted viewport, panel-sizing, measure-packing, and stage-resize tests pass; targeted lint, TypeScript validation, and diff whitespace checks pass. The actual lesson with instructor video fits above its footer at 1728×940, 1280×720, and 390×844. At the normal desktop size the full player ends at y=860, leaving space before the footer at y=873. Browser checks also covered top/right score placement, lesson/exercise mode switching, and stable height while scrolling. Temporary viewport overrides were reset, and the lesson was left at the top in lesson view.

## Continuous vertical score reading — 2026-09-09

Side scores now advance gradually with the live music clock instead of waiting until the active row reaches the panel edge. Each row travels over its combined musical duration, so one-, two-, and three-measure rows retain a consistent reading pace. The active reading area stays near the upper part of the panel to reveal upcoming rows. Adjacent rows share the same scroll position at their downbeat; short scores stay still, and the final rows stop at the end of the score. Resize and notation zoom rebuild the reading geometry.

Exercise repetitions are laid out sequentially in the side score, including authored repeats that were previously compacted. The next pass is visible ahead of time, with chronological measure numbers throughout the exercise. A reading copy resets inherited tempo, meter, and key at each pass without changing the original score. The exact playback clock supplies both the local score time and current pass, avoiding a frame of rewind at repeat boundaries. Top placement retains its existing compact notation and Steady/Flow controls. Turning Follow off preserves manual browsing; replaying a completed exercise starts a new reading sequence.

Validation: 53 targeted tests pass, including nine regressions for continuous row movement, varied row durations, resize/zoom/seeks, final holds, repeated-pass continuity, inherited notation state, and source-score preservation. Targeted lint, TypeScript validation, and diff whitespace checks pass. Live browser samples confirmed gradual motion across the first-to-second pass boundary (measure 8 to 9), three-measure row changes, and manual browsing with Follow disabled. The actual lesson with instructor video displays all four passes in sequence. Temporary viewport sizing was reset, and the lesson was returned to lesson view. Preview save guards remain in place.
