import { describe, expect, it } from 'vitest';
import { exportOptionsReducer, initialExportOptions } from '../export-options';

describe('export options', () => {
  it('starts with PDF, every track and the remembered page size', () => {
    const s = initialExportOptions(3, 'a4');
    expect(s.format).toBe('pdf');
    expect(s.trackIndexes).toEqual([0, 1, 2]);
    expect(s.pdf.pageSize).toBe('a4');
    expect(s.pdf).toMatchObject({ includeHeader: true, includeMeasureNumbers: true, includeBranding: true, expandRepeats: false });
  });
  it('toggles tracks but never unchecks the last one', () => {
    let s = initialExportOptions(2, 'letter');
    s = exportOptionsReducer(s, { type: 'toggleTrack', trackIndex: 0 });
    expect(s.trackIndexes).toEqual([1]);
    s = exportOptionsReducer(s, { type: 'toggleTrack', trackIndex: 1 });
    expect(s.trackIndexes).toEqual([1]);
    s = exportOptionsReducer(s, { type: 'toggleTrack', trackIndex: 0 });
    expect(s.trackIndexes).toEqual([0, 1]);
  });
  it('switches format and flips include flags', () => {
    let s = initialExportOptions(1, 'letter');
    s = exportOptionsReducer(s, { type: 'format', format: 'midi' });
    expect(s.format).toBe('midi');
    s = exportOptionsReducer(s, { type: 'toggle', key: 'includeBranding' });
    expect(s.pdf.includeBranding).toBe(false);
    s = exportOptionsReducer(s, { type: 'pageSize', pageSize: 'a4' });
    expect(s.pdf.pageSize).toBe('a4');
  });
});
