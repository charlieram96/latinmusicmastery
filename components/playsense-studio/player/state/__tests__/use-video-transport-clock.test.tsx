// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { useVideoTransportClock, type VideoTransportClock } from '../use-video-transport-clock';

it('enters an enabled loop on Play from outside and resumes inside it', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const video = document.createElement('video');
  const play = vi.spyOn(video, 'play').mockResolvedValue();
  const ref = { current: video };
  let clock!: VideoTransportClock;
  function Harness() { clock = useVideoTransportClock(ref); return null; }
  const host = document.createElement('div');
  const root = createRoot(host);
  try {
    act(() => root.render(<Harness />));
    act(() => { clock.setLoopA(226); clock.setLoopB(228); clock.setLoopEnabled(true); });
    video.currentTime = 152;
    await act(async () => { await clock.toggle(); });
    expect(video.currentTime).toBe(226);
    expect(play).toHaveBeenCalledOnce();
    video.currentTime = 227;
    await act(async () => { await clock.play(); });
    expect(video.currentTime).toBe(227);
    video.currentTime = 229;
    await act(async () => { await clock.play(); });
    expect(video.currentTime).toBe(226);
    act(() => clock.clearLoop());
    video.currentTime = 100;
    await act(async () => { await clock.play(); });
    expect(video.currentTime).toBe(100);
  } finally { act(() => root.unmount()); play.mockRestore(); }
});

it('handles pause while play is pending and allows a later play', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const video = document.createElement('video');
  let rejectPlay!: (reason: unknown) => void;
  const play = vi.spyOn(video, 'play').mockImplementationOnce(() => new Promise<void>((_, reject) => { rejectPlay = reject; })).mockResolvedValue();
  const pause = vi.spyOn(video, 'pause').mockImplementation(() => {
    rejectPlay(new DOMException('The play() request was interrupted by pause().', 'AbortError'));
    video.dispatchEvent(new Event('pause'));
  });
  let clock!: VideoTransportClock;
  const ref = { current: video };
  function Harness() { clock = useVideoTransportClock(ref); return null; }
  const root = createRoot(document.createElement('div'));
  try {
    act(() => root.render(<Harness />));
    await act(async () => {
      const pending = clock.play();
      clock.pause();
      await expect(pending).resolves.toBeUndefined();
    });
    expect(clock.isPlaying).toBe(false);
    expect(play).toHaveBeenCalledTimes(1);
    await act(async () => { await clock.play(); });
    expect(play).toHaveBeenCalledTimes(2);
    const refused = new DOMException('Autoplay blocked', 'NotAllowedError');
    play.mockRejectedValueOnce(refused);
    await act(async () => { await expect(clock.play()).rejects.toBe(refused); });
  } finally {
    act(() => root.unmount());
    play.mockRestore();
    pause.mockRestore();
  }
});
