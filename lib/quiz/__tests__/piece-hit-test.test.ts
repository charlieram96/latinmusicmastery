import { describe, expect, it } from 'vitest'
import { hitsPiecePixel } from '../piece-hit-test'

describe('piece opacity selection', () => {
  const mask = { width: 3, height: 3, alpha: new Uint8Array([255, 255, 255, 0, 255, 0, 0, 255, 0]) }
  it('selects the cymbal and thin stand while letting transparent corners pass through', () => {
    expect(hitsPiecePixel(mask, .1, .1)).toBe(true)
    expect(hitsPiecePixel(mask, .5, .8)).toBe(true)
    expect(hitsPiecePixel(mask, .1, .8)).toBe(false)
    expect(hitsPiecePixel(mask, .9, .5)).toBe(false)
  })
  it('rejects positions outside the sprite and faint transparent edges', () => {
    expect(hitsPiecePixel(mask, 1, .5)).toBe(false)
    expect(hitsPiecePixel(mask, -.01, .5)).toBe(false)
    expect(hitsPiecePixel({ width: 1, height: 1, alpha: new Uint8Array([10]) }, .5, .5)).toBe(false)
  })
})

it('fits padded sprites by their visible bounds while retaining their proportions', async () => {
  const { thumbnailOffset } = await import('../piece-hit-test')
  const alpha = new Uint8Array(100)
  for (let y=7;y<9;y++) for(let x=3;x<7;x++) alpha[y*10+x]=255
  expect(thumbnailOffset({width:10,height:10,alpha},68,60)).toEqual({x:0,y:-45,scale:2.5})
  expect(thumbnailOffset({width:10,height:10,alpha:new Uint8Array(100).fill(255)},68,60)).toEqual({x:0,y:0,scale:5.2/6})
})

it('reduces a full-width bell to the same padded envelope', async () => {
  const { thumbnailOffset } = await import('../piece-hit-test')
  const result = thumbnailOffset({width:68,height:20,alpha:new Uint8Array(68*20).fill(255)},68,60)
  expect(result.x).toBe(0)
  expect(result.y).toBe(0)
  expect(result.scale).toBeCloseTo(60/68)
})
