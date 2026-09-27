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
    id: 'studio', name: 'PlaySense', subtitle: 'Malecón at dusk', accent: '#ffc46b', secondary: '#6fe3d6',
    background: 0x120d22, deck: 0x231913, metal: 0xc9a066,
    colors: [0xffb04a, 0x3fe3cf, 0xff6f91, 0xa98bff, 0x96e66e, 0xffe27a], bloom: 0.5,
  },

}

/** The Malecón stage is the only selectable appearance (its id stays `studio` for saved preferences). */
export const STAGE_THEME_IDS: StageThemeId[] = ['studio']
export const STAGE_THEME_STORAGE_KEY = 'playsense-stage-theme'
export function isStageTheme(value: string | null): value is StageThemeId {
  // Retired appearance preferences fall back to the studio in useStageTheme.
  return value === 'studio'
}
