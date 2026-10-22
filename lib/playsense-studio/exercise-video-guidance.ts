/** Content-specific guidance for the filmed Son timbal exercises. */
export const exerciseVideoGuidance: Record<string, { es: string; en: string; tipsEs: string[]; tipsEn: string[]; introEs?: string; introEn?: string; watchIntro?: {start:number;end:number} }> = {
  'ddc2fad9-9e78-457b-94d4-1bd1bf0b7738': {
    es: 'Cáscara · Paso a paso', en: 'Cáscara · Step by step',
    introEs: 'Escucha, canta cada compás y une el patrón de la cáscara.',
    introEn: 'Listen, sing each bar, then join the complete cáscara pattern.',
    tipsEs: [], tipsEn: [],
  },
  'f7fee0dd-66bb-4e08-9af0-e38febfa415b': {
    watchIntro: {start: 0, end: 5},
    es: 'Cáscara · Mano derecha', en: 'Cáscara · Right hand',
    tipsEs: ['Mantén el pulso estable', 'Busca un sonido uniforme'],
    tipsEn: ['Keep a steady pulse', 'Aim for an even sound'],
  },
  'd14dba92-38c5-4d24-91dd-43a322b7890d': {
    es: 'Cáscara · Acentos de mano derecha', en: 'Cáscara · Right-hand accents',
    tipsEs: ['Mantén el pulso entre los acentos', 'Resalta el acento sin tensar la mano'],
    tipsEn: ['Keep the pulse between accents', 'Bring out the accent with a relaxed hand'],
  },
  'dba5d44e-9d9d-43d3-bf9d-aa5262356cac': {
    es: 'Cáscara · Mano derecha rápido', en: 'Cáscara · Fast right hand',
    tipsEs: ['Movimiento pequeño, mano relajada', 'Conserva la claridad al acelerar'],
    tipsEn: ['Small movements, relaxed hand', 'Keep each stroke clear at speed'],
  },
  '19d7db0f-a8f7-476e-b1b4-96ccfe923184': {
    es: 'Relleno de la cáscara · Mano izquierda', en: 'Cáscara fill · Left hand',
    tipsEs: ['Escucha dónde entra el relleno', 'Equilibra el sonido de ambas manos'],
    tipsEn: ['Listen for the fill’s entrance', 'Balance the sound of both hands'],
  },
}
