# PDF score import

Studio’s existing Import / Replace score dialogs now accept PDF alongside MusicXML and MIDI. This applies to lesson setup, score replacement, adding or replacing video score sections, and creating standalone songs from the Songs page’s Import score button. PDF recognition is admin-only; it never attaches or publishes the result until the existing import confirmation succeeds. New imported songs are saved as unpublished drafts.

The flow is: choose a PDF → select up to eight pages → choose standard or percussion notation → recognize → compare the original with the rendered notes → select a piece and instrument → confirm import. Imported documents preserve `sourceFormat: 'pdf'` and the original filename. The original PDF is only previewed in memory; it is not stored as an attachment.

## Recognition

[Audiveris 5.11.0](https://github.com/Audiveris/audiveris/releases/tag/5.11.0) converts printed notation to compressed MusicXML, which passes through the existing Studio MusicXML parser. Clean exports and clear printed scans are the intended input; [handwriting is unsupported](https://audiveris.github.io/audiveris/_pages/handbook/). Recognition and MusicXML import are lossy, so check rhythms, pitches, voices, repeats, and instrument mapping in the editor before publishing. Selecting “Includes percussion” enables both [one-line staves and drum notation](https://audiveris.github.io/audiveris/_pages/guides/specific/drums/). It does not guarantee custom Latin-percussion mappings.

Multiple recognized pieces are exposed explicitly; import one at a time. The browser allows source files up to 20 MB, but selected PDF pages must fit within 4 MB. The server also validates the PDF and page count/dimensions independently. Each worker permits one active conversion, limits recognition to three minutes, kills cancelled jobs, bounds uploads/output, and removes job files after success or failure. No user filenames are passed to the shell; the engine is spawned directly with a generated temporary path.

## Local setup

This workspace has the official macOS arm64 engine installed in the ignored `.local/audiveris/Audiveris.app` folder, plus the official English OCR model in `.local/audiveris/tessdata/eng.traineddata`. The bundled runtime avoids a separate Java install. These binary dependencies are local only and are not committed.

Other machines can install an official [Audiveris binary](https://audiveris.github.io/audiveris/_pages/tutorials/install/binaries/) and configure:

```dotenv
PLAYSENSE_AUDIVERIS_BIN=/absolute/path/to/Audiveris
PLAYSENSE_AUDIVERIS_HOME=/absolute/path/to/recognition-working-home
TESSDATA_PREFIX=/absolute/path/to/tessdata
```

The binary setting is an executable path, not a shell command. The working home defaults to `.local/audiveris/home`; OCR defaults to its sibling `tessdata`. Linux application data/config/cache use that home. On macOS Audiveris also uses its normal Library configuration/log locations. Its CLI can emit warnings if these are not writable; recognition succeeded in the local sandbox with the supplied OCR model. Use a dedicated service account and writable application directories on a deployed worker.

Audiveris is AGPL-3.0 software. The engine remains an external process and is not included in the application bundle. Its license and corresponding source are available from the release above; retain the applicable notices when distributing the engine.

## Hosted app

The Java engine must run outside a Vercel function. A standalone adapter is included:

```sh
node scripts/playsense-pdf-worker.mjs
```

On the worker, set the engine variables above plus `PLAYSENSE_PDF_WORKER_TOKEN` (a random secret of at least 32 characters). It binds to `127.0.0.1:3016` by default; `PLAYSENSE_PDF_WORKER_HOST` and `PLAYSENSE_PDF_WORKER_PORT` override these. Expose it through an HTTPS reverse proxy with a request/response timeout above 185 seconds, an appropriately bounded request size, and private access where available. Run one process per allocated recognition slot; each Java job is capped at a 2 GB heap. Normal process supervision and OS/container resource limits belong to the deployment.

On the web application, set:

```dotenv
PLAYSENSE_PDF_WORKER_URL=https://your-recognition-service/recognize
PLAYSENSE_PDF_WORKER_TOKEN=the-same-worker-secret
```

The web route checks admin access before forwarding bytes; the worker independently checks its secret and validates the document. A missing engine/service gives an actionable error while MusicXML/MIDI remain available. The Next route requests a 240-second maximum duration; ensure the hosting plan supports it. No worker has been provisioned or published by this change.

## Verification

- The official `SchbAvMaSample.pdf` converted locally in about 17 seconds into an MXL containing two instrument parts, seven measures per part, and 325 MusicXML note entries.
- All 18 checks pass, including a real engine-output → MusicXML parser → ScoreDocument schema validation. Coverage also exercises page selections, file/page/size limits, failed-engine recovery, admin-only access, percussion flags, cancellation forwarding, and no-cache responses.
- TypeScript and targeted lint pass.
- Browser verification now passes in signed-in Chrome: upload the official PDF, recognize through the authenticated app endpoint, switch instrument parts, view the original PDF, review the notation, and confirm the import. The initial notation preview exposed a dialog grid overflow; the dialog now constrains its columns so the file details and import controls remain visible.
- Persistence was verified through the real Songs import path: save the voice part as an unpublished draft, open it in Studio, and reload. The voice part and all eight imported measures survived reload. The temporary test song was removed afterward. The sample contains recognition/rhythm discrepancies, so successful conversion does not imply musical accuracy; review remains required.
- `/playsense-preview/import` is a development-only harness using the same dialog and real authenticated recognition endpoint, but keeps confirmed scores in browser memory. The hosted recognition worker has still not been deployed.

Optional conversion/import smoke check (using an actual response saved from the local engine):

```sh
PLAYSENSE_PDF_SMOKE_RESULT=/absolute/path/to/recognition-result.json npm test -- lib/playsense-studio/__tests__/pdf-recognition-smoke.test.ts
```
