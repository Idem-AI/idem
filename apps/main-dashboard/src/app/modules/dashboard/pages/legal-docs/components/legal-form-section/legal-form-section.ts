import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import {
  LegalFormCode,
  LegalFormEntry,
  LegalFormRecommendation,
  LegalReason,
} from '../../../../models/legalDocs.model';
import { FORM_SCENES, LegalIllustrationComponent } from '../legal-illustration/legal-illustration';

/**
 * Choix de la forme juridique : la recommandation et ses raisons d'abord,
 * puis, à la demande, la comparaison de toutes les formes du pays.
 *
 * Une entreprise n'a qu'une forme : ce composant ne propose donc qu'un choix
 * unique, et prévient quand il rend les statuts existants caducs.
 */
@Component({
  selector: 'app-legal-form-section',
  imports: [TranslateModule, IdemLoaderComponent, LegalIllustrationComponent],
  templateUrl: './legal-form-section.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LegalFormSectionComponent {
  readonly forms = input.required<LegalFormEntry[]>();
  readonly recommendation = input.required<LegalFormRecommendation>();
  /** Forme retenue par l'utilisateur, vide tant qu'il n'a pas choisi */
  readonly chosen = input<LegalFormCode | null>(null);
  /** Forme des statuts déjà rédigés, s'il y en a */
  readonly statutesForm = input<LegalFormCode | null>(null);
  readonly projectName = input('');
  readonly lang = input<'fr' | 'en'>('fr');
  readonly saving = input(false);

  readonly choose = output<LegalFormCode>();

  protected readonly comparing = signal(false);
  private readonly focusedCode = signal<LegalFormCode | null>(null);

  protected readonly scenes = FORM_SCENES;

  protected readonly recommended = computed(() => this.find(this.recommendation().code));
  protected readonly alternative = computed(() => {
    const alt = this.recommendation().alternative;
    const form = alt ? this.find(alt.code) : undefined;
    return alt && form ? { form, reason: alt.reason } : null;
  });
  protected readonly chosenForm = computed(() => {
    const code = this.chosen();
    return code ? this.find(code) : undefined;
  });
  /** Forme détaillée dans la comparaison */
  protected readonly focused = computed(
    () =>
      this.find(this.focusedCode() ?? this.chosen() ?? this.recommendation().code) ??
      this.forms()[0],
  );

  protected readonly statutesAcronym = computed(() => {
    const code = this.statutesForm();
    return code ? (this.find(code)?.acronym ?? code.toUpperCase()) : '';
  });

  protected tabClass(active: boolean): string {
    return active
      ? 'border-primary-500 bg-[var(--glass-bg-light)] text-text-primary'
      : 'border-[var(--glass-border)] text-text-secondary hover:border-[var(--glass-border-strong)] hover:text-text-primary';
  }

  protected toggleCompare(): void {
    this.comparing.update((v) => !v);
  }

  protected focus(code: LegalFormCode): void {
    this.focusedCode.set(code);
  }

  protected pick(code: LegalFormCode): void {
    this.choose.emit(code);
    this.comparing.set(false);
    this.focusedCode.set(null);
  }

  /** Flèches gauche/droite dans le groupe de formes, comme un groupe radio natif. */
  protected onTabsKeydown(event: KeyboardEvent): void {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const forms = this.forms();
    const index = forms.findIndex((f) => f.code === this.focused()?.code);
    const step = event.key === 'ArrowRight' ? 1 : -1;
    const next = forms[(index + step + forms.length) % forms.length];
    this.focusedCode.set(next.code);
    const target = (event.currentTarget as HTMLElement).querySelector<HTMLElement>(
      `[data-code="${next.code}"]`,
    );
    target?.focus();
  }

  protected t(reason: LegalReason): string {
    return this.lang() === 'en' ? reason.en : reason.fr;
  }

  protected name(form: LegalFormEntry): string {
    return this.lang() === 'en' ? form.nameEn : form.nameFr;
  }

  protected summary(form: LegalFormEntry): string {
    return this.lang() === 'en' ? form.summaryEn : form.summaryFr;
  }

  protected idealFor(form: LegalFormEntry): string {
    return this.lang() === 'en' ? form.idealForEn : form.idealForFr;
  }

  protected pros(form: LegalFormEntry): string[] {
    return this.lang() === 'en' ? form.prosEn : form.prosFr;
  }

  protected cons(form: LegalFormEntry): string[] {
    return this.lang() === 'en' ? form.consEn : form.consFr;
  }

  protected facts(form: LegalFormEntry): Array<{ key: string; value: string }> {
    const en = this.lang() === 'en';
    const f = form.facts;
    return [
      { key: 'partners', value: en ? f.partnersEn : f.partnersFr },
      { key: 'capital', value: en ? f.capitalEn : f.capitalFr },
      { key: 'liability', value: en ? f.liabilityEn : f.liabilityFr },
      { key: 'leader', value: en ? f.leaderEn : f.leaderFr },
    ];
  }

  private find(code: LegalFormCode): LegalFormEntry | undefined {
    return this.forms().find((f) => f.code === code);
  }
}
