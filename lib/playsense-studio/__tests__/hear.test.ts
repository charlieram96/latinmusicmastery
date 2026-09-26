// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HEAR_KEY, hearMute, readHear, writeHear } from '../hear';

beforeEach(() => {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('hearMute', () => {
  it('mutes the recording for Score, whatever the admin chose', () => {
    expect(hearMute('score', false)).toBe(true);
    expect(hearMute('score', true)).toBe(true);
  });

  it("follows the admin's own mute for Recording and Both, so leaving Score restores it", () => {
    expect(hearMute('recording', false)).toBe(false);
    expect(hearMute('recording', true)).toBe(true);
    expect(hearMute('both', false)).toBe(false);
    expect(hearMute('both', true)).toBe(true);
  });
});

describe('readHear / writeHear', () => {
  it('defaults to Recording and round-trips a choice', () => {
    expect(readHear()).toBe('recording');
    writeHear('both');
    expect(window.localStorage.getItem(HEAR_KEY)).toBe('both');
    expect(readHear()).toBe('both');
    window.localStorage.setItem(HEAR_KEY, 'nonsense');
    expect(readHear()).toBe('recording');
  });

  it('falls back to Recording when storage throws', () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } });
    expect(readHear()).toBe('recording');
    expect(() => writeHear('score')).not.toThrow();
  });
});
