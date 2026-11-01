import { Component } from '@angular/core';
import { ABOUT_CONTENT } from './about.content';

/**
 * El diagrama de hilos del caso de estudio (PLAN fase 7): el hilo principal, el de audio y los dos
 * workers, con lo que va de uno a otro. SVG propio con los colores de los tokens; el texto de la
 * figura lo cuenta entero para los lectores de pantalla (el SVG es una sola imagen).
 */
@Component({
  selector: 'trn-threads-diagram',
  template: `
    <svg viewBox="0 0 720 400" role="img" [attr.aria-label]="text.diagram">
      <defs>
        <marker
          id="flecha"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M0 0L10 5L0 10z" class="arrowhead" />
        </marker>
      </defs>

      <!-- Hilo principal -->
      <rect x="0" y="40" width="280" height="200" rx="20" class="box" />
      <text x="24" y="78" class="title">{{ labels.main }}</text>
      @for (item of labels.mainItems; track item; let i = $index) {
        <text [attr.x]="24" [attr.y]="122 + i * 36" class="item">{{ item }}</text>
      }

      <!-- Hilo de audio -->
      <rect x="440" y="40" width="280" height="200" rx="20" class="box box--audio" />
      <text x="464" y="78" class="title">{{ labels.audio }}</text>
      @for (item of labels.audioItems; track item; let i = $index) {
        <text [attr.x]="464" [attr.y]="122 + i * 36" class="item">{{ item }}</text>
      }

      <!-- Mensajes entre los dos -->
      <line x1="288" y1="118" x2="432" y2="118" class="arrow" marker-end="url(#flecha)" />
      <text x="360" y="106" class="label" text-anchor="middle">{{ labels.commands }}</text>
      <line x1="432" y1="170" x2="288" y2="170" class="arrow" marker-end="url(#flecha)" />
      <text x="360" y="196" class="label" text-anchor="middle">{{ labels.status }}</text>

      <!-- Entrada y salida del audio -->
      <text x="580" y="20" class="label" text-anchor="middle">{{ labels.mic }}</text>
      <line x1="580" y1="28" x2="580" y2="36" class="arrow" marker-end="url(#flecha)" />
      <line x1="580" y1="244" x2="580" y2="290" class="arrow" marker-end="url(#flecha)" />
      <text x="580" y="312" class="label" text-anchor="middle">{{ labels.out }}</text>

      <!-- Workers -->
      <rect x="0" y="300" width="200" height="64" rx="16" class="box box--worker" />
      <text x="100" y="338" class="item" text-anchor="middle">{{ labels.synth }}</text>
      <rect x="220" y="300" width="200" height="64" rx="16" class="box box--worker" />
      <text x="320" y="338" class="item" text-anchor="middle">{{ labels.export }}</text>
      <line x1="100" y1="296" x2="100" y2="248" class="arrow" marker-end="url(#flecha)" />
      <line x1="320" y1="248" x2="320" y2="296" class="arrow" marker-end="url(#flecha)" />
    </svg>
  `,
  styles: `
    :host {
      display: block;
    }

    svg {
      inline-size: 100%;
      block-size: auto;
      font-family: var(--font-text);
    }

    .box {
      fill: var(--color-surface);
    }

    .box--audio {
      fill: var(--color-screen);
    }

    .box--worker {
      fill: var(--color-surface-2);
    }

    .title {
      fill: var(--color-ink);
      font-size: 22px;
      font-weight: 600;
    }

    .box--audio + .title {
      fill: var(--color-phosphor);
    }

    .item {
      fill: var(--color-ink);
      font-size: 17px;
    }

    .label {
      fill: var(--color-ink-muted);
      font-size: 15px;
    }

    .arrow {
      stroke: var(--color-ink-muted);
      stroke-width: 2;
    }

    .arrowhead {
      fill: var(--color-ink-muted);
    }
  `,
})
export class ThreadsDiagram {
  protected readonly text = ABOUT_CONTENT.architecture;
  protected readonly labels = ABOUT_CONTENT.architecture.labels;
}
