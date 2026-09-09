export type StageThemeId = 'concert' | 'arcade' | 'studio'

export interface StageTheme {
  id: StageThemeId
  name: string
  subtitle: string
  accent: string
  secondary: string
  background: number
  deck: number
  metal: number
  colors: number[]
  bloom: number
}

export const STAGE_THEMES: Record<StageThemeId, StageTheme> = {
  concert: {
    id: 'concert', name: 'Orbit', subtitle: 'Futuristic concert', accent: '#69f5db', secondary: '#b69bff',
    background: 0x050b15, deck: 0x101c2c, metal: 0x536479,
    colors: [0x56eed0, 0xb396ff, 0xffbc6b, 0x72c5ff, 0xff82bc, 0xfbdf7c], bloom: 0.62,
  },
  arcade: {
    id: 'arcade', name: 'Voltage', subtitle: 'Rhythm arcade', accent: '#dcff67', secondary: '#ff7ab8',
    background: 0x100b25, deck: 0x251943, metal: 0x8378ae,
    colors: [0xdeff65, 0xfe80b5, 0x70dfff, 0xffb660, 0xc0a0ff, 0x80ffc5], bloom: 0.5,
  },
  studio: {
    id: 'studio', name: 'PlaySense', subtitle: 'Courtyard sessions', accent: '#f1ce8b', secondary: '#9cd2cc',
    background: 0x202c2b, deck: 0x242c29, metal: 0xa28d6d,
    colors: [0xf0cc8a, 0x9ed5ce, 0xe7a593, 0xb6b0db, 0xaed0a6, 0xe4c6b3], bloom: 0.35,
  },
}

export const STAGE_THEME_IDS = Object.keys(STAGE_THEMES) as StageThemeId[]
export const STAGE_THEME_STORAGE_KEY = 'playsense-stage-theme'
export function isStageTheme(value: string | null): value is StageThemeId {
  return value === 'concert' || value === 'arcade' || value === 'studio'
}
