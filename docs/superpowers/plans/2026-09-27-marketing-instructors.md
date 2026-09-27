# Marketing redesign: Instructors (plan)

Spec: `docs/superpowers/specs/2026-09-27-marketing-site-redesign-design.md` §4. Prototype: `PAGES.instructors`, `PAGES.patricio` in `assets/landing-redesign/app.js`.
Branch `feat/mkt-instructors` off `feat/marketing-redesign`.

## Files

| File | Role |
|---|---|
| `lib/marketing/teacher-families.ts` (+ test) | `FAMILIES` (perc, keys, bass, strings, horns, voice → seat keys), `teacherFamilies(seatKeys)`, `familyCounts(teachers)` |
| `lib/marketing/monogram.ts` (+ test) | `initials(name)` (skips quoted nickname), `monogramDataUri(name)` → SVG data URI used as the photo fallback |
| `lib/marketing/teacher-courses.ts` (+ test) | `isUuid(id)`, `mergeTeacherCourses(byId, byName)` dedupe + order |
| `components/marketing/instructors/BioProse.tsx` (+ test) | server renderer for TipTap JSON: doc, paragraph, heading (demoted one level: h1→h2…), bullet/ordered list, listItem, blockquote, hardBreak, horizontalRule, text with bold/italic/strike/code/link marks (http/https/mailto only). Unknown nodes render their children. |
| `components/marketing/instructors/InstructorsGrid.tsx` | client: sticky `.toolbar` of `.fchip` family filters (aria-pressed, counts) + `.igrid` of `MaestroCard`s; families with 0 teachers are hidden |
| `components/marketing/instructors/withPortrait.ts` | `withPortrait(teacher)` substitutes the monogram when `imageUrl` is null (MaestroCard untouched) |
| `app/(marketing)/styles/instructors.css` | `.mkt` scoped: bio prose headings/lists/hr, profile name/instrument line, course list |
| `app/(marketing)/instructors/page.tsx` | server: catalog → PageHead ("Los *maestros.*", lede with `counts.maestros`), grid, philosophy quote + prose (`.about-split`), `<Finale/>` |
| `app/(marketing)/instructors/[teacherId]/page.tsx` | server: UUID check → teacher row (bio/bio_es localized) → `notFound()`; courses where `teacher_id = id` or `teacher_name = name`, published, with section/lesson counts; `.profile` layout (sticky `.portrait`, crumbs, `ptitle` with `splitNickname` + `Accent`, instrument line, `.played-with` chips, `BioProse` in `.prose`, `.inst-card` Sleeve links to `/course-preview/{id}`), `<Finale title="Study with" accent="{nickname|first name}.">`; `generateMetadata` |
| `instructors-content.tsx` | deleted (only this route used it; InstructorCard/InstructorBioModal stay for the lead) |

Locales: `marketing.site.instructors.*`, `marketing.site.profile.*` in both files, inserted above the sentinel.

## Tests (vitest, node)
- families: Timbal→perc; `['Piano','Violin']`→keys+strings; Voice; unknown→[]; counts incl. multi-family.
- monogram: `Patricio "el chino" Diaz`→`PD`; single name→one letter; data URI decodes to SVG containing initials, escapes `&<`.
- teacher-courses: isUuid valid/invalid; merge dedupes by id, keeps order_index order.
- BioProse: renderToStaticMarkup — heading demotion, lists, marks, unsafe link dropped (`javascript:`), null doc → null.

## Verify
tsc, full vitest, eslint on touched files, headless screenshots of `/instructors`, `/instructors/<patricio>`, `/instructors/<no-course teacher>`, a bad id (404) at 1440×900 and 390×844; scrollWidth check.
