import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import { Subscription } from 'rxjs';
import { ApiService } from '../../../core/api.service';
import { loadFontSheet } from '../../../core/fonts';
import { Brand, PaletteRole } from '../../../core/models';
import { StudioState } from '../../../core/studio.state';
import { Illustration } from '../../../shared/components/illustration';
import { BrandChoice } from '../chat/brand-choice';

/**
 * Les marques de l'utilisateur, d'où qu'elles viennent : un site lu (palette et typographie au
 * choix), un projet IDEM importé (sa charte telle quelle), ou une saisie. Les photos ajoutées ici
 * passent avant toute banque d'images dans les vidéos et les visuels.
 */
@Component({
  selector: 'iv-brands',
  imports: [TranslateModule, IdemLoaderComponent, Illustration, BrandChoice],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './brands.html',
})
export class BrandsPage {
  private readonly api = inject(ApiService);
  private readonly translate = inject(TranslateService);
  protected readonly state = inject(StudioState);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly roles: PaletteRole[] = ['primary', 'secondary', 'accent', 'background', 'text'];
  protected readonly url = signal('');
  protected readonly scanning = signal(false);
  protected readonly scanStep = signal<string | null>(null);
  protected readonly scanError = signal<string | null>(null);
  protected readonly draft = signal<Brand | null>(null);
  protected readonly projects = signal<{ id: string; name: string; hasBrand: boolean; primary?: string }[] | null>(null);
  protected readonly importing = signal<string | null>(null);
  protected readonly manualName = signal('');
  protected readonly manualColor = signal('#1447e6');
  protected readonly creating = signal(false);
  protected readonly uploading = signal<string | null>(null);
  protected readonly confirmDelete = signal<string | null>(null);
  private scanSub: Subscription | null = null;

  constructor() {
    this.state.refreshBrands();
    this.destroyRef.onDestroy(() => this.scanSub?.unsubscribe());
  }

  protected fontsOf(b: Brand): void {
    loadFontSheet(b.fonts.displayCss);
    loadFontSheet(b.fonts.bodyCss);
  }

  protected quote(family?: string): string {
    return family ? `'${family.replace(/'/g, '')}', system-ui, sans-serif` : 'inherit';
  }

  protected scan(): void {
    const url = this.url().trim();
    if (url.length < 4) return;
    this.scanning.set(true);
    this.scanError.set(null);
    this.draft.set(null);
    this.scanStep.set(this.translate.instant('chat.status.scan.open'));
    this.scanSub = this.api.scan(url).subscribe({
      next: (event) => {
        if (event.type === 'status') this.scanStep.set(this.translate.instant(event.key));
        if (event.type === 'brand') {
          this.state.upsertBrand(event.brand);
          this.draft.set(event.brand);
        }
        if (event.type === 'error') this.scanError.set(event.message || this.translate.instant('errors.generic'));
      },
      complete: () => {
        this.scanning.set(false);
        this.scanStep.set(null);
      },
    });
  }

  protected chosen(brand: Brand): void {
    this.state.upsertBrand(brand);
    this.draft.set(null);
    this.url.set('');
  }

  protected loadProjects(): void {
    this.api.idemProjects().subscribe({ next: ({ projects }) => this.projects.set(projects), error: () => this.projects.set([]) });
  }

  protected importProject(id: string): void {
    this.importing.set(id);
    this.api.importIdem(id).subscribe({
      next: (brand) => {
        this.importing.set(null);
        this.state.upsertBrand(brand);
      },
      error: () => this.importing.set(null),
    });
  }

  protected createManual(): void {
    const name = this.manualName().trim();
    if (!name) return;
    this.creating.set(true);
    this.api.createBrand({ name, colors: { primary: this.manualColor() } }).subscribe({
      next: (brand) => {
        this.creating.set(false);
        this.manualName.set('');
        this.state.upsertBrand(brand);
      },
      error: () => this.creating.set(false),
    });
  }

  protected addPhotos(brand: Brand, event: Event): void {
    const files = Array.from((event.target as HTMLInputElement).files ?? []).slice(0, 8);
    (event.target as HTMLInputElement).value = '';
    if (!files.length) return;
    this.uploading.set(brand.id);
    this.api.addPhotos(brand.id, files).subscribe({
      next: (next) => {
        this.uploading.set(null);
        this.state.upsertBrand(next);
      },
      error: () => this.uploading.set(null),
    });
  }

  protected remove(brand: Brand): void {
    if (this.confirmDelete() !== brand.id) {
      this.confirmDelete.set(brand.id);
      return;
    }
    this.api.deleteBrand(brand.id).subscribe({
      next: () => {
        this.confirmDelete.set(null);
        this.state.brands.update((list) => list.filter((b) => b.id !== brand.id));
      },
      error: () => this.confirmDelete.set(null),
    });
  }
}
