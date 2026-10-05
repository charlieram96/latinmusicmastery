'use client';

import { useEffect, useRef } from 'react';

/** Visible picture bounds, excluding the black bars around a contained video. */
export function videoPictureBounds(width: number, height: number, sourceWidth: number, sourceHeight: number, fit = 'contain') {
  if (!sourceWidth || !sourceHeight || fit === 'cover') return { x: 0, y: 0, width, height };
  const scale = Math.min(width / sourceWidth, height / sourceHeight, fit === 'scale-down' ? 1 : Infinity);
  const pictureWidth = sourceWidth * scale;
  const pictureHeight = sourceHeight * scale;
  return { x: (width - pictureWidth) / 2, y: (height - pictureHeight) / 2, width: pictureWidth, height: pictureHeight };
}

/** Shared branding follows the actual picture, rather than its letterboxed player. */
export function VideoWatermark({ nativeControls = false, controlsClearance = 0, sizeScale = 1 }: { nativeControls?: boolean; controlsClearance?: number; sizeScale?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const mark = ref.current;
    const parent = mark?.parentElement;
    if (!mark || !parent) return;
    let video: HTMLVideoElement | null = null;
    const update = () => {
      if (!video || !video.videoWidth || !video.videoHeight) {
        mark.style.visibility = 'hidden';
        return;
      }
      const box = video.getBoundingClientRect();
      const container = parent.getBoundingClientRect();
      const picture = videoPictureBounds(box.width, box.height, video.videoWidth, video.videoHeight, getComputedStyle(video).objectFit);
      const width = Math.min(picture.width * .18, 180) * sizeScale;
      const logoHeight = width * 489 / 2904;
      // Controls occupy the bottom of the video element, not the contained picture.
      const reservedBottom = Math.max(nativeControls ? 48 : 0, controlsClearance);
      const controlsInset = Math.max(0, picture.y + picture.height - (box.height - reservedBottom));
      const inset = Math.min(Math.max(picture.height * .03, controlsInset), Math.max(0, picture.height - logoHeight));
      mark.style.right = 'auto';
      mark.style.bottom = 'auto';
      mark.style.left = `${box.left - container.left - parent.clientLeft + parent.scrollLeft + picture.x + picture.width * .978 - width}px`;
      mark.style.top = `${box.top - container.top - parent.clientTop + parent.scrollTop + picture.y + picture.height - inset - logoHeight}px`;
      mark.style.width = `${width}px`;
      mark.style.visibility = picture.width > 0 && picture.height > 0 ? 'visible' : 'hidden';
    };
    const resize = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    resize?.observe(parent);
    const bindVideo = () => {
      const next = parent.querySelector('video');
      if (next === video) return;
      if (video) {
        resize?.unobserve(video);
        video.removeEventListener('loadedmetadata', update);
        video.removeEventListener('resize', update);
        video.removeEventListener('emptied', update);
      }
      video = next;
      if (video) {
        resize?.observe(video);
        video.addEventListener('loadedmetadata', update);
        video.addEventListener('resize', update);
        video.addEventListener('emptied', update);
      }
      update();
    };
    // Exercise playback can attach its persistent video after this component mounts.
    const children = new MutationObserver(bindVideo);
    children.observe(parent, { childList: true, subtree: true });
    bindVideo();
    window.addEventListener('resize', update);
    return () => {
      children.disconnect();
      resize?.disconnect();
      window.removeEventListener('resize', update);
      video?.removeEventListener('loadedmetadata', update);
      video?.removeEventListener('resize', update);
      video?.removeEventListener('emptied', update);
    };
  }, [nativeControls, controlsClearance, sizeScale]);
  return <span ref={ref} className="lmm-video-watermark" style={{ visibility: 'hidden' }} data-native-controls={nativeControls || undefined} aria-hidden="true">
    <img src="/lmm-video-watermark.png" alt="" draggable={false} />
  </span>;
}
