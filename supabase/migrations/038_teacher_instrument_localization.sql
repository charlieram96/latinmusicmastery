-- 038: Spanish overlays for teachers and instruments.
--
-- Extends the parallel `_es` column pattern from 030_content_localization to the
-- two remaining student-facing tables that had no Spanish variant at all.
-- English columns stay canonical; `lib/i18n/localize.ts` overlays the `_es`
-- values at fetch time and falls back to English when they are null/empty.

alter table teachers
  add column if not exists bio_es jsonb,
  add column if not exists instrument_es text;

comment on column teachers.bio_es is 'Spanish TipTap bio document; falls back to bio when null';
comment on column teachers.instrument_es is 'Spanish display label for instrument; falls back to a token translation of instrument when null';

alter table instruments
  add column if not exists name_es text,
  add column if not exists description_es text;

comment on column instruments.name_es is 'Spanish display name; falls back to name when null';
comment on column instruments.description_es is 'Spanish description; falls back to description when null';
