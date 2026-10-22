import {describe, expect, it} from 'vitest';
import {localizedScoreText} from '../score-text';
describe('imported score display language', () => {
 it('resolves imported abbreviations and both language directions', () => {
  expect(localizedScoreText('Relleno Mano Izq Cascara','en')).toBe('Cáscara fill · Left hand');
  expect(localizedScoreText('Cáscara fill · Left hand','es')).toBe('Relleno mano izquierda cáscara');
 });
 it('preserves upload order and instance identifiers', () => {
  expect(localizedScoreText('2 · Relleno mano izquierda cáscara A2','en')).toBe('2 · Cáscara fill · Left hand A2');
 });
 it('keeps unknown authored titles unchanged', () => {
  expect(localizedScoreText('Mi composición personal','en')).toBe('Mi composición personal');
 });
});
