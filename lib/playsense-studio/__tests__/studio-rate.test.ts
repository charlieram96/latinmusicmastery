// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { applyStudioRate } from '../studio-rate';

describe('applyStudioRate', () => {
  it('sets the rate and turns pitch preservation on', () => {
    const video = document.createElement('video');
    video.preservesPitch = false;
    applyStudioRate(video, 0.75);
    expect(video.playbackRate).toBe(0.75);
    expect(video.preservesPitch).toBe(true);
  });

  it('sets the vendor variants where the element has them', () => {
    const video = Object.assign(document.createElement('video'), { webkitPreservesPitch: false, mozPreservesPitch: false });
    applyStudioRate(video, 0.5);
    expect(video.webkitPreservesPitch).toBe(true);
    expect(video.mozPreservesPitch).toBe(true);
  });

  it("clamps to the transport clock's bounds", () => {
    const video = document.createElement('video');
    applyStudioRate(video, 9);
    expect(video.playbackRate).toBe(4);
    applyStudioRate(video, 0);
    expect(video.playbackRate).toBe(0.1);
  });
});
