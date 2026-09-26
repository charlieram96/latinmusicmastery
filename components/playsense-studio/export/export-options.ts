import { DEFAULT_PDF_OPTIONS, type ExportFormat, type PdfExportOptions } from '@/lib/playsense-studio/export';
import type { PageSize } from '@/lib/playsense-studio/export/pdf/page-plan';

export const PAGE_SIZE_STORAGE_KEY = 'playsense-export-page-size';

export interface ExportOptionsState { format: ExportFormat; trackIndexes: number[]; pdf: PdfExportOptions }

export type ExportOptionsAction =
  | { type: 'format'; format: ExportFormat }
  | { type: 'toggleTrack'; trackIndex: number }
  | { type: 'pageSize'; pageSize: PageSize }
  | { type: 'toggle'; key: 'includeHeader' | 'includeMeasureNumbers' | 'includeBranding' | 'expandRepeats' };

export function initialExportOptions(trackCount: number, pageSize: PageSize): ExportOptionsState {
  return { format: 'pdf', trackIndexes: Array.from({ length: trackCount }, (_, i) => i), pdf: { ...DEFAULT_PDF_OPTIONS, pageSize } };
}

export function exportOptionsReducer(state: ExportOptionsState, action: ExportOptionsAction): ExportOptionsState {
  switch (action.type) {
    case 'format':
      return { ...state, format: action.format };
    case 'toggleTrack': {
      const has = state.trackIndexes.includes(action.trackIndex);
      if (has && state.trackIndexes.length === 1) return state;
      const next = has ? state.trackIndexes.filter(i => i !== action.trackIndex) : [...state.trackIndexes, action.trackIndex].sort((a, b) => a - b);
      return { ...state, trackIndexes: next };
    }
    case 'pageSize':
      return { ...state, pdf: { ...state.pdf, pageSize: action.pageSize } };
    case 'toggle':
      return { ...state, pdf: { ...state.pdf, [action.key]: !state.pdf[action.key] } };
  }
}
