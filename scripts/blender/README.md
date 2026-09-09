# Afterhours Blender assets

This collection is authored from original meshes and generated image textures in Blender 5.2.1 LTS. The editable file is `art/playsense/afterhours-instruments.blend`; its packed textures also have editable PNG sources in `art/playsense/textures`. The rendered review image sits beside the Blender file.

The web renderer loads `public/playsense/models/afterhours-instruments.glb` for the foreground congas and timbales. The five masters are named `quinto`, `conga`, `tumba`, `timbale_macho`, and `timbale_hembra`. Their playing surface is at local Z=0 in Blender / Y=0 in Three.js. Review-scene arrangement, lights and plinths are excluded from the web export. Other instruments and the band environment retain their existing authored Three.js geometry.

## Local Blender MCP connection

- Blender: `/Applications/Blender.app`.
- MCP package: `ahujasid/blender-mcp` 1.9.1, pinned source revision `5f8ddaf6e987c4aa0c3467fcc548838b28f64477`.
- The isolated server lives at `~/.local/share/blender-mcp/venv/bin/blender-mcp`.
- Codex's global MCP configuration includes `blender`, connecting to `127.0.0.1:9876`. The Blender add-on starts its local bridge when enabled.
- The upstream Git source omits its telemetry configuration module. This installation supplies the inert `telemetry_config.py` from this folder as the package’s `config.py`; it has telemetry disabled and no service endpoint or credentials.
- `DISABLE_TELEMETRY=true` is set on the server; the Blender add-on's telemetry consent is also disabled. No asset-service accounts are needed for this collection.
- `mcp_client.py` uses the public MCP stdio protocol. It supports a task whose native tool catalog predates installation and is also a reproducible authoring entry point. Pass the current user instruction verbatim with `--prompt` when authoring through it.

With Blender open, run from the repository root:

```sh
~/.local/share/blender-mcp/venv/bin/python scripts/blender/mcp_client.py get_scene_info --prompt 'Your current modeling request'
~/.local/share/blender-mcp/venv/bin/python scripts/blender/mcp_client.py execute_blender_code --script scripts/blender/build_afterhours.py --prompt 'Your current modeling request'
~/.local/share/blender-mcp/venv/bin/python scripts/blender/mcp_client.py execute_blender_code --script scripts/blender/finish_review.py --prompt 'Your current modeling request'
node scripts/blender/validate_asset.mjs
```

`build_afterhours.py` replaces the generated **Afterhours Instruments** scene, preserving other scenes. To export manual edits from an existing collection, run `export_afterhours.py` instead of rebuilding. `render_afterhours.py` renders the current review camera without rebuilding models.

## Runtime and budgets

The 2.46 MB collection contains embedded WebP textures and Draco-compressed geometry, with no external texture requests. The decoder is served locally from the version bundled with Three.js; its Apache 2.0 license is included. `validate_asset.mjs` enforces names, pivots, embedded images, compression and a 4 MB asset budget.

The stage renders procedural instruments immediately, then replaces them after the complete Blender collection decodes. Compatibility mode retains the lighter procedural models. Scene teardown aborts pending downloads; an active decoding job finishes and releases its workers and buffers. Hidden masters and visible instances share resources under one scene owner, with explicit ImageBitmap disposal. Music timing and judgment remain in the existing session engine.

A Blender render uses Cycles and studio review lights. The in-game result uses the courtyard's real-time lights and camera, so the two images intentionally differ in lighting.

## Authored notes, board, entrance and lounge

`art/playsense/afterhours-playfield.blend` contains the **Afterhours Playfield** scene. The six export masters are `board`, `entrance`, `lounge`, `note_body`, `note_face`, and `note_inlay`. The scene includes a camera and tinted example notes for review; review objects and unrelated scenes are excluded from export. Both export scripts explicitly use the active scene to prevent selected objects in another open scene from entering an asset.

The board includes a recessed olive fabric bed with stitching, oiled walnut chassis and cheeks, machined brass corners, inlaid rail lighting, vents and trestle legs. The source is a deep celadon casement window with walnut reveals, brass fittings and gathered linen curtains. Beyond the frame, original modeled tiled rooftops, warm windows, balconies and palms sit at different depths against an embedded dusk-sky texture. The lounge includes boucle seating, linen/olive pillows, a side table, coffee cup, music book and woven pendant lamps. Packed PBR texture sources are also available in `art/playsense/playfield-textures`.

The web scene adds a gentle breeze to the existing Blender linen and palm-frond surfaces, plus drifting cloud wisps in the sky material. `window-motion.ts` uses the baked entrance coordinates and the `Window linen`, `Evening foliage`, and `Window dusk sky` material names; preserve these when re-exporting. The curtain tops and palm crowns stay anchored. One shared time uniform drives the effects, with no per-frame geometry uploads or additional downloads. Moving surfaces are excluded from the static room shadow bake. Reduced motion keeps the original still window, and hidden/offscreen stages suspend updates. Blender review renders show the resting geometry.

The note masters are separate single-mesh components with centered pivots. At runtime, their geometry and materials replace the procedural note instances; they keep the same event identities, positions, lane colors and audio clock. Total detail is **2,928 triangles per note**. Note faces use instance-colored emissive shading. Do not combine the three note masters or move their pivots when editing them.

The independent playfield download is **1.04 MB**, using Draco and embedded WebP, under a 2 MB budget. Loading validates the six roots before installing replacements, preserves the immediate procedural fallback, handles scene cancellation and shares material resources under one scene owner. Compatibility mode retains the simpler board and notes. This collection is applied to the PlaySense studio for every instrument, including piano; the other stage themes retain procedural notes. Internal Afterhours filenames remain stable.

Run these through the same MCP client, with the current user request as `--prompt`:

- `execute_blender_code --script scripts/blender/build_playfield.py` rebuilds the generated scene and exports it.
- `execute_blender_code --script scripts/blender/export_playfield.py` exports manual edits without rebuilding.
- `execute_blender_code --script scripts/blender/render_playfield.py` renders the scene asynchronously to `art/playsense/afterhours-playfield.png`. Status is written to `/tmp/playsense-playfield-render-status.txt`.
- `node scripts/blender/validate_playfield.mjs` checks the runtime contract, root selection, note pivots/bounds, triangle budget, textures and download budget.
