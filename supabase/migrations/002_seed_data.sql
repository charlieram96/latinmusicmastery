-- Insert Countries
INSERT INTO countries (name, slug, description) VALUES
('Cuba', 'cuba', 'Explore the rich musical heritage of Cuba, the birthplace of salsa and many other influential Latin music styles.'),
('Puerto Rico', 'puerto-rico', 'Discover the vibrant sounds of Puerto Rico, from traditional bomba to modern reggaeton.'),
('República Dominicana', 'republica-dominicana', 'Learn the infectious rhythms of the Dominican Republic, home of bachata and merengue.'),
('Colombia', 'colombia', 'Experience the diverse musical traditions of Colombia, from cumbia to modern urban sounds.');

-- Insert Cuban Musical Styles
INSERT INTO musical_styles (country_id, name, slug, description)
SELECT
  id,
  'Salsa',
  'salsa',
  'Master the energetic and complex rhythms of salsa music.'
FROM countries WHERE slug = 'cuba';

INSERT INTO musical_styles (country_id, name, slug, description)
SELECT
  id,
  'Son',
  'son',
  'Learn the foundational style that influenced modern salsa and Latin music.'
FROM countries WHERE slug = 'cuba';

INSERT INTO musical_styles (country_id, name, slug, description)
SELECT
  id,
  'Mambo',
  'mambo',
  'Explore the powerful dance rhythms of mambo music.'
FROM countries WHERE slug = 'cuba';

INSERT INTO musical_styles (country_id, name, slug, description)
SELECT
  id,
  'Cha-Cha-Cha',
  'cha-cha-cha',
  'Discover the playful and syncopated rhythms of cha-cha-cha.'
FROM countries WHERE slug = 'cuba';

INSERT INTO musical_styles (country_id, name, slug, description)
SELECT
  id,
  'Timba',
  'timba',
  'Learn the modern Cuban dance music that evolved from salsa.'
FROM countries WHERE slug = 'cuba';

INSERT INTO musical_styles (country_id, name, slug, description)
SELECT
  id,
  'Bolero',
  'bolero',
  'Study the romantic and expressive style of Cuban bolero.'
FROM countries WHERE slug = 'cuba';

-- Insert Puerto Rican Musical Styles
INSERT INTO musical_styles (country_id, name, slug, description)
SELECT
  id,
  'Salsa',
  'salsa',
  'Explore Puerto Rican salsa, a key contributor to the genre''s evolution.'
FROM countries WHERE slug = 'puerto-rico';

INSERT INTO musical_styles (country_id, name, slug, description)
SELECT
  id,
  'Reggaeton',
  'reggaeton',
  'Master the urban beats that took the world by storm.'
FROM countries WHERE slug = 'puerto-rico';

INSERT INTO musical_styles (country_id, name, slug, description)
SELECT
  id,
  'Bomba',
  'bomba',
  'Learn the traditional Afro-Puerto Rican percussion and dance style.'
FROM countries WHERE slug = 'puerto-rico';

-- Insert Dominican Musical Styles
INSERT INTO musical_styles (country_id, name, slug, description)
SELECT
  id,
  'Bachata',
  'bachata',
  'Study the romantic guitar-driven music of the Dominican Republic.'
FROM countries WHERE slug = 'republica-dominicana';

INSERT INTO musical_styles (country_id, name, slug, description)
SELECT
  id,
  'Merengue',
  'merengue',
  'Master the fast-paced national dance music of the Dominican Republic.'
FROM countries WHERE slug = 'republica-dominicana';

INSERT INTO musical_styles (country_id, name, slug, description)
SELECT
  id,
  'Bolero',
  'bolero',
  'Explore the Dominican interpretation of this romantic style.'
FROM countries WHERE slug = 'republica-dominicana';

-- Insert Colombian Musical Styles
INSERT INTO musical_styles (country_id, name, slug, description)
SELECT
  id,
  'Cumbia',
  'cumbia',
  'Learn the traditional Colombian rhythm that influenced Latin America.'
FROM countries WHERE slug = 'colombia';

INSERT INTO musical_styles (country_id, name, slug, description)
SELECT
  id,
  'Salsa',
  'salsa',
  'Discover the Colombian contribution to salsa music.'
FROM countries WHERE slug = 'colombia';

INSERT INTO musical_styles (country_id, name, slug, description)
SELECT
  id,
  'Reggaeton',
  'reggaeton',
  'Explore Colombian urban music and reggaeton.'
FROM countries WHERE slug = 'colombia';
