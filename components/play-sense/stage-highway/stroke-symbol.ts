import * as THREE from 'three'
import { PERCUSSION_GLYPHS } from '@/lib/playsense-studio/percussion-noteheads'
import type { PercussionNotehead } from '@/components/playsense-studio/shared/score-model/types'

/** The same SMuFL noteheads as the notation editor, not substitute emoji. */
export function strokeSymbolTexture(head:PercussionNotehead):THREE.CanvasTexture {
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256
  const ctx=canvas.getContext('2d')!
  const glyph=head==='normal'?'\uE0A4':PERCUSSION_GLYPHS[head]
  ctx.font='112px LMMStageNotation';ctx.fillStyle='#fff';ctx.shadowColor='#ffda9b';ctx.shadowBlur=16
  const bounds=ctx.measureText(glyph)
  const left=(256-bounds.width)/2
  ctx.fillText(glyph,left,154)
  // Upright stem preserves the legend's musical silhouette.
  ctx.shadowBlur=0;ctx.fillRect(left+bounds.width-3,40,4,105)
  return new THREE.CanvasTexture(canvas)
}
