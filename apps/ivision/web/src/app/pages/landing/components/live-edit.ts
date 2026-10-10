import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DemoScene, DemoSceneKind } from './demo-scene';
import { DisplayTitle } from './display-title';
import { InView } from './in-view';
import { Wrap } from './wrap';
import { LandingArt } from './landing-art';

/** Les étapes d'une frappe : effacer jusqu'à la partie commune, puis taper la suite. */
function keystrokes(from: string, to: string): string[] {
  let common = 0;
  while (common < from.length && from[common] === to[common]) common++;
  const steps: string[] = [];
  for (let n = from.length - 1; n >= common; n--) steps.push(from.slice(0, n));
  for (let n = common + 1; n <= to.length; n++) steps.push(to.slice(0, n));
  return steps;
}

const HOLD_MS = 2600;
const KEY_MS = 170;

/**
 * « Cliquez. Écrivez. C'est changé. » : le feuillet et le calame, puis l'éditeur tel qu'il est
 * dans l'atelier. Le texte du plan 2 se retape tout seul quand la section arrive à l'écran
 * (−30 % devient −40 %, puis revient) : la vidéo et sa vignette changent pendant la frappe.
 * Les commandes sont inertes : c'est une démonstration, pas un formulaire.
 */
@Component({
  selector: 'iv-landing-live-edit',
  imports: [TranslateModule, DemoScene, DisplayTitle, InView, LandingArt, Wrap],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <section id="retouche" ivWrap class="scroll-mt-20 py-20 lg:py-28">
      <div class="grid items-center gap-10 lg:grid-cols-12">
        <div class="lg:col-span-7">
          <iv-display-title [lines]="'landing.liveEdit.title' | translate" />
          <p class="mt-8 max-w-xl text-lg text-text-secondary">{{ 'landing.liveEdit.text' | translate }}</p>
        </div>
        <iv-landing-art kind="calame" ivInView class="mx-auto w-full max-w-sm text-text-primary sm:max-w-md lg:col-span-5 lg:max-w-none" />
      </div>

      <figure class="glass-card editor mt-16 p-3 sm:p-5" ivInView (ivInViewEnter)="start()">
        <figcaption class="sr-only">{{ 'landing.liveEdit.screen' | translate }}</figcaption>
        <div class="grid gap-5 lg:grid-cols-[1fr_18rem]" inert aria-hidden="true">
          <div class="min-w-0">
            <div class="relative aspect-video overflow-hidden rounded-lg shadow-lg">
              <iv-demo-scene class="absolute inset-0" scene="offer" [offer]="text()" [editing]="true" />
            </div>

            <!-- La frise des plans : la tête de lecture est sur le plan qu'on retouche. -->
            <p class="sr-only">{{ 'landing.liveEdit.timeline' | translate }}</p>
            <div class="mt-5 grid grid-cols-4 gap-2 text-[11px] tabular-nums text-text-tertiary">
              <span>00:00</span><span>00:02</span><span>00:04</span><span class="flex justify-between"><span>00:06</span><span>00:09</span></span>
            </div>
            <div class="relative mt-2 grid grid-cols-4 gap-2">
              @for (s of scenes; track s) {
                <div class="relative aspect-video overflow-hidden rounded-md" [class.is-current]="s === 'offer'">
                  <iv-demo-scene class="absolute inset-0" [scene]="s" [offer]="s === 'offer' ? text() : null" />
                </div>
              }
              <span class="playhead"></span>
            </div>
          </div>

          <div class="flex flex-col gap-4 rounded-lg border border-[var(--glass-border)] p-4">
            <span class="text-xs font-semibold uppercase text-text-tertiary">{{ 'landing.liveEdit.field' | translate }}</span>
            <input type="text" readonly tabindex="-1" [value]="text() ?? ('landing.demo.offer' | translate)" />
            <span class="saved flex items-center gap-2 text-sm font-semibold" [class.is-visible]="saved()">
              <i class="pi pi-check" aria-hidden="true"></i> {{ 'landing.liveEdit.saved' | translate }}
            </span>
          </div>
        </div>
      </figure>
    </section>
  `,
  styles: `
    .editor:hover {
      transform: none;
    }
    .is-current {
      outline: 2px solid var(--color-primary-500);
      outline-offset: 2px;
    }
    /* La tête de lecture, au début du plan 2. */
    .playhead {
      position: absolute;
      top: -0.5rem;
      bottom: -0.5rem;
      left: calc(25% + 0.125rem);
      width: 2px;
      border-radius: 1px;
      background: var(--color-primary-500);
    }
    .playhead::before {
      content: '';
      position: absolute;
      top: -0.25rem;
      left: -0.3rem;
      width: 0.75rem;
      height: 0.5rem;
      border-radius: 2px;
      background: var(--color-primary-500);
    }
    .saved {
      color: var(--color-success);
      opacity: 0;
      transition: opacity 0.3s ease;
    }
    .saved.is-visible {
      opacity: 1;
    }
  `,
})
export class LandingLiveEdit {
  private readonly translate = inject(TranslateService);
  protected readonly scenes: DemoSceneKind[] = ['hook', 'offer', 'date', 'brand'];
  protected readonly text = signal<string | null>(null);
  protected readonly saved = signal(true);

  private timer: ReturnType<typeof setTimeout> | undefined;
  private started = false;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
  }

  /** Lancée quand l'éditeur arrive à l'écran ; jamais si le visiteur réduit les animations. */
  protected start(): void {
    if (this.started || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    this.started = true;
    this.cycle(true);
  }

  /** Une retouche : −30 % → −40 % (ou l'inverse), touche après touche, puis « Enregistré ». */
  private cycle(forward: boolean): void {
    const a = this.translate.instant('landing.demo.offer') as string;
    const b = this.translate.instant('landing.demo.offerEdited') as string;
    const steps = forward ? keystrokes(a, b) : keystrokes(b, a);
    let i = 0;
    const type = () => {
      if (i < steps.length) {
        this.saved.set(false);
        this.text.set(steps[i++]);
        this.timer = setTimeout(type, KEY_MS);
      } else {
        this.saved.set(true);
        this.timer = setTimeout(() => this.cycle(!forward), HOLD_MS);
      }
    };
    this.timer = setTimeout(type, HOLD_MS / 2);
  }
}
