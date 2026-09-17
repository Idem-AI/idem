import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  OnInit,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule } from '@ngx-translate/core';
import {
  CatalogFont,
  CustomFont,
  FontCategory,
  TypographyService,
  fontStack,
} from '../../../../../../../shared/services/typography.service';

/**
 * Import des polices de l'utilisateur.
 *
 * Une marque arrive souvent avec SA typographie — sous licence, ou dessinée
 * pour elle — qui n'est dans aucun catalogue public. Sans ce panneau, la seule
 * issue était de choisir « la plus proche » chez Google, c'est-à-dire de
 * renoncer à la marque au moment même où on la définit.
 *
 * Les fichiers partent dans notre bucket ; l'API renvoie la feuille
 * `@font-face` qu'elle a fabriquée, et c'est son URL qui sera stockée sur le
 * projet à la place du lien Google.
 */

const ACCEPTED_EXTENSIONS = ['.woff2', '.woff', '.ttf', '.otf'];

@Component({
  selector: 'app-typography-font-import',
  imports: [TranslateModule],
  templateUrl: './typography-font-import.html',
  styleUrls: ['./typography-font-import.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TypographyFontImportComponent implements OnInit {
  private readonly typographyService = inject(TypographyService);
  private readonly destroyRef = inject(DestroyRef);

  readonly fontSelected = output<{ font: CatalogFont; type: 'primary' | 'secondary' }>();

  protected readonly accept = ACCEPTED_EXTENSIONS.join(',');

  protected readonly fonts = signal<CustomFont[]>([]);
  protected readonly pendingFiles = signal<File[]>([]);
  protected readonly family = signal('');
  protected readonly category = signal<FontCategory>('sans-serif');
  protected readonly isUploading = signal(false);
  protected readonly isDragging = signal(false);
  protected readonly errorKey = signal<string | null>(null);
  protected readonly errorDetail = signal<string | null>(null);

  protected readonly categories: readonly { id: FontCategory; labelKey: string }[] = [
    { id: 'sans-serif', labelKey: 'dashboard.typographySelection.categories.sansSerif' },
    { id: 'serif', labelKey: 'dashboard.typographySelection.categories.serif' },
    { id: 'display', labelKey: 'dashboard.typographySelection.categories.display' },
    { id: 'handwriting', labelKey: 'dashboard.typographySelection.categories.handwriting' },
    { id: 'monospace', labelKey: 'dashboard.typographySelection.categories.monospace' },
  ];

  ngOnInit(): void {
    this.reloadFonts();
  }

  protected onFilesPicked(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.acceptFiles(Array.from(input.files ?? []));
    // Le même fichier rechoisi après une erreur doit relancer un `change`.
    input.value = '';
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(true);
  }

  protected onDragLeave(): void {
    this.isDragging.set(false);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(false);
    this.acceptFiles(Array.from(event.dataTransfer?.files ?? []));
  }

  protected onFamilyInput(event: Event): void {
    this.family.set((event.target as HTMLInputElement).value);
  }

  protected onCategoryChange(event: Event): void {
    this.category.set((event.target as HTMLSelectElement).value as FontCategory);
  }

  protected removePendingFile(index: number): void {
    this.pendingFiles.update((files) => files.filter((_, i) => i !== index));
  }

  protected upload(): void {
    const files = this.pendingFiles();
    const family = this.family().trim();
    if (!files.length || !family || this.isUploading()) return;

    this.isUploading.set(true);
    this.errorKey.set(null);
    this.errorDetail.set(null);

    this.typographyService
      .uploadCustomFont(family, files, this.category())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (font) => {
          this.isUploading.set(false);
          this.pendingFiles.set([]);
          this.family.set('');
          // Une famille ré-importée REMPLACE la précédente côté API : on la
          // remplace aussi dans la liste au lieu de l'afficher deux fois.
          this.fonts.update((fonts) => [font, ...fonts.filter((f) => f.id !== font.id)]);
          void this.typographyService.loadFonts([
            { family: font.family, source: 'custom', cssUrl: font.cssUrl },
          ]);
        },
        error: (error) => {
          this.isUploading.set(false);
          this.errorKey.set('dashboard.typographySelection.import.errors.upload');
          this.errorDetail.set(error?.error?.message ?? null);
        },
      });
  }

  protected use(font: CustomFont, type: 'primary' | 'secondary'): void {
    this.fontSelected.emit({ font: toCatalogFont(font), type });
  }

  protected remove(font: CustomFont): void {
    this.typographyService
      .deleteCustomFont(font.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.fonts.update((fonts) => fonts.filter((f) => f.id !== font.id)),
        error: () => this.errorKey.set('dashboard.typographySelection.import.errors.delete'),
      });
  }

  protected stackFor(font: CustomFont): string {
    return fontStack(font.family, font.category);
  }

  protected canUpload(): boolean {
    return this.pendingFiles().length > 0 && this.family().trim().length > 0 && !this.isUploading();
  }

  private reloadFonts(): void {
    this.typographyService
      .listCustomFonts()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((fonts) => {
        this.fonts.set(fonts);
        // Les vignettes s'affichent dans leur propre dessin, pas dans la police
        // par défaut du navigateur.
        void this.typographyService.loadFonts(
          fonts.map((font) => ({ family: font.family, source: 'custom' as const, cssUrl: font.cssUrl })),
        );
      });
  }

  /**
   * Ne garde que les fichiers de police, et propose un nom de famille tiré du
   * premier — l'utilisateur le corrige s'il ne convient pas.
   */
  private acceptFiles(incoming: File[]): void {
    const accepted = incoming.filter((file) =>
      ACCEPTED_EXTENSIONS.some((extension) => file.name.toLowerCase().endsWith(extension)),
    );

    if (accepted.length < incoming.length) {
      this.errorKey.set('dashboard.typographySelection.import.errors.format');
      this.errorDetail.set(null);
    } else if (accepted.length) {
      this.errorKey.set(null);
    }
    if (!accepted.length) return;

    this.pendingFiles.update((files) => [...files, ...accepted]);
    if (!this.family().trim()) {
      this.family.set(familyFromFileName(accepted[0].name));
    }
  }
}

function toCatalogFont(font: CustomFont): CatalogFont {
  return {
    family: font.family,
    source: 'custom',
    sourceId: font.id,
    category: font.category,
    weights: font.weights ?? [],
    subsets: ['latin'],
    cssUrl: font.cssUrl,
    popularity: 0,
  };
}

/** « Satoshi-Bold.woff2 » → « Satoshi ». */
function familyFromFileName(fileName: string): string {
  return (
    fileName
      .replace(/\.[a-z0-9]+$/i, '')
      .replace(
        /[-_]?(thin|extra ?light|ultra ?light|light|regular|normal|book|medium|semi ?bold|demi ?bold|extra ?bold|ultra ?bold|bold|black|heavy|italic|oblique|[1-9]00)/gi,
        '',
      )
      .replace(/[-_]+/g, ' ')
      .trim() || fileName
  );
}
