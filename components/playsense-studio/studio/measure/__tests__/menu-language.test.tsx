// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { studioText } from '@/lib/playsense-studio/i18n/text';
import { MeasureBar } from '../measure-bar';
import { RepeatPopover } from '../repeat-popover';

const language = vi.hoisted(() => ({ locale: 'es' as 'es' | 'en' }));
vi.mock('@/components/playsense-studio/studio/use-studio-text', () => ({
  useStudioText: () => (s: string) => studioText(s, language.locale),
}));

it('switches the visible measure commands, repeat title, hint and tooltips together', () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  const noop = () => {};
  const render = () => act(() => root.render(<>
    <MeasureBar docked left={0} top={0} label="m.1–2" startSeconds={0} bpm={100}
      looping={false} canLoop problems={{dup:null,paste:null,clear:null,del:null}}
      onEdit={noop} onLoop={noop} onRepeat={noop} onDup={noop} onCopy={noop}
      onPaste={noop} onBar={noop} onClear={noop} onDelete={noop} />
    <RepeatPopover anchor={{left:0,top:0}} range={[0,1]} group={null}
      problemFor={()=>null} onPick={noop} onRemove={noop} onSelectPassOne={noop} onClose={noop} />
  </>));
  try {
    render();
    const labels = () => Array.from(host.querySelectorAll('[role="toolbar"] button')).map(b=>b.getAttribute('aria-label'));
    expect(labels()).toEqual(['Editar','Bucle','Repetir','Duplicar','Copiar','Pegar','Propiedades del compás','Vaciar','Borrar']);
    expect(host.querySelector('.st-mpop-title')?.textContent).toBe('Repetir compás 1–2');
    expect(host.querySelector('.st-mpop-hint')?.textContent).toContain('Cada repetición');
    expect(host.querySelector('.st-mpop-chip')?.getAttribute('title')).toBe('Reproducir 2 veces');
    language.locale='en';
    render();
    expect(labels()).toContain('Bar properties');
    expect(labels()).toContain('Edit');
    expect(host.querySelector('.st-mpop-title')?.textContent).toBe('Play m.1–2 more than once');
    expect(host.querySelector('.st-mpop-hint')?.textContent).toContain('Each pass');
    expect(host.querySelector('.st-mpop-chip')?.getAttribute('title')).toBe('Play 2 times');
  } finally {
    act(()=>root.unmount());
    host.remove();
    language.locale='es';
  }
});
