import { Component, computed, signal, type WritableSignal } from '@angular/core';
import {
  runSynthProbe,
  runWorkletProbe,
  unlockAudio,
  type SynthProbeResult,
  type WorkletProbeResult,
} from '../../audio/engine';
import { formatDbfs, formatNumber } from '../../core/format';
import { AUDIO_PROBE_CONTENT } from './audio-probe.content';

type ProbeState<T> =
  | { readonly status: 'idle' }
  | { readonly status: 'running' }
  | { readonly status: 'done'; readonly result: T }
  | { readonly status: 'error'; readonly message: string };

const text = AUDIO_PROBE_CONTENT;

/**
 * Prueba técnica de la fase 0 (temporal): el pitido por el AudioWorklet y el tono del worker de
 * síntesis. El contexto de audio se crea y se reanuda dentro del clic, antes de cualquier `await`
 * (PLAN §4.9); el motor se carga después, con `import()`.
 */
@Component({
  selector: 'trn-audio-probe',
  template: `
    <div class="probe">
      <h3>{{ text.worklet.title }}</h3>
      <p>{{ text.worklet.description }}</p>
      <button type="button" class="button" (click)="probeWorklet()">
        {{ text.worklet.action }}
      </button>
      <p
        class="probe__result mono"
        role="status"
        data-testid="worklet-probe"
        [attr.data-state]="worklet().status"
        [attr.data-peak-dbfs]="workletResult()?.peakDbfs"
        [attr.data-frames]="workletResult()?.frames"
        [attr.data-expected-frames]="workletResult()?.expectedFrames"
        [attr.data-context-state]="workletResult()?.contextState"
      >
        {{ workletText() }}
      </p>
    </div>

    <div class="probe">
      <h3>{{ text.synth.title }}</h3>
      <p>{{ text.synth.description }}</p>
      <button type="button" class="button" (click)="probeSynth()">{{ text.synth.action }}</button>
      <p
        class="probe__result mono"
        role="status"
        data-testid="synth-probe"
        [attr.data-state]="synth().status"
        [attr.data-peak-dbfs]="synthResult()?.peakDbfs"
        [attr.data-frames]="synthResult()?.frames"
        [attr.data-expected-frames]="synthResult()?.expectedFrames"
      >
        {{ synthText() }}
      </p>
    </div>
  `,
  styles: `
    :host {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 22rem), 1fr));
      gap: var(--space-5);
    }

    .probe {
      display: grid;
      align-content: start;
      justify-items: start;
      gap: var(--space-4);
      padding: var(--space-6);
      border-radius: var(--radius-panel);
      background: var(--color-surface);
    }

    .probe__result {
      min-block-size: 3lh;
      color: var(--color-ink-muted);
    }
  `,
})
export class AudioProbe {
  protected readonly text = text;
  protected readonly worklet = signal<ProbeState<WorkletProbeResult>>({ status: 'idle' });
  protected readonly synth = signal<ProbeState<SynthProbeResult>>({ status: 'idle' });

  protected readonly workletResult = computed(() => resultOf(this.worklet()));
  protected readonly synthResult = computed(() => resultOf(this.synth()));

  protected readonly workletText = computed(() =>
    describe(this.worklet(), (r) =>
      [
        `Ha sonado: ${formatNumber(r.frames)} de ${formatNumber(r.expectedFrames)} muestras a ${formatNumber(r.sampleRate)} Hz.`,
        `Pico de ${formatDbfs(r.peakDbfs)}. Módulo cargado en ${formatNumber(r.moduleLoadMs)} ms.`,
      ].join(' '),
    ),
  );

  protected readonly synthText = computed(() =>
    describe(this.synth(), (r) =>
      [
        `Ha sonado: ${formatNumber(r.frames)} de ${formatNumber(r.expectedFrames)} muestras a ${formatNumber(r.sampleRate)} Hz,`,
        `renderizadas en ${formatNumber(r.renderMs, 1)} ms. Pico de ${formatDbfs(r.peakDbfs)}.`,
      ].join(' '),
    ),
  );

  protected probeWorklet(): Promise<void> {
    return this.run(this.worklet, runWorkletProbe);
  }

  protected probeSynth(): Promise<void> {
    return this.run(this.synth, runSynthProbe);
  }

  private async run<T>(
    state: WritableSignal<ProbeState<T>>,
    probe: () => Promise<T>,
  ): Promise<void> {
    if (state().status === 'running') return;
    try {
      // Dentro del gesto y antes de cualquier await: crea y reanuda el contexto (PLAN §4.9).
      unlockAudio();
    } catch (error) {
      state.set({ status: 'error', message: messageOf(error) });
      return;
    }
    state.set({ status: 'running' });
    try {
      state.set({ status: 'done', result: await probe() });
    } catch (error) {
      state.set({ status: 'error', message: messageOf(error) });
    }
  }
}

function resultOf<T>(state: ProbeState<T>): T | undefined {
  return state.status === 'done' ? state.result : undefined;
}

function describe<T>(state: ProbeState<T>, done: (result: T) => string): string {
  switch (state.status) {
    case 'idle':
      return text.idle;
    case 'running':
      return text.running;
    case 'done':
      return done(state.result);
    case 'error':
      return `${text.errorPrefix} ${state.message}`;
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
