-- 007_teachers_bio_jsonb.sql
-- Change teachers.bio from TEXT to JSONB so bios can be stored as rich TipTap
-- documents. Existing plain-text bios are wrapped into a single-paragraph
-- TipTap doc so they render correctly after the migration.

ALTER TABLE teachers
  ALTER COLUMN bio TYPE jsonb
  USING (
    CASE
      WHEN bio IS NULL THEN NULL
      WHEN btrim(bio) = '' THEN NULL
      ELSE jsonb_build_object(
        'type', 'doc',
        'content', jsonb_build_array(
          jsonb_build_object(
            'type', 'paragraph',
            'content', jsonb_build_array(
              jsonb_build_object(
                'type', 'text',
                'text', bio
              )
            )
          )
        )
      )
    END
  );
