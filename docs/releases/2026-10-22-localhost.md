# Localhost publication — 22 October 2026

The user authorized publication of the current local platform and authored course content to origin/main and the existing deployment. Secrets and processing intermediates are excluded.

## Content

`lib/release/manifest.json` records each published file, its original SHA-256, destination bucket and object key. Public videos, audio, images and score assets use existing Storage buckets. Authored JSON is packaged as actual ZIP archives in the existing private `playsense-studio-scores` bucket. No bucket permissions were changed.

Production keeps the original `/local-course-assets/` paths so video matching and synchronization use the same identity and media clock. A fallback rewrite redirects only allowlisted public media to Storage, which handles byte-range playback. Local files still take precedence during development.

The published Solfeo outline, lessons, questions and Studio settings use authenticated storage reads. Lesson content requires the existing course entitlement or admin status; writes require admin status. Source JSON remains versioned for recovery. A separate approved Studio snapshot supplies the released local notation to students; later authoring drafts remain separate.

## Deployment

Use the existing production environment variables, including `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`. Never commit their values. `.vercelignore` and output tracing exclusions keep local source artifacts and large media out of serverless bundles.

`node scripts/release/verify-release.cjs`, run in the original workspace with its local media, verifies representative private document hashes and ranged media reads against the snapshot. The resumable upload script uses the checked-in manifest if a temporary inventory is not available. It must be run only for an explicitly authorized release, with the corresponding source files present.

Production enables the approved classroom appearance, lesson overlays, course content and continuous-score presentation. Developer-only diagnostic playground routes remain development-only.

## Dependency review

The release lockfile updates compatible dependency versions, including Next.js 16.4.2. `npm audit --omit=dev` reports zero high or critical advisories after this update. There are 27 moderate reports, primarily the Tiptap 2 dependency family; resolving those requires a separately tested major editor migration. No forced major update was applied.

## Recovery

The previous main commit is `b0c19515dcd3a1e143b962f3bfe542c1dd7f46ae`. Reverting the release commit restores the previous application. Uploaded release objects have their own prefix and do not replace earlier course media. Keep them until no deployed revision references them. Source documents and the manifest provide a recoverable initial snapshot; subsequent admin edits to private course documents are independent of Git rollback.
