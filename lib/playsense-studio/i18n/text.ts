import symbolWords from './symbol-words.json';
import dictionary from './ui.json';
import type { Locale } from '@/lib/i18n';
const english = Object.fromEntries(Object.entries(dictionary).map(([en, es]) => [es, en]));
const decode = (s: string) => s.replace(/&(apos|quot|ldquo|rdquo|lsquo|rsquo|amp|nbsp);/g, (_, name: string) => ({apos:"'",quot:'"',ldquo:'“',rdquo:'”',lsquo:'‘',rsquo:'’',amp:'&',nbsp:' '}[name]!));

export function studioText(value: string, locale: Locale): string {
  const decoded = decode(value);
  const key = decoded.trim();
  const en = Object.hasOwn(dictionary, key) ? key : english[key] ?? key;
  const translated = locale === 'es' ? (dictionary as Record<string,string>)[en] ?? key : en;
  if (translated !== key) return decoded.replace(key, translated);
  if (locale !== 'es') return decoded;
  return decoded
    .replace(/^Scores are limited to (\d+) measures\.$/, 'Las partituras admiten un máximo de $1 compases.')
    .replace(/^Measures (\d+)–(\d+): (\d+) total passes$/, 'Compases $1–$2: $3 veces en total')
    .replace(/^Play m\.(\d+(?:–\d+)?) more than once$/, 'Repetir compás $1')
    .replace(/^m\.(\d+(?:–\d+)?) play ×(\d+)$/, 'Compás $1 · repetir ×$2')
    .replace(/^Play (\d+) times$/, 'Reproducir $1 veces')
    .replace(/^Bar m\.(\d+)$/, 'Compás $1')
    .replace(/^Add between m\.(\d+) and m\.(\d+)$/, 'Añadir entre los compases $1 y $2')
    .replace(/^Copy of m\.(\d+)$/, 'Copia del compás $1')
    .replace(/^Paste (\d+) copied bars?$/, 'Pegar $1 compases copiados')
    .replace(/^(\d+) notes will move, largest ([-\d.]+) ms$/, 'Se desplazarán $1 notas; ajuste máximo: $2 ms')
    .replace(/^(\d+) unpublished changes$/, '$1 cambios sin publicar')
    .replace(/^(\d+) bars? doesn’t add up$/, '$1 compases tienen duración incorrecta')
    .replace(/^(\d+) bars? look off$/, '$1 compases parecen desajustados')
    .replace(/^(\d+) notes? selected$/, '$1 notas seleccionadas')
    .replace(/beats? missing/g, 'tiempos faltantes')
    .replace(/^Measure (\d+)/, 'Compás $1')
    .replace(/^Select staff (\d+), measure (\d+)/, 'Seleccionar pentagrama $1, compás $2')
    .replace(/, voice (\d+), note (\d+), pitch (\d+)/, ', voz $1, nota $2, altura $3');
}

/** SMuFL identifiers stay stable; captions use the selected interface language. */
export function symbolCaption(name: string, locale: Locale): string {
  const words = name.match(/[A-Z]+(?=[A-Z][a-z]|$)|[A-Z]?[a-z]+|[0-9]+/g) ?? [name];
  return words.map(word => locale === 'es' ? (symbolWords as Record<string,string>)[word.toLowerCase()] ?? word : word).join(' ');
}
