import type { PercussionNotehead } from '@/components/playsense-studio/shared/score-model/types';

// SMuFL characters from the Finale Maestro legends, rendered with VexFlow's
// bundled music font. Keep each head independent, including simultaneous hits.
export const PERCUSSION_GLYPHS: Record<Exclude<PercussionNotehead, 'normal'>, string> = {
  x: '\uE0A9',
  'ornate-x': '\uE0AA',
  plus: '\uE0AF',
  circled: '\uE0E8',
  slash: '\uE100',
  slashed: '\uE0CF',
  diamond: '\uE0DB',
  'triangle-down': '\uE0C7',
  'triangle-up': '\uE0BE',
  square: '\uE1B3',
};

const SMUFL_HEADS: Record<string, PercussionNotehead> = {
  noteheadBlack: 'normal', noteheadHalf: 'normal', noteheadWhole: 'normal',
  noteheadXBlack: 'x', noteheadXHalf: 'x', noteheadXWhole: 'x', noteheadXOrnate: 'ornate-x',
  noteheadPlusBlack: 'plus', noteheadPlusHalf: 'plus',
  // Finale custom percussion maps can use this small + as a notehead.
  timeSigPlusSmall: 'plus',
  noteheadCircledBlackLarge: 'circled', noteheadCircledBlack: 'circled',
  noteheadSlashVerticalEnds: 'slash', noteheadSlashHorizontalEnds: 'slash',
  noteheadSlashedBlack1: 'slashed', noteheadSlashedHalf1: 'slashed',
  noteheadDiamondBlack: 'diamond', noteheadDiamondHalf: 'diamond',
  noteheadTriangleDownBlack: 'triangle-down', noteheadTriangleDownHalf: 'triangle-down',
  noteheadTriangleUpBlack: 'triangle-up', noteheadTriangleUpHalf: 'triangle-up',
  noteShapeSquareBlack: 'square', noteheadSquareBlack: 'square',
};

export function musicXmlNotehead(value?: string, smufl?: string | null): PercussionNotehead {
  if (smufl && SMUFL_HEADS[smufl]) return SMUFL_HEADS[smufl];
  const names: Record<string, PercussionNotehead> = {
    normal: 'normal', x: 'x', cross: 'plus', 'circle dot': 'circled',
    slash: 'slash', 'slashed': 'slashed', diamond: 'diamond',
    // Finale exports the LMM Jam Block square using the shape-note name "la".
    triangle: 'triangle-up', 'inverted triangle': 'triangle-down', square: 'square', la: 'square',
  };
  return names[value ?? 'normal'] ?? 'normal';
}

/** Keep the stroke's symbol while preserving half/whole-note duration cues. */
export function percussionGlyph(notehead: Exclude<PercussionNotehead, 'normal'>, duration: string): string {
  const longHeads: Partial<Record<PercussionNotehead, [string, string, string]>> = {
    x: ['\uE0A8', '\uE0A7', '\uE0A6'],
    plus: ['\uE0AE', '\uE0AD', '\uE0AC'],
    circled: ['\uE0E9', '\uE0EA', '\uE0EB'],
    slash: ['\uE103', '\uE102', '\uE10A'],
    slashed: ['\uE0D1', '\uE0D3', '\uE0D5'],
    diamond: ['\uE0D9', '\uE0D8', '\uE0D7'],
    'triangle-down': ['\uE0C5', '\uE0C4', '\uE0C3'],
    'triangle-up': ['\uE0BC', '\uE0BB', '\uE0BA'],
    square: ['\uE0B8', '\uE0B8', '\uE0B9'],
  };
  const index = duration === '2' ? 0 : duration === '1' ? 1 : duration === '1/2' ? 2 : undefined;
  return (index !== undefined ? longHeads[notehead]?.[index] : undefined) ?? PERCUSSION_GLYPHS[notehead];
}
