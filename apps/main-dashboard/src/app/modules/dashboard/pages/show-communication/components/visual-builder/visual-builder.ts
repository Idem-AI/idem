import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { FlyerFormat } from '../../../../models/communication.model';
import { formatAspect } from '../../communication-ui';

/** Ce qu'on veut dire — la question qu'on pose en premier, à l'oral. */
const KINDS = [
  { id: 'announce', icon: 'pi pi-megaphone' },
  { id: 'promotion', icon: 'pi pi-tag' },
  { id: 'product', icon: 'pi pi-box' },
  { id: 'event', icon: 'pi pi-calendar' },
  { id: 'celebration', icon: 'pi pi-gift' },
  { id: 'recruitment', icon: 'pi pi-users' },
  { id: 'other', icon: 'pi pi-pencil' },
] as const;

type KindId = (typeof KINDS)[number]['id'];

/**
 * Où le visuel sera vu, dit par les réseaux qu'on connaît.
 *
 * Quatre formats sur cinq : « portrait » (4:5) ne se distingue pas du carré pour
 * qui ne publie pas tous les jours, et un choix de plus fait hésiter. L'atelier
 * sait toujours le produire si on le lui demande en toutes lettres.
 */
const PLACES: { format: FlyerFormat; icons: string[] }[] = [
  { format: 'square', icons: ['pi pi-instagram', 'pi pi-facebook', 'pi pi-linkedin'] },
  { format: 'story', icons: ['pi pi-whatsapp', 'pi pi-instagram', 'pi pi-tiktok'] },
  { format: 'banner', icons: ['pi pi-facebook', 'pi pi-linkedin', 'pi pi-globe'] },
  { format: 'a4', icons: ['pi pi-print'] },
];

/**
 * Créer un visuel en trois questions, sans rien taper d'autre que les détails.
 *
 * Un champ de chat vide demande de savoir QUOI écrire : c'est précisément ce
 * qu'un commerçant qui n'a jamais fait de marketing ne sait pas. Ici on choisit
 * (quoi annoncer, où le publier) et on ne tape que ce qui nous est propre — la
 * date, le prix, l'adresse.
 *
 * Le résultat est une PHRASE envoyée à l'atelier, la même que l'utilisateur
 * aurait pu écrire : un seul chemin côté serveur, et le fil garde une trace
 * lisible de ce qui a été demandé.
 */
@Component({
  selector: 'app-visual-builder',
  imports: [FormsModule, TranslateModule],
  templateUrl: './visual-builder.html',
  styleUrl: './visual-builder.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VisualBuilder {
  private readonly translate = inject(TranslateService);

  /** Vrai pendant qu'un visuel se fabrique : on ne relance pas un second achat. */
  readonly busy = input(false);

  readonly submitted = output<string>();
  /** L'utilisateur préfère décrire lui-même, en texte libre. */
  readonly freeText = output<void>();

  protected readonly kinds = KINDS;
  protected readonly places = PLACES;
  protected readonly formatAspect = formatAspect;

  /** 1 → quoi · 2 → détails · 3 → où. */
  protected readonly step = signal(1);
  protected readonly kind = signal<KindId | null>(null);
  protected readonly details = signal('');
  protected readonly format = signal<FlyerFormat>('square');
  protected readonly variants = signal(false);

  protected readonly canAdvance = computed(() => {
    switch (this.step()) {
      case 1:
        return !!this.kind();
      case 2:
        return this.details().trim().length >= 3;
      default:
        return true;
    }
  });

  /** 2 crédits pour un visuel, 5 pour trois propositions (tarif carrousel de l'API). */
  protected readonly price = computed(() => (this.variants() ? 5 : 2));

  protected chooseKind(id: KindId): void {
    this.kind.set(id);
    // Un choix = une étape franchie : pas de « Suivant » à chercher après un clic.
    this.step.set(2);
  }

  protected next(): void {
    if (this.canAdvance()) this.step.update((step) => Math.min(3, step + 1));
  }

  protected back(): void {
    this.step.update((step) => Math.max(1, step - 1));
  }

  protected goTo(step: number): void {
    if (step < this.step()) this.step.set(step);
  }

  protected submit(): void {
    const kind = this.kind();
    const details = this.details().trim();
    if (!kind || !details || this.busy()) return;

    const t = (key: string, params?: Record<string, unknown>) =>
      this.translate.instant(`dashboard.showCommunication.builder.${key}`, params) as string;

    const sentence = [
      t('prompt.intro', { kind: t(`kinds.${kind}.prompt`) }),
      t('prompt.format', { format: t(`places.${this.format()}.prompt`) }),
      t('prompt.details', { details }),
      this.variants() ? t('prompt.variants') : '',
    ]
      .filter(Boolean)
      .join(' ');

    this.submitted.emit(sentence);
    this.reset();
  }

  private reset(): void {
    this.step.set(1);
    this.kind.set(null);
    this.details.set('');
    this.variants.set(false);
  }
}
