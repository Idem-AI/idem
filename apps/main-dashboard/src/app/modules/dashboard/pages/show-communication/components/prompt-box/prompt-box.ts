import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { FlyerFormat } from '../../../../models/communication.model';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import { WriteOnlyDirective } from '../../../../../team/directives/write-only.directive';

/** `auto` : l'atelier choisit la forme d'après la demande. */
type FormatChoice = 'auto' | Extract<FlyerFormat, 'square' | 'story' | 'banner' | 'a4'>;

const FORMATS: readonly FormatChoice[] = ['auto', 'square', 'story', 'banner', 'a4'];

let nextId = 0;

/**
 * La demande ponctuelle : une phrase, et le visuel sort à la charte.
 *
 * Il n'y a plus de catégories à choisir (« annonce, promotion, événement… ») :
 * la personne écrit ce qu'elle veut — « un visuel pour souhaiter une bonne
 * année » — et c'est tout. Le format et le nombre de propositions sont des
 * réglages avancés, repliés par défaut : sans y toucher, l'atelier décide.
 *
 * Ce que les réglages changent est ajouté EN TOUTES LETTRES à la phrase
 * envoyée : un seul chemin côté serveur, et le fil garde une trace lisible de
 * ce qui a été demandé.
 */
@Component({
  selector: 'app-prompt-box',
  imports: [WriteOnlyDirective, FormsModule, TranslateModule, IdemLoaderComponent],
  templateUrl: './prompt-box.html',
  styleUrl: './prompt-box.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PromptBox {
  private readonly translate = inject(TranslateService);

  /** Le texte saisi — lié dans les deux sens : le fil y dépose une retouche proposée. */
  readonly text = model('');
  /** Vrai pendant qu'un visuel se fabrique : on ne relance pas un second achat. */
  readonly busy = input(false);
  /** Clé de traduction du texte d'exemple. */
  readonly placeholder = input('dashboard.showCommunication.prompt.placeholder');
  readonly rows = input(3);

  readonly submitted = output<string>();

  protected readonly id = `pb-${++nextId}`;
  protected readonly formats = FORMATS;
  protected readonly advancedOpen = signal(false);
  protected readonly format = signal<FormatChoice>('auto');
  protected readonly variants = signal(false);

  protected readonly canSend = computed(() => !this.busy() && this.text().trim().length > 0);

  /** Ce qui a été réglé, rappelé à côté du lien quand le panneau est replié. */
  protected readonly summary = computed(() => {
    const parts: string[] = [];
    if (this.format() !== 'auto') {
      parts.push(
        this.translate.instant(`dashboard.showCommunication.prompt.formats.${this.format()}`),
      );
    }
    if (this.variants()) {
      parts.push(this.translate.instant('dashboard.showCommunication.prompt.variantsShort'));
    }
    return parts.join(' · ');
  });

  protected toggleAdvanced(): void {
    this.advancedOpen.update((open) => !open);
  }

  /** Entrée = envoyer, Maj+Entrée = retour à la ligne. */
  protected onEnter(event: Event): void {
    if ((event as KeyboardEvent).shiftKey) return;
    event.preventDefault();
    this.submit();
  }

  protected submit(): void {
    const text = this.text().trim();
    if (!text || this.busy()) return;

    const t = (key: string, params?: Record<string, unknown>) =>
      this.translate.instant(`dashboard.showCommunication.prompt.${key}`, params) as string;

    const format = this.format();
    const sentence = [
      text,
      format === 'auto' ? '' : t('asFormat', { format: t(`formatPrompts.${format}`) }),
      this.variants() ? t('variantsPrompt') : '',
    ]
      .filter(Boolean)
      .join(' ');

    this.submitted.emit(sentence);
    // Retour aux réglages par défaut : trois propositions coûtent plus cher, on
    // ne les refacture pas à la demande suivante sans qu'on l'ait redemandé.
    this.text.set('');
    this.format.set('auto');
    this.variants.set(false);
    this.advancedOpen.set(false);
  }
}
