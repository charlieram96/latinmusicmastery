// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { videoPictureBounds } from '../video-watermark';

describe('video watermark picture bounds', () => {
  it('excludes horizontal black bars in a narrow player', () => {
    expect(videoPictureBounds(800, 600, 1920, 1080)).toEqual({ x: 0, y: 75, width: 800, height: 450 });
  });
  it('follows the full picture when enlarged to its aspect ratio', () => {
    expect(videoPictureBounds(1200, 675, 1920, 1080)).toEqual({ x: 0, y: 0, width: 1200, height: 675 });
  });
  it('excludes side bars for portrait footage', () => {
    expect(videoPictureBounds(800, 600, 900, 1200)).toEqual({ x: 175, y: 0, width: 450, height: 600 });
  });
  it('uses the visible crop for cover videos', () => {
    expect(videoPictureBounds(800, 600, 1920, 1080, 'cover')).toEqual({ x: 0, y: 0, width: 800, height: 600 });
  });
});
