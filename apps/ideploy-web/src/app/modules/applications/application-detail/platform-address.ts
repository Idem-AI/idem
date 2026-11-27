import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, OnInit, inject, input, output, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { debounceTime, distinctUntilChanged, map, of, switchMap, tap, catchError } from 'rxjs';
import { ApiService } from '../../../shared/services/api.service';
import { Application, PlatformAddressCheck } from '../../../shared/models/ideploy.models';

type Availability =
  | { state: 'idle' | 'checking' }
  | { state: 'free'; host: string }
  | { state: 'refused'; reason: NonNullable<PlatformAddressCheck['reason']> };

/**
 * « Personnaliser l'adresse » : the owner chooses the name of the free address
 * (`buni.ideploy.site` rather than `buni-k3x9p.ideploy.site`). Availability is
 * read while typing; iDeploy applies the change itself (routes, or a deployment).
 */
@Component({
  selector: 'app-platform-address',
  imports: [ReactiveFormsModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="mt-3 grid w-full gap-2 rounded-lg p-4" style="background:var(--color-surface-2, var(--glass-bg));border:1px solid var(--glass-border-subtle);" (ngSubmit)="save()">
      <label for="platform-address" class="text-sm font-semibold text-text-primary">{{ 'applications.domain.customize.title' | translate }}</label>
      <div class="flex items-center rounded-lg" style="border:1px solid var(--glass-border);">
        <input
          #field
          id="platform-address"
          class="h-9 min-w-0 flex-1 bg-transparent px-3 font-mono text-sm outline-none"
          [formControl]="label"
          maxlength="40"
          autocomplete="off"
          spellcheck="false"
          aria-describedby="platform-address-hint"
        />
        <span class="pr-3 font-mono text-sm" style="color:var(--color-text-tertiary);">.{{ domain }}</span>
      </div>
      <p id="platform-address-hint" class="min-h-[18px] text-xs" role="status" aria-live="polite" [style.color]="hintColor()">
        @switch (availability().state) {
          @case ('checking') { {{ 'applications.domain.customize.checking' | translate }} }
          @case ('free') { {{ 'applications.domain.customize.free' | translate: { host: freeHost() } }} }
          @case ('refused') { {{ 'applications.domain.customize.refused.' + refusal() | translate }} }
          @default { {{ 'applications.domain.customize.hint' | translate }} }
        }
      </p>
      @if (error()) {
        <p class="text-xs" role="alert" style="color:var(--color-danger);">{{ error() }}</p>
      }
      <div class="flex justify-end gap-2">
        <button type="button" class="button-ghost button-sm" (click)="closed.emit()">{{ 'applications.domain.customize.cancel' | translate }}</button>
        <button type="submit" class="inner-button button-sm" [disabled]="availability().state !== 'free' || saving()">
          {{ (saving() ? 'applications.domain.customize.saving' : 'applications.domain.customize.cta') | translate }}
        </button>
      </div>
    </form>
  `,
})
export class PlatformAddressComponent implements OnInit {
  private api = inject(ApiService);
  private translate = inject(TranslateService);
  private destroyRef = inject(DestroyRef);

  readonly app = input.required<Application>();
  /** The address being renamed, e.g. `buni-k3x9p.ideploy.site`. */
  readonly host = input.required<string>();
  readonly changed = output<Application>();
  readonly closed = output<void>();

  protected readonly domain = 'ideploy.site';
  protected readonly label = new FormControl('', { nonNullable: true });
  protected readonly availability = signal<Availability>({ state: 'idle' });
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  private readonly field = viewChild<ElementRef<HTMLInputElement>>('field');

  protected freeHost(): string {
    const a = this.availability();
    return a.state === 'free' ? a.host : '';
  }

  protected refusal(): string {
    const a = this.availability();
    return a.state === 'refused' ? a.reason : 'unavailable';
  }

  protected hintColor(): string {
    const state = this.availability().state;
    if (state === 'free') return 'var(--color-success)';
    if (state === 'refused') return 'var(--color-danger)';
    return 'var(--color-text-tertiary)';
  }

  ngOnInit(): void {
    const current = this.host().split('.')[0] ?? '';
    this.label.setValue(current);
    setTimeout(() => this.field()?.nativeElement.select());
    this.label.valueChanges
      .pipe(
        map((value) => value.toLowerCase().replace(/[^a-z0-9-]/g, '')),
        tap((clean) => clean !== this.label.value && this.label.setValue(clean, { emitEvent: false })),
        distinctUntilChanged(),
        tap((clean) => this.availability.set(clean && clean !== current ? { state: 'checking' } : { state: 'idle' })),
        debounceTime(400),
        switchMap((clean) =>
          !clean || clean === current
            ? of(null)
            : this.api.checkPlatformAddress(this.app().uuid, clean).pipe(catchError(() => of({ available: false, reason: 'unavailable' } as PlatformAddressCheck)))
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((check) => {
        if (!check) return;
        this.availability.set(check.available && check.host ? { state: 'free', host: check.host } : { state: 'refused', reason: check.reason ?? 'unavailable' });
      });
  }

  protected save(): void {
    if (this.availability().state !== 'free' || this.saving()) return;
    this.saving.set(true);
    this.error.set(null);
    this.api.renamePlatformAddress(this.app().uuid, this.label.value).subscribe({
      next: (app) => {
        this.saving.set(false);
        this.changed.emit(app);
      },
      error: (e) => {
        this.saving.set(false);
        const message = (e as { error?: { error?: { message?: string } } })?.error?.error?.message;
        this.error.set(message ?? this.translate.instant('applications.domain.customize.error'));
      },
    });
  }
}
