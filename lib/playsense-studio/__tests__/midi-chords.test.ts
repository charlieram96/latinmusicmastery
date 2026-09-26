import { describe, expect, it, vi } from 'vitest';
import { ChordGrouper } from '../midi-chords';

describe('ChordGrouper', () => {
  it('groups a note 30 ms after the first into one chord', () => {
    const onNote = vi.fn();
    const onChordNote = vi.fn();
    const grouper = new ChordGrouper(onNote, onChordNote);
    grouper.noteOn(60, 0);
    grouper.noteOn(64, 30);
    expect(onNote).toHaveBeenCalledExactlyOnceWith(60);
    expect(onChordNote).toHaveBeenCalledExactlyOnceWith(64);
  });

  it('treats notes 60 ms apart as two separate notes', () => {
    const onNote = vi.fn();
    const onChordNote = vi.fn();
    const grouper = new ChordGrouper(onNote, onChordNote);
    grouper.noteOn(60, 0);
    grouper.noteOn(64, 60);
    expect(onNote).toHaveBeenNthCalledWith(1, 60);
    expect(onNote).toHaveBeenNthCalledWith(2, 64);
    expect(onNote).toHaveBeenCalledTimes(2);
    expect(onChordNote).not.toHaveBeenCalled();
  });

  it('groups three notes within 45 ms into one chord of three', () => {
    const onNote = vi.fn();
    const onChordNote = vi.fn();
    const grouper = new ChordGrouper(onNote, onChordNote);
    grouper.noteOn(60, 0);
    grouper.noteOn(64, 20);
    grouper.noteOn(67, 45);
    expect(onNote).toHaveBeenCalledExactlyOnceWith(60);
    expect(onChordNote).toHaveBeenNthCalledWith(1, 64);
    expect(onChordNote).toHaveBeenNthCalledWith(2, 67);
    expect(onChordNote).toHaveBeenCalledTimes(2);
  });

  it('starts a fresh window from the note that breaks out of the previous one', () => {
    const onNote = vi.fn();
    const onChordNote = vi.fn();
    const grouper = new ChordGrouper(onNote, onChordNote);
    grouper.noteOn(60, 0);
    grouper.noteOn(64, 100);
    grouper.noteOn(67, 120);
    expect(onNote).toHaveBeenNthCalledWith(1, 60);
    expect(onNote).toHaveBeenNthCalledWith(2, 64);
    expect(onNote).toHaveBeenCalledTimes(2);
    expect(onChordNote).toHaveBeenCalledExactlyOnceWith(67);
  });

  it('honors a custom window size', () => {
    const onNote = vi.fn();
    const onChordNote = vi.fn();
    const grouper = new ChordGrouper(onNote, onChordNote, 10);
    grouper.noteOn(60, 0);
    grouper.noteOn(64, 15);
    expect(onNote).toHaveBeenCalledTimes(2);
    expect(onChordNote).not.toHaveBeenCalled();
  });
});
