import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, input, output, signal, untracked, viewChild } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { ChatQuestion } from '../../../core/models';

let uid = 0;

/**
 * DES QUESTIONS À CLIQUER, comme un assistant les pose : une à la fois, chaque choix expliqué en une ligne,
 * celui qui convient le mieux marqué « Recommandé ». On revient en arrière d'un clic ; « Choisir pour moi »
 * prend les choix recommandés des questions restantes. Rien à écrire : le dernier clic envoie les réponses.
 */
@Component({
  selector: 'iv-ask-choices',
  imports: [TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (current(); as q) {
      <div class="mt-3 flex flex-col gap-2" role="group" [attr.aria-labelledby]="headingId">
        <div class="flex items-center gap-2">
          @if (questions().length > 1) {
            <span class="text-xs tabular-nums text-[var(--color-text-tertiary)]">{{ 'chat.choices.step' | translate: { current: step() + 1, total: questions().length } }}</span>
          }
          <span class="ml-auto flex items-center gap-1">
            @if (step() > 0) {
              <button type="button" class="button-ghost button-sm !px-2" [disabled]="disabled()" (click)="back()">
                <i class="pi pi-arrow-left text-xs" aria-hidden="true"></i> {{ 'chat.choices.back' | translate }}
              </button>
            }
            @if (hasRecommended()) {
              <button type="button" class="button-ghost button-sm !px-2" [disabled]="disabled()" (click)="chooseForMe()">{{ 'chat.choices.forMe' | translate }}</button>
            }
          </span>
        </div>
        @if (questions().length > 1 || showQuestion()) {
          <p #heading [id]="headingId" class="font-medium outline-none" tabindex="-1">{{ q.question }}</p>
        } @else {
          <span [id]="headingId" class="sr-only">{{ q.question }}</span>
        }
        <ul class="flex flex-col gap-2" role="list">
          @for (o of ordered(); track o.id) {
            <li>
              <button
                type="button"
                class="outer-button flex w-full flex-col items-start gap-0.5 !py-2.5 text-left"
                [style.border-color]="values()[q.id] === o.id ? 'var(--color-primary-500)' : null"
                [attr.aria-pressed]="values()[q.id] === o.id"
                [disabled]="disabled()"
                (click)="pick(q.id, o.id)"
              >
                <span class="flex w-full flex-wrap items-center gap-2">
                  <span class="text-sm font-medium">{{ o.label }}</span>
                  @if (o.recommended) {
                    <span class="tag !py-0 !text-[11px] text-[var(--color-primary-500)]">{{ 'chat.choices.recommended' | translate }}</span>
                  }
                </span>
                @if (o.description) {
                  <span class="text-xs text-[var(--color-text-tertiary)]">{{ o.description }}</span>
                }
              </button>
            </li>
          }
        </ul>
      </div>
    }
  `,
})
export class AskChoices {
  readonly questions = input.required<ChatQuestion[]>();
  readonly disabled = input(false);
  /** Une question unique dont le texte est déjà le message de l'assistant : ne pas la répéter. */
  readonly showQuestion = input(true);
  /** Toutes les réponses, une par question. */
  readonly answered = output<Record<string, string>>();

  protected readonly headingId = `iv-choices-${++uid}`;
  protected readonly step = signal(0);
  protected readonly values = signal<Record<string, string>>({});
  protected readonly current = computed(() => this.questions()[this.step()] ?? null);
  /** Le choix recommandé toujours en tête, les autres dans l'ordre donné (comme les assistants le présentent). */
  protected readonly ordered = computed(() => {
    const options = this.current()?.options ?? [];
    return [...options.filter((o) => o.recommended), ...options.filter((o) => !o.recommended)];
  });
  protected readonly hasRecommended = computed(() => this.questions().slice(this.step()).some((q) => q.options.some((o) => o.recommended)));
  private readonly heading = viewChild<ElementRef<HTMLElement>>('heading');

  constructor() {
    // La question suivante prend le focus (lecteurs d'écran, clavier) — pas la première, posée par le fil.
    effect(() => {
      const step = this.step();
      const el = this.heading()?.nativeElement;
      untracked(() => {
        if (step > 0 && el) queueMicrotask(() => el.focus());
      });
    });
  }

  protected pick(questionId: string, optionId: string): void {
    const values = { ...this.values(), [questionId]: optionId };
    this.values.set(values);
    if (this.step() < this.questions().length - 1) this.step.update((n) => n + 1);
    else this.answered.emit(values);
  }

  protected back(): void {
    this.step.update((n) => Math.max(0, n - 1));
  }

  /** Les choix recommandés pour les questions restantes (les réponses déjà données sont gardées). */
  protected chooseForMe(): void {
    const values = { ...this.values() };
    for (const q of this.questions().slice(this.step())) {
      if (values[q.id] && q !== this.current()) continue;
      const best = q.options.find((o) => o.recommended) ?? q.options[0];
      if (best) values[q.id] = best.id;
    }
    this.values.set(values);
    this.answered.emit(values);
  }
}
