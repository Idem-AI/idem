import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { CookieService } from '../../../../../shared/services/cookie.service';
import { PitchDeckService } from '../../../services/ai-agents/pitch-deck.service';
import { PitchDeckType, PitchDeckTypeCatalog } from '../../../models/pitchDeck.model';
import { pitchDeckTypeLabel } from '../../../utils/deliverable-labels';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';

/** Une carte de type, libellés résolus. */
interface TypeCard extends PitchDeckType {
  label: string;
  description: string;
  useWhen: string;
  audienceLabel: string;
  icon: string;
}

const TYPE_ICONS: Record<string, string> = {
  investor: 'pi pi-chart-line',
  bank: 'pi pi-building',
  sales: 'pi pi-shopping-bag',
  partnership: 'pi pi-users',
  competition: 'pi pi-trophy',
  elevator: 'pi pi-clock',
};

/**
 * Choix du type de pitch deck, avant sa génération.
 *
 * Un deck de levée, un dossier présenté à une banque et une présentation
 * commerciale n'ont ni les mêmes slides ni le même lecteur : l'écran pose la
 * question « pour qui ? » et montre, pour le type choisi, les slides qui seront
 * produites. Confirmer crée le deck et ouvre sa page, où la génération démarre.
 */
@Component({
  selector: 'app-pitch-deck-new',
  imports: [TranslateModule, ReactiveFormsModule, IdemLoaderComponent],
  templateUrl: './pitch-deck-new.html',
  styleUrl: './pitch-deck-new.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PitchDeckNewPage implements OnInit {
  private readonly pitchDeckService = inject(PitchDeckService);
  private readonly cookieService = inject(CookieService);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly isLoading = signal(true);
  protected readonly loadError = signal(false);
  protected readonly isCreating = signal(false);
  protected readonly createError = signal<string | null>(null);
  private readonly catalog = signal<PitchDeckTypeCatalog | null>(null);
  protected readonly selectedTypeId = signal('');

  protected readonly nameControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.maxLength(120)],
  });
  /** Le nom a été saisi : changer de type ne l'écrase plus. */
  private nameEdited = false;

  protected readonly types = computed<TypeCard[]>(() =>
    (this.catalog()?.types ?? []).map((type) => ({
      ...type,
      label: pitchDeckTypeLabel(this.translate, type.id),
      description: this.translate.instant(`dashboard.pitchDeckTypes.types.${type.id}.description`),
      useWhen: this.translate.instant(`dashboard.pitchDeckTypes.types.${type.id}.useWhen`),
      audienceLabel: this.translate.instant(`dashboard.pitchDeckTypes.audiences.${type.audience}`),
      icon: TYPE_ICONS[type.id] ?? 'pi pi-desktop',
    })),
  );

  protected readonly selectedType = computed(
    () => this.types().find((type) => type.id === this.selectedTypeId()) ?? null,
  );

  /** Slides du type choisi, dans l'ordre, libellés traduits. */
  protected readonly outline = computed(() =>
    (this.selectedType()?.slides ?? []).map((name, index) => {
      const key = `dashboard.showPitchDeck.slides.${name}`;
      const label: unknown = this.translate.instant(key);
      return { name, position: index + 1, label: typeof label === 'string' && label !== key ? label : name };
    }),
  );

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.isLoading.set(true);
    this.loadError.set(false);
    this.pitchDeckService
      .getPitchDeckTypes()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (catalog) => {
          this.catalog.set(catalog);
          this.selectType(catalog.defaultTypeId);
          this.isLoading.set(false);
        },
        error: () => {
          this.loadError.set(true);
          this.isLoading.set(false);
        },
      });
  }

  protected selectType(typeId: string): void {
    this.selectedTypeId.set(typeId);
    this.createError.set(null);
    if (!this.nameEdited) this.nameControl.setValue(pitchDeckTypeLabel(this.translate, typeId));
  }

  protected onNameInput(): void {
    this.nameEdited = true;
  }

  protected create(event: Event): void {
    event.preventDefault();
    const projectId = this.cookieService.get('projectId');
    const type = this.selectedTypeId();
    if (!projectId || !type || this.isCreating() || this.nameControl.invalid) return;

    this.isCreating.set(true);
    this.createError.set(null);
    const name = this.nameControl.value.trim();

    this.pitchDeckService
      .createPitchDeck(projectId, { type, ...(name ? { name } : {}) })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (deck) => {
          // La page du deck lance la génération : c'est elle qui en affiche la progression.
          this.router.navigate(['/project/pitch-deck', deck.id], { queryParams: { generate: 'true' } });
        },
        error: () => {
          this.isCreating.set(false);
          this.createError.set(this.translate.instant('dashboard.pitchDeckTypes.errors.create'));
        },
      });
  }

  protected goBack(): void {
    this.router.navigate(['/project/pitch-deck']);
  }
}
