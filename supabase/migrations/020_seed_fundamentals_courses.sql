-- 020_seed_fundamentals_courses.sql
-- One draft (unpublished) genreless fundamentals course per subscribable
-- instrument. Content is authored later via the admin; these rows just need
-- to exist for the billing/access phases to reference.

INSERT INTO courses (title, slug, instrument, is_fundamentals, musical_style_id, teacher_name, is_published, order_index)
VALUES
  ('Bass Fundamentals',             'bass-fundamentals',             'Bass',             true, NULL, 'Latin Music Mastery', false, 0),
  ('Conga Fundamentals',            'conga-fundamentals',            'Conga',            true, NULL, 'Latin Music Mastery', false, 0),
  ('Drums Fundamentals',            'drums-fundamentals',            'Drums',            true, NULL, 'Latin Music Mastery', false, 0),
  ('Guitar Fundamentals',           'guitar-fundamentals',           'Guitar',           true, NULL, 'Latin Music Mastery', false, 0),
  ('Minor Percussion Fundamentals', 'minor-percussion-fundamentals', 'Minor Percussion', true, NULL, 'Latin Music Mastery', false, 0),
  ('Piano Fundamentals',            'piano-fundamentals',            'Piano',            true, NULL, 'Latin Music Mastery', false, 0),
  ('Timbal Fundamentals',           'timbal-fundamentals',           'Timbal',           true, NULL, 'Latin Music Mastery', false, 0),
  ('Tres Fundamentals',             'tres-fundamentals',             'Tres',             true, NULL, 'Latin Music Mastery', false, 0),
  ('Violin Fundamentals',           'violin-fundamentals',           'Violin',           true, NULL, 'Latin Music Mastery', false, 0)
ON CONFLICT (slug) DO NOTHING;
