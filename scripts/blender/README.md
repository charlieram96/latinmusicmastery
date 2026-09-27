# Afterhours Blender assets

This collection is authored from original meshes and generated image textures in Blender 5.2.1 LTS. The editable file is `art/playsense/afterhours-instruments.blend`; its packed textures also have editable PNG sources in `art/playsense/textures`. The rendered review image sits beside the Blender file.

The web renderer loads `public/playsense/models/afterhours-instruments.glb` for the foreground congas and timbales. The shipped file is produced by `export_afterhours_lod.py`, which decimates the conga hardware (nickel hooks, enamel rings, champagne fittings) to roughly a quarter of its triangles at export time without saving over the `.blend` (collection: ~621k → ~282k triangles, 2.06 MB). Use it instead of `export_afterhours.py` for web exports. The five masters are named `quinto`, `conga`, `tumba`, `timbale_macho`, and `timbale_hembra`. Their playing surface is at local Z=0 in Blender / Y=0 in Three.js. Review-scene arrangement, lights and plinths are excluded from the web export. Other instruments and the band environment retain their existing authored Three.js geometry.

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

## Retired: Afterhours playfield

The courtyard room (`afterhours-playfield`: board, entrance window, lounge and note masters) was replaced in September 2026 by the procedural Malecón stage in `components/play-sense/stage-highway/malecon/`. Its runtime GLB was removed; `art/playsense/afterhours-playfield.blend` and the `*_playfield` scripts remain only as art history.
