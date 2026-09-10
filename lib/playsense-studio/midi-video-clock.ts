export type MidiRecordingVideo = {
  element: HTMLVideoElement;
  startSeconds: number;
  onStop?: (seconds: number) => void;
  beatAtSeconds?: (seconds: number) => number;
};

function waitForMedia(video: HTMLVideoElement, ready: () => boolean, signal: AbortSignal) {
  if (signal.aborted) return Promise.reject(new Error('Recording cancelled.'));
  if (ready()) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const events = ['loadedmetadata', 'loadeddata', 'canplay', 'seeked', 'timeupdate'];
    const cleanup = () => { clearTimeout(timer); events.forEach(e => video.removeEventListener(e, check)); video.removeEventListener('error', fail); signal.removeEventListener('abort', cancel); };
    const check = () => { if (ready()) { cleanup(); resolve(); } };
    const fail = () => { cleanup(); reject(new Error('The reference video could not load. Check the video and try again.')); };
    const cancel = () => { cleanup(); reject(new Error('Recording cancelled.')); };
    const timer = setTimeout(fail, 15000);
    events.forEach(e => video.addEventListener(e, check));
    video.addEventListener('error', fail); signal.addEventListener('abort', cancel);
  });
}

/** MIDI timestamps are measured in source-video milliseconds, including at
 * reduced playback speeds. Buffering never advances the recording clock. */
export class MidiVideoClock {
  playing = false;
  requested = false;
  private started = false;
  private playingSince = Infinity;
  private lastMs = 0;
  private cleanups: (() => void)[] = [];
  private abort = new AbortController();
  private disposed = false;
  constructor(readonly options: MidiRecordingVideo, private interrupt: (reason?: string) => void) {}

  async prepare() {
    const v = this.options.element;
    v.pause(); v.loop = false;
    await waitForMedia(v, () => v.readyState >= 1, this.abort.signal);
    if (Number.isFinite(v.duration) && this.options.startSeconds >= v.duration) throw new Error('Move the playhead before the end of the video to record.');
    v.currentTime = this.options.startSeconds;
    await waitForMedia(v, () => !v.seeking && v.readyState >= 2 && Math.abs(v.currentTime - this.options.startSeconds) < .1, this.abort.signal);
  }

  async play() {
    this.requested = true;
    const v = this.options.element;
    const listen = (event: string, fn: () => void) => { v.addEventListener(event, fn); this.cleanups.push(() => v.removeEventListener(event, fn)); };
    listen('playing', () => { this.started = true; this.playing = true; this.playingSince = performance.now(); });
    listen('waiting', () => { this.read(); this.playing = false; });
    listen('pause', () => { this.read(); this.playing = false; if (this.started && !v.ended) this.interrupt(); });
    listen('ended', () => { this.read(); this.interrupt(); });
    listen('seeking', () => { this.playing = false; this.interrupt('Recording stopped because the video was moved. Your captured notes have been kept.'); });
    listen('error', () => this.interrupt('The reference video was interrupted. Your captured notes have been kept.'));
    await v.play();
    if (this.disposed) v.pause();
  }

  read() {
    const v = this.options.element;
    if (this.started && !v.seeking) this.lastMs = Math.max(this.lastMs, (v.currentTime - this.options.startSeconds) * 1000);
    return this.lastMs;
  }

  timestamp(stamp: number, now: number) {
    if (!this.playing || stamp < this.playingSince || this.options.element.seeking) return null;
    return Math.max(0, this.read() - Math.max(0, now - stamp) * this.options.element.playbackRate);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.abort.abort();
    this.cleanups.forEach(fn => fn()); this.cleanups = [];
    this.options.element.pause();
    this.options.onStop?.(this.options.startSeconds + this.lastMs / 1000);
  }
}
