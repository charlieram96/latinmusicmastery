/** Artistic salsa-city stages, not replicas of festival venues. Miami remains the default. */
export const STAGE_CITIES = [
  { id: 'miami', en: 'Miami', es: 'Miami' },
  { id: 'new-york', en: 'New York', es: 'Nueva York' },
  { id: 'los-angeles', en: 'Los Angeles', es: 'Los Ángeles' },
] as const
export type StageCity = typeof STAGE_CITIES[number]['id']
export function isStageCity(value: unknown): value is StageCity { return STAGE_CITIES.some(city => city.id === value) }

/** Decorative copy only; independent of exercise timing and assessment. */
export const CITY_CELEBRATIONS: Record<StageCity, { title: { en: string; es: string }; line: { en: string; es: string } }> = {
  miami: { title: { en: 'MIAMI', es: 'MIAMI' }, line: { en: 'The best place for Latin music', es: 'El mejor lugar para la música latina' } },
  'new-york': { title: { en: 'NEW YORK', es: 'NUEVA YORK' }, line: { en: 'The city moves to a Latin beat', es: 'La ciudad vibra al ritmo latino' } },
  'los-angeles': { title: { en: 'LOS ANGELES', es: 'LOS ÁNGELES' }, line: { en: 'Latin rhythm. Hollywood magic.', es: 'Ritmo latino. Magia de Hollywood.' } },
}
