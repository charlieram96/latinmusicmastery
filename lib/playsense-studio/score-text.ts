/**
 * Display translations for imported score metadata. Keep the MusicXML/source
 * text intact, and leave unknown titles and composer names untouched.
 */
const scoreText = [
  {
    es: 'Relleno mano izquierda cáscara',
    en: 'Cáscara fill · Left hand',
    aliases: ['Relleno Mano Izq Cascara', 'Relleno mano izquierda'],
  },
  { es: 'Cáscara relleno · Acentos', en: 'Cáscara fill · Accents', aliases: ['Cascara Relleno -Acentos'] },
  { es: 'Cáscara timbal', en: 'Timbales cáscara', aliases: [] },
] as const;

const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[·–—-]/g, ' ').replace(/\s+/g, ' ').trim();

export function localizedScoreText(text: string | null | undefined, locale: string): string {
  if (!text) return '';
  // Preserve the visible order/instance identifiers of repeated uploads.
  const match = text.match(/^(\d+\s*·\s*)?(.*?)(\s+(?:A)?\d+)?$/);
  const [, prefix = '', title = text, suffix = ''] = match ?? [];
  const entry = scoreText.find(item =>
    [item.es, item.en, ...item.aliases].some(alias => normalize(alias) === normalize(title)));
  return entry ? `${prefix}${locale === 'es' ? entry.es : entry.en}${suffix}` : text;
}
