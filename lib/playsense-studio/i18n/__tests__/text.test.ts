import { describe, expect, it } from 'vitest';
import { studioText, symbolCaption } from '../text';
describe('Studio interface language', () => {
 it('normalizes legacy Spanish labels for English and translates English into Spanish', () => {
  expect(studioText('Editar nota', 'en')).toBe('Edit note');
  expect(studioText('Sync video', 'es')).toBe('Sincronizar video');
  expect(studioText('Clave', 'en')).toBe('Clave');
  expect(studioText('BPM', 'es')).toBe('BPM');
  expect(studioText(' My custom lesson ', 'es')).toBe(' My custom lesson ');
 });
 it('preserves spacing and formats translated counters and SMuFL descriptions', () => {
  expect(studioText('Measure ', 'es')).toBe('Compás ');
  expect(studioText('3 unpublished changes','es')).toBe('3 cambios sin publicar');
  expect(symbolCaption('harpPedalRaised','es')).toBe('arpa pedal elevado');
  expect(symbolCaption('dynamicMF','en')).toBe('dynamic MF');
 });
});
