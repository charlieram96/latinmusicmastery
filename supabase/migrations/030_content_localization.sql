-- Spanish (_es) overlay columns for localizable dynamic content.
-- English columns remain the canonical/primary source; _es is nullable and
-- falls back to English when empty.

alter table courses          add column if not exists title_es text,
                             add column if not exists description_es text;

alter table course_sections  add column if not exists title_es text,
                             add column if not exists description_es text;

alter table classes          add column if not exists title_es text,
                             add column if not exists description_es text;

alter table class_items      add column if not exists title_es text,
                             add column if not exists description_es text;

alter table quiz_questions   add column if not exists question_es text,
                             add column if not exists explanation_es text,
                             add column if not exists options_es jsonb;

alter table musical_styles   add column if not exists name_es text,
                             add column if not exists description_es text;

alter table countries        add column if not exists name_es text,
                             add column if not exists description_es text;

alter table play_sense_songs add column if not exists title_es text;

-- Legacy tables still referenced by some /admin pages.
alter table lessons          add column if not exists title_es text,
                             add column if not exists description_es text;

alter table exercises        add column if not exists title_es text,
                             add column if not exists description_es text,
                             add column if not exists question_es text,
                             add column if not exists explanation_es text;
