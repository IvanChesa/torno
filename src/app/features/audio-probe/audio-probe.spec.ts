import { TestBed } from '@angular/core/testing';
import { AudioProbe } from './audio-probe';
import { AUDIO_PROBE_CONTENT } from './audio-probe.content';

describe('AudioProbe', () => {
  async function render() {
    const fixture = TestBed.createComponent(AudioProbe);
    await fixture.whenStable();
    return { fixture, root: fixture.nativeElement as HTMLElement };
  }

  it('no hace nada hasta que se pulsa: dos botones nativos y dos estados en reposo', async () => {
    const { root } = await render();
    const buttons = [...root.querySelectorAll('button')];
    expect(buttons.map((b) => b.textContent?.trim())).toEqual([
      AUDIO_PROBE_CONTENT.worklet.action,
      AUDIO_PROBE_CONTENT.synth.action,
    ]);
    expect(buttons.every((b) => b.type === 'button')).toBe(true);
    for (const status of root.querySelectorAll('[role="status"]')) {
      expect(status.getAttribute('data-state')).toBe('idle');
      expect(status.textContent?.trim()).toBe(AUDIO_PROBE_CONTENT.idle);
    }
  });

  // jsdom no tiene Web Audio: el error tiene que verse, no perderse en la consola.
  it('si el navegador no tiene Web Audio, lo dice en el estado', async () => {
    const { fixture, root } = await render();
    root.querySelector('button')?.click();
    await fixture.whenStable();
    const status = root.querySelector('[data-testid="worklet-probe"]');
    expect(status?.getAttribute('data-state')).toBe('error');
    expect(status?.textContent).toContain('Este navegador no tiene Web Audio.');
  });
});
