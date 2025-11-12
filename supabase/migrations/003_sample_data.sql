-- Sample Courses for Salsa (Puerto Rico)
INSERT INTO courses (musical_style_id, title, slug, description, teacher_name, teacher_bio, is_published, order_index, thumbnail_url)
SELECT
  ms.id,
  'Salsa Fundamentals: Rhythm and Timing',
  'salsa-fundamentals-rhythm-timing',
  'Master the foundational rhythms and timing patterns that make salsa music come alive. Perfect for beginners.',
  'Carlos Martinez',
  'Professional salsa musician and instructor with 20+ years of experience performing in Puerto Rico and internationally.',
  true,
  1,
  'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4'
FROM musical_styles ms
JOIN countries c ON ms.country_id = c.id
WHERE c.slug = 'puerto-rico' AND ms.slug = 'salsa'
LIMIT 1;

INSERT INTO courses (musical_style_id, title, slug, description, teacher_name, teacher_bio, is_published, order_index, thumbnail_url)
SELECT
  ms.id,
  'Advanced Salsa Piano Montunos',
  'advanced-salsa-piano-montunos',
  'Learn complex piano montuno patterns used by professional salsa pianists.',
  'Maria Rodriguez',
  'Grammy-nominated salsa pianist who has performed with the top salsa orchestras in Latin America.',
  true,
  2,
  'https://images.unsplash.com/photo-1520523839897-bd0b52f945a0'
FROM musical_styles ms
JOIN countries c ON ms.country_id = c.id
WHERE c.slug = 'puerto-rico' AND ms.slug = 'salsa'
LIMIT 1;

-- Sample Courses for Bachata (Dominican Republic)
INSERT INTO courses (musical_style_id, title, slug, description, teacher_name, teacher_bio, is_published, order_index, thumbnail_url)
SELECT
  ms.id,
  'Bachata Guitar Essentials',
  'bachata-guitar-essentials',
  'Learn the essential guitar patterns and techniques that define traditional and modern bachata.',
  'Juan Perez',
  'Renowned bachata guitarist from Santo Domingo with 15 years of recording and touring experience.',
  true,
  1,
  'https://images.unsplash.com/photo-1510915361894-db8b60106cb1'
FROM musical_styles ms
JOIN countries c ON ms.country_id = c.id
WHERE c.slug = 'dominican-republic' AND ms.slug = 'bachata'
LIMIT 1;

-- Sample Courses for Reggaeton (Puerto Rico)
INSERT INTO courses (musical_style_id, title, slug, description, teacher_name, teacher_bio, is_published, order_index, thumbnail_url)
SELECT
  ms.id,
  'Reggaeton Production Basics',
  'reggaeton-production-basics',
  'Learn how to produce authentic reggaeton beats with the classic dembow rhythm and modern production techniques.',
  'DJ Lucho',
  'Award-winning producer who has worked with top reggaeton artists and created multiple chart-topping hits.',
  true,
  1,
  'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04'
FROM musical_styles ms
JOIN countries c ON ms.country_id = c.id
WHERE c.slug = 'puerto-rico' AND ms.slug = 'reggaeton'
LIMIT 1;

-- Sample Courses for Cumbia (Colombia)
INSERT INTO courses (musical_style_id, title, slug, description, teacher_name, teacher_bio, is_published, order_index, thumbnail_url)
SELECT
  ms.id,
  'Colombian Cumbia Percussion',
  'colombian-cumbia-percussion',
  'Master the traditional percussion instruments and rhythms of Colombian cumbia.',
  'Pedro Vargas',
  'Master percussionist from Barranquilla, keeper of traditional Colombian cumbia rhythms.',
  true,
  1,
  'https://images.unsplash.com/photo-1519892300165-cb5542fb47c7'
FROM musical_styles ms
JOIN countries c ON ms.country_id = c.id
WHERE c.slug = 'colombia' AND ms.slug = 'cumbia'
LIMIT 1;

-- Sample Lessons for Salsa Fundamentals course
INSERT INTO lessons (course_id, title, slug, description, soundslice_embed_url, duration_minutes, is_free, order_index)
SELECT
  c.id,
  'Introduction to Salsa Rhythm',
  'introduction-salsa-rhythm',
  'Learn the basic 1-2-3 pause, 5-6-7 pause pattern that forms the foundation of salsa music.',
  'https://www.soundslice.com/slices/embed_example/',
  15,
  true,
  1
FROM courses c
WHERE c.slug = 'salsa-fundamentals-rhythm-timing'
LIMIT 1;

INSERT INTO lessons (course_id, title, slug, description, soundslice_embed_url, duration_minutes, is_free, order_index)
SELECT
  c.id,
  'The Clave Pattern',
  'the-clave-pattern',
  'Understand the clave, the rhythmic pattern that guides all salsa music. Learn both 2-3 and 3-2 clave.',
  'https://www.soundslice.com/slices/embed_example/',
  20,
  true,
  2
FROM courses c
WHERE c.slug = 'salsa-fundamentals-rhythm-timing'
LIMIT 1;

INSERT INTO lessons (course_id, title, slug, description, soundslice_embed_url, duration_minutes, is_free, order_index)
SELECT
  c.id,
  'Basic Salsa Piano Patterns',
  'basic-salsa-piano-patterns',
  'Learn your first simple piano montuno patterns that you can use in any salsa song.',
  'https://www.soundslice.com/slices/embed_example/',
  25,
  false,
  3
FROM courses c
WHERE c.slug = 'salsa-fundamentals-rhythm-timing'
LIMIT 1;

INSERT INTO lessons (course_id, title, slug, description, soundslice_embed_url, duration_minutes, is_free, order_index)
SELECT
  c.id,
  'Salsa Bass Line Fundamentals',
  'salsa-bass-line-fundamentals',
  'Discover how the bass line locks in with the clave to create the groove in salsa music.',
  'https://www.soundslice.com/slices/embed_example/',
  30,
  false,
  4
FROM courses c
WHERE c.slug = 'salsa-fundamentals-rhythm-timing'
LIMIT 1;

INSERT INTO lessons (course_id, title, slug, description, soundslice_embed_url, duration_minutes, is_free, order_index)
SELECT
  c.id,
  'Putting It All Together',
  'putting-it-all-together',
  'Practice playing along with a full salsa band, combining all the elements you've learned.',
  'https://www.soundslice.com/slices/embed_example/',
  35,
  false,
  5
FROM courses c
WHERE c.slug = 'salsa-fundamentals-rhythm-timing'
LIMIT 1;

-- Sample Lessons for Bachata Guitar course
INSERT INTO lessons (course_id, title, slug, description, soundslice_embed_url, duration_minutes, is_free, order_index)
SELECT
  c.id,
  'Bachata Rhythm Guitar Pattern',
  'bachata-rhythm-guitar-pattern',
  'Learn the essential repeating guitar pattern that is the backbone of bachata music.',
  'https://www.soundslice.com/slices/embed_example/',
  18,
  true,
  1
FROM courses c
WHERE c.slug = 'bachata-guitar-essentials'
LIMIT 1;

INSERT INTO lessons (course_id, title, slug, description, soundslice_embed_url, duration_minutes, is_free, order_index)
SELECT
  c.id,
  'Bachata Lead Guitar Melodies',
  'bachata-lead-guitar-melodies',
  'Master the romantic lead guitar melodies that make bachata songs so memorable.',
  'https://www.soundslice.com/slices/embed_example/',
  25,
  false,
  2
FROM courses c
WHERE c.slug = 'bachata-guitar-essentials'
LIMIT 1;

INSERT INTO lessons (course_id, title, slug, description, soundslice_embed_url, duration_minutes, is_free, order_index)
SELECT
  c.id,
  'Modern Bachata Techniques',
  'modern-bachata-techniques',
  'Explore the techniques used in modern bachata, including effects and extended techniques.',
  'https://www.soundslice.com/slices/embed_example/',
  30,
  false,
  3
FROM courses c
WHERE c.slug = 'bachata-guitar-essentials'
LIMIT 1;

-- Sample Exercises for Introduction to Salsa Rhythm
INSERT INTO exercises (lesson_id, title, question, question_type, options, correct_answer, explanation, order_index)
SELECT
  l.id,
  'Identify the Salsa Time Signature',
  'What time signature is salsa music typically written in?',
  'multiple_choice',
  ARRAY['2/4', '3/4', '4/4', '6/8'],
  '4/4',
  'Salsa music is written in 4/4 time, with dancers typically counting in groups of 8 beats.',
  1
FROM lessons l
WHERE l.slug = 'introduction-salsa-rhythm'
LIMIT 1;

INSERT INTO exercises (lesson_id, title, question, question_type, options, correct_answer, explanation, order_index)
SELECT
  l.id,
  'Understanding the Basic Step',
  'On which beats do dancers step in basic salsa timing?',
  'multiple_choice',
  ARRAY['1-2-3, 5-6-7', '1-3-5, 2-4-6', '1-2-3-4, 5-6-7-8', '1-4-7, 2-5-8'],
  '1-2-3, 5-6-7',
  'The basic salsa step happens on beats 1-2-3 (pause on 4) and 5-6-7 (pause on 8). This creates the characteristic salsa rhythm.',
  2
FROM lessons l
WHERE l.slug = 'introduction-salsa-rhythm'
LIMIT 1;

-- Sample Exercises for Clave Pattern
INSERT INTO exercises (lesson_id, title, question, question_type, options, correct_answer, explanation, order_index)
SELECT
  l.id,
  'What is the Clave?',
  'The clave is best described as:',
  'multiple_choice',
  ARRAY['A dance move', 'A rhythmic pattern that guides the music', 'A type of drum', 'A song structure'],
  'A rhythmic pattern that guides the music',
  'The clave is a fundamental rhythmic pattern that serves as the timeline for salsa and other Afro-Cuban music styles. All other instruments orient themselves around the clave.',
  1
FROM lessons l
WHERE l.slug = 'the-clave-pattern'
LIMIT 1;

INSERT INTO exercises (lesson_id, title, question, question_type, options, correct_answer, explanation, order_index)
SELECT
  l.id,
  'Types of Clave',
  'The two main types of clave used in salsa are:',
  'multiple_choice',
  ARRAY['Fast and slow', '2-3 and 3-2', 'Major and minor', 'Simple and complex'],
  '2-3 and 3-2',
  'The clave can be played as 2-3 (two hits in first measure, three in second) or 3-2 (three hits in first measure, two in second). The choice affects the feel of the entire song.',
  2
FROM lessons l
WHERE l.slug = 'the-clave-pattern'
LIMIT 1;

-- Sample Exercises for Bachata Guitar
INSERT INTO exercises (lesson_id, title, question, question_type, options, correct_answer, explanation, order_index)
SELECT
  l.id,
  'Bachata Guitar Pattern',
  'What is the typical repeating pattern length in bachata guitar?',
  'multiple_choice',
  ARRAY['2 bars', '4 bars', '8 bars', '16 bars'],
  '2 bars',
  'Traditional bachata guitar uses a 2-bar (8-beat) repeating pattern that forms the foundation of the song.',
  1
FROM lessons l
WHERE l.slug = 'bachata-rhythm-guitar-pattern'
LIMIT 1;
