// PlaySense Studio — setting the reference video's speed from the Studio
// (the speed menu, the Loop speed chip). Slowing a passage down to check it
// should keep it in key, so every Studio-initiated rate change also turns on
// pitch preservation, vendor variants included. The flex driver
// (use-flex-playback) sets its own; a Studio with backing tracks playing still
// turns it off on ratechange (use-backing-mixer keeps video and backing in one
// key, like tape).

type PitchPreservingVideo = HTMLVideoElement & {
  webkitPreservesPitch?: boolean;
  mozPreservesPitch?: boolean;
};

export const LOOP_SPEEDS = [1, 0.75, 0.5] as const;

export function applyStudioRate(video: PitchPreservingVideo, rate: number): void {
  video.preservesPitch = true;
  if ('webkitPreservesPitch' in video) video.webkitPreservesPitch = true;
  if ('mozPreservesPitch' in video) video.mozPreservesPitch = true;
  video.playbackRate = rate;
}
