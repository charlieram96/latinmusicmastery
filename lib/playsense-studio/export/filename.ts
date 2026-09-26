export type ExportFormat = 'pdf' | 'musicxml' | 'midi';

export const EXPORT_EXTENSION: Record<ExportFormat, string> = {
  pdf: 'pdf',
  musicxml: 'musicxml',
  midi: 'mid',
};

export const EXPORT_MIME: Record<ExportFormat, string> = {
  pdf: 'application/pdf',
  musicxml: 'application/vnd.recordare.musicxml+xml',
  midi: 'audio/midi',
};

const MAX_SLUG = 60;

export function slugify(text: string): string {
  const slug = text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG)
    .replace(/-+$/g, '');
  return slug || 'score';
}

/** `sectionIndex` is 0-based; the filename shows it 1-based. */
export function sectionExportFilename(classItemTitle: string, sectionIndex: number, format: ExportFormat): string {
  return `${slugify(classItemTitle)}_section-${sectionIndex + 1}.${EXPORT_EXTENSION[format]}`;
}
