# PDF score import

Studio's Import / Replace score dialogs accept PDF alongside MusicXML and MIDI. This applies to lesson setup, score replacement, adding or replacing video score sections, and creating standalone songs from the Songs page's Import score button. PDF recognition is admin-only; it never attaches or publishes the result until the existing import confirmation succeeds. New imported songs are saved as unpublished drafts.

The flow is: choose a PDF → select up to eight pages → choose standard or percussion notation → recognize → compare the original with the rendered notes → select a piece and instrument → confirm import. Imported documents preserve `sourceFormat: 'pdf'` and take the printed title, falling back to the PDF filename. The original PDF is only previewed in memory; it is not stored as an attachment.

## Recognition

Claude reads the selected pages directly (`claude-opus-5`, `lib/playsense-studio/pdf/recognize.ts`) and answers in a flat JSON shape (`lib/playsense-studio/pdf/recognized-score.ts`) that maps onto the studio's `ScoreDocument`: pieces, tracks, measures, voices, events in quarter-note units with dot/triplet/tie flags, chords, and repeats. Percussion notes are read as a written position plus notehead and matched against the app's own legends (`lib/playsense-studio/perc-strokes.ts`), so a cáscara "plus" on the top space of a timbal part lands on the same stroke the editor palette would produce. Repeats are written once by the model and expanded through the editor's structural edit, so an imported repeat is identical to one authored in the studio. Everything is validated with `parseScoreDocument` before it reaches the browser; a piece the schema rejects is dropped and the rest still import.

Clean exports and clear printed scans are the intended input. Short percussion patterns and a few bars of melody, the bulk of this catalogue, read well. Dense multi-part scores, handwriting, and unusual tuplets will contain mistakes. Recognition is lossy, so check rhythms, pitches, voices, repeats, and instrument mapping in the review step and the editor before publishing. The "Includes percussion" choice tells the model to treat one-line staves and drum notation as percussion parts.

Multiple recognized pieces are exposed explicitly; import one at a time. The browser allows source files up to 20 MB, but selected PDF pages must fit within 4 MB. The server validates the PDF and page count/dimensions independently, bounds the upload, and aborts the model request after three minutes or when the browser cancels.

## Configuration

Set `ANTHROPIC_API_KEY` for the web app: in `.env.local` for development (restart the dev server afterwards) and in the Vercel project's environment for production. Use a key created inside a workspace, or add `ANTHROPIC_WORKSPACE_ID` alongside an organization-level key (the API rejects such a key without a workspace). With no key the route answers 503 with an actionable message while MusicXML and MIDI imports keep working. No other service is needed.

The route requests a 240-second maximum function duration; the hosting plan must allow it. The model call is capped at 24k output tokens; a longer answer is reported as "select fewer pages". Cost is on the order of a few cents to a dollar per import, depending on how dense the pages are.

## Verification

- `lib/playsense-studio/__tests__/recognized-score.test.ts`: model output converts to a valid score, percussion strokes resolve through the legend, repeats expand exactly as the editor does, empty tracks are dropped, an empty result is a 422.
- `lib/playsense-studio/__tests__/pdf-recognize.test.ts`: the request carries the PDF as a document block and the percussion legend; missing or invalid keys, rate limits, timeouts, truncation and unparseable answers map to the statuses the dialog explains; invalid files never reach the API.
- `lib/playsense-studio/__tests__/pdf-import.test.ts` and the route test cover page selection, upload bounds, and admin-only access.
- Browser check: sign in as an admin, open a studio item, Import score, choose a PDF, pick pages, recognize, and review the notation before confirming.
