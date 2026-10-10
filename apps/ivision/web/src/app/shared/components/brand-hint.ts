import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, output, signal } from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import { Subscription } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { Brand } from '../../core/models';
import { StudioState } from '../../core/studio.state';

type Panel = 'site' | 'file' | 'colors' | 'brands' | null;
const COLLAPSE_KEY = 'iv_brand_hint';

/**
 * LA MARQUE, PROPOSÉE SANS INSISTER. Une ligne discrète au-dessus du compositeur : « Vos
 * couleurs ? Mon site · Ma charte ou mon logo · Mes couleurs ». Rien n'est obligatoire : sans
 * réponse, la création se fait aux couleurs neutres (ou à celles que la demande nomme). Un clic
 * ouvre une seule petite zone ; la marque trouvée est annoncée en une ligne, et remplaçable.
 * Repliée par l'utilisateur, elle reste repliée (préférence locale).
 */
@Component({
  selector: 'iv-brand-hint',
  imports: [TranslateModule, IdemLoaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (collapsed()) {
      <button type="button" class="button-ghost button-sm !px-2 !py-1 text-xs" (click)="expand()">
        @if (real(); as b) {
          <span class="flex overflow-hidden rounded" aria-hidden="true">
            @for (c of swatches(b); track $index) { <span class="h-2.5 w-2.5" [style.background]="c"></span> }
          </span>
          {{ b.name || ('brandHint.myCharter' | translate) }}
        } @else {
          <i class="pi pi-palette text-xs" aria-hidden="true"></i> {{ 'brandHint.myColors' | translate }}
        }
      </button>
    } @else {
      <div class="flex flex-col gap-2 text-xs text-[var(--color-text-tertiary)]">
        <div class="flex flex-wrap items-center gap-1.5">
          @if (real(); as b) {
            <span class="flex items-center gap-1.5 text-[var(--color-text-secondary)]">
              <span class="flex overflow-hidden rounded" aria-hidden="true">
                @for (c of swatches(b); track $index) { <span class="h-3 w-3" [style.background]="c"></span> }
              </span>
              {{ 'brandHint.using' | translate: { name: b.name || ('brandHint.myCharter' | translate) } }}
            </span>
            <span aria-hidden="true">·</span>
            <button type="button" class="underline" (click)="toggle('brands')">{{ 'brandHint.change' | translate }}</button>
          } @else {
            <span class="hidden sm:inline">{{ 'brandHint.prompt' | translate }}</span>
            <span class="sm:hidden">{{ 'brandHint.promptShort' | translate }}</span>
            <button type="button" class="tag !text-xs" [attr.aria-pressed]="panel() === 'site'" (click)="toggle('site')"><i class="pi pi-globe" aria-hidden="true"></i> <span class="hidden sm:inline">{{ 'brandHint.site' | translate }}</span><span class="sm:hidden">{{ 'brandHint.siteShort' | translate }}</span></button>
            <label class="tag !text-xs cursor-pointer !mb-0">
              @if (busy() === 'file') { <idem-loader size="xs" /> } @else { <i class="pi pi-paperclip" aria-hidden="true"></i> }
              <span class="hidden sm:inline">{{ 'brandHint.file' | translate }}</span><span class="sm:hidden">{{ 'brandHint.fileShort' | translate }}</span>
              <input type="file" class="sr-only" accept="application/pdf,image/png,image/jpeg,image/webp,image/svg+xml,.pdf,.svg" (change)="onFile($event)" [disabled]="!!busy()" />
            </label>
            <button type="button" class="tag !text-xs" [attr.aria-pressed]="panel() === 'colors'" (click)="toggle('colors')"><i class="pi pi-palette" aria-hidden="true"></i> <span class="hidden sm:inline">{{ 'brandHint.colors' | translate }}</span><span class="sm:hidden">{{ 'brandHint.colorsShort' | translate }}</span></button>
            @if (saved().length) {
              <button type="button" class="tag !text-xs" [attr.aria-pressed]="panel() === 'brands'" (click)="toggle('brands')" [attr.aria-label]="'brandHint.saved' | translate"><i class="pi pi-bookmark" aria-hidden="true"></i> <span class="hidden sm:inline">{{ 'brandHint.saved' | translate }}</span></button>
            }
          }
          <button type="button" class="button-icon !p-1 ml-auto" (click)="collapse()" [attr.aria-label]="'brandHint.hide' | translate"><i class="pi pi-times text-[10px]" aria-hidden="true"></i></button>
        </div>

        @switch (panel()) {
          @case ('site') {
            <form class="flex flex-wrap items-center gap-2" (submit)="$event.preventDefault(); readSite()">
              <label class="sr-only" for="iv-hint-site">{{ 'brandHint.siteLabel' | translate }}</label>
              <input id="iv-hint-site" type="url" class="!w-auto min-w-0 flex-1 !py-1.5 !text-sm" placeholder="https://…" [value]="url()" (input)="url.set($any($event.target).value)" [disabled]="busy() === 'site'" />
              <button type="submit" class="outer-button button-sm" [disabled]="url().trim().length < 4 || busy() === 'site'">
                @if (busy() === 'site') { <idem-loader size="xs" /> }
                {{ 'brandHint.read' | translate }}
              </button>
              @if (busy() === 'site' && status()) { <span class="w-full">{{ status() }}</span> }
            </form>
          }
          @case ('colors') {
            <div class="flex flex-wrap items-center gap-3">
              @for (role of roles; track role) {
                <label class="!flex items-center gap-1.5 !mb-0 text-xs">
                  <input type="color" class="!h-7 !w-9 !p-0.5" [value]="colors()[role]" (input)="setColor(role, $any($event.target).value)" />
                  {{ 'brandHint.roles.' + role | translate }}
                </label>
              }
              <button type="button" class="outer-button button-sm" (click)="applyColors()" [disabled]="busy() === 'colors'">
                @if (busy() === 'colors') { <idem-loader size="xs" /> }
                {{ 'brandHint.apply' | translate }}
              </button>
            </div>
          }
          @case ('brands') {
            <div class="flex flex-wrap gap-1.5">
              @for (b of saved(); track b.id) {
                <button type="button" class="tag !text-xs" (click)="choose(b)">
                  <span class="h-3 w-3 rounded" [style.background]="b.palette.primary" aria-hidden="true"></span>{{ b.name }}
                </button>
              }
              @if (real()) {
                <button type="button" class="tag !text-xs" (click)="toggle('site')"><i class="pi pi-globe" aria-hidden="true"></i> {{ 'brandHint.site' | translate }}</button>
                <label class="tag !text-xs cursor-pointer !mb-0">
                  <i class="pi pi-paperclip" aria-hidden="true"></i> {{ 'brandHint.file' | translate }}
                  <input type="file" class="sr-only" accept="application/pdf,image/png,image/jpeg,image/webp,image/svg+xml,.pdf,.svg" (change)="onFile($event)" [disabled]="!!busy()" />
                </label>
                <button type="button" class="tag !text-xs" (click)="toggle('colors')"><i class="pi pi-palette" aria-hidden="true"></i> {{ 'brandHint.colors' | translate }}</button>
              }
            </div>
          }
        }
        @if (note(); as n) { <p role="status">{{ n }}</p> }
        @if (failed(); as f) { <p role="alert" class="text-[var(--color-danger)]">{{ f | translate }}</p> }
      </div>
    }
  `,
})
export class BrandHint {
  private readonly api = inject(ApiService);
  private readonly translate = inject(TranslateService);
  private readonly state = inject(StudioState);

  /** La marque en cours (provisoire ou réelle), null si aucune encore. */
  readonly brand = input<Brand | null>(null);
  /** Une marque trouvée ou choisie : au parent de l'attacher (conversation, montage). */
  readonly chosen = output<Brand>();

  protected readonly roles = ['primary', 'secondary', 'accent'] as const;
  protected readonly panel = signal<Panel>(null);
  protected readonly busy = signal<'site' | 'file' | 'colors' | null>(null);
  protected readonly status = signal<string | null>(null);
  protected readonly note = signal<string | null>(null);
  protected readonly failed = signal<string | null>(null);
  protected readonly url = signal('');
  protected readonly colors = signal<Record<string, string>>({ primary: '#1f6f4a', secondary: '#14324a', accent: '#f2a93b' });
  protected readonly collapsed = signal(this.readCollapsed());

  /** Une vraie charte (pas la marque provisoire). */
  protected readonly real = computed(() => {
    const b = this.brand();
    return b && b.source !== 'auto' ? b : null;
  });
  protected readonly saved = computed(() => this.state.brands().filter((b) => b.status === 'ready' && b.source !== 'auto' && b.id !== this.brand()?.id));
  private scanSub: Subscription | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.scanSub?.unsubscribe());
  }

  protected swatches(b: Brand): string[] {
    return [b.palette.primary, b.palette.secondary, b.palette.accent].filter((c): c is string => !!c);
  }

  protected toggle(p: Panel): void {
    this.failed.set(null);
    this.note.set(null);
    this.panel.update((cur) => (cur === p ? null : p));
  }

  protected collapse(): void {
    this.collapsed.set(true);
    this.panel.set(null);
    this.writeCollapsed(true);
  }

  protected expand(): void {
    this.collapsed.set(false);
    this.writeCollapsed(false);
  }

  private done(brand: Brand, note: string): void {
    // Une marque provisoire (couleurs seules) ne rejoint pas la liste des marques.
    if (brand.source !== 'auto') this.state.upsertBrand(brand);
    this.busy.set(null);
    this.panel.set(null);
    this.note.set(note);
    this.chosen.emit(brand);
  }

  protected readSite(): void {
    const raw = this.url().trim();
    if (raw.length < 4) return;
    this.busy.set('site');
    this.failed.set(null);
    this.status.set(this.translate.instant('brandHint.reading'));
    this.scanSub?.unsubscribe();
    this.scanSub = this.api.scan(raw).subscribe({
      next: (event) => {
        if (event.type === 'status') this.status.set(this.translate.instant(event.key) !== event.key ? this.translate.instant(event.key) : event.text);
        if (event.type === 'brand') this.done(event.brand, this.translate.instant('brandHint.siteDone', { name: event.brand.name }));
        if (event.type === 'error') {
          this.busy.set(null);
          this.failed.set('brandHint.siteFailed');
        }
      },
      complete: () => this.busy.set(null),
      error: () => {
        this.busy.set(null);
        this.failed.set('brandHint.siteFailed');
      },
    });
  }

  protected onFile(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    (event.target as HTMLInputElement).value = '';
    if (!file) return;
    this.busy.set('file');
    this.failed.set(null);
    this.api.brandFromFile(file).subscribe({
      next: (brand) => {
        const parts = [this.translate.instant('brandHint.found.colors')];
        if (brand.found.fonts.length) parts.push(this.translate.instant('brandHint.found.fonts', { fonts: brand.found.fonts.join(', ') }));
        if (brand.found.logo) parts.push(this.translate.instant('brandHint.found.logo'));
        this.done(brand, this.translate.instant('brandHint.fileDone', { what: parts.join(', ') }));
      },
      error: () => {
        this.busy.set(null);
        this.failed.set('brandHint.fileFailed');
      },
    });
  }

  protected setColor(role: string, value: string): void {
    this.colors.update((c) => ({ ...c, [role]: value }));
  }

  protected applyColors(): void {
    this.busy.set('colors');
    this.api.autoBrand({ ...this.colors(), background: '#fbfaf7', text: '#16181d' }).subscribe({
      next: (brand) => this.done(brand, this.translate.instant('brandHint.colorsDone')),
      error: () => {
        this.busy.set(null);
        this.failed.set('errors.generic');
      },
    });
  }

  protected choose(brand: Brand): void {
    this.done(brand, this.translate.instant('brandHint.chosen', { name: brand.name }));
  }

  private readCollapsed(): boolean {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === 'collapsed';
    } catch {
      return false;
    }
  }

  private writeCollapsed(value: boolean): void {
    try {
      if (value) localStorage.setItem(COLLAPSE_KEY, 'collapsed');
      else localStorage.removeItem(COLLAPSE_KEY);
    } catch {
      /* préférence locale seulement */
    }
  }
}
