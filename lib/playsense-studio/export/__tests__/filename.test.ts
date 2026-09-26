import { describe, expect, it } from 'vitest';
import { sectionExportFilename, slugify } from '../filename';

describe('slugify — export filenames', () => {
  it('lowercases, strips accents and joins with hyphens', () => {
    expect(slugify('Montuno básico en Do')).toBe('montuno-basico-en-do');
  });
  it('drops punctuation and collapses runs of separators', () => {
    expect(slugify('  Son / Montuno (C - F)!! ')).toBe('son-montuno-c-f');
  });
  it('caps at 60 characters without a trailing hyphen', () => {
    const slug = slugify('a '.repeat(80));
    expect(slug.length).toBeLessThanOrEqual(60);
    expect(slug.endsWith('-')).toBe(false);
  });
  it('falls back to "score" for an empty title', () => {
    expect(slugify('¡¡!!')).toBe('score');
  });
});

describe('sectionExportFilename', () => {
  it('uses a 1-based section number and the format extension', () => {
    expect(sectionExportFilename('Montuno básico en Do', 1, 'pdf')).toBe('montuno-basico-en-do_section-2.pdf');
    expect(sectionExportFilename('Clave', 0, 'musicxml')).toBe('clave_section-1.musicxml');
    expect(sectionExportFilename('Clave', 0, 'midi')).toBe('clave_section-1.mid');
  });
});
