import { ChangeDetectionStrategy, Component, OnInit, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import { ApiService } from '../../../shared/services/api.service';
import { EnvVar } from '../../../shared/models/ideploy.models';

/**
 * Environment variables of one application: read, add, remove.
 *
 * Values are masked until asked for — this tab is often open while someone
 * shares their screen. The count is reported up so the overview's checklist
 * stays true without reloading.
 */
@Component({
  selector: 'app-env-tab',
  imports: [ReactiveFormsModule, TranslateModule, IdemLoaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="glass-card overflow-hidden">
      <header class="px-5 py-4" style="border-bottom:1px solid var(--glass-border-subtle);">
        <h2 class="font-semibold text-text-primary">{{ 'applications.detail.environmentVariables' | translate }}</h2>
        <p class="mt-1 text-sm leading-relaxed" style="color:var(--color-text-secondary);">{{ 'applications.detail.envHint' | translate }}</p>
      </header>

      @if (loading()) {
        <div class="space-y-3 px-5 py-4" aria-hidden="true">
          @for (i of [1, 2, 3]; track i) { <div class="skeleton h-5 rounded"></div> }
        </div>
      } @else if (vars().length === 0) {
        <p class="px-5 py-6 text-center text-sm" style="color:var(--color-text-secondary);">{{ 'applications.detail.noEnvVars' | translate }}</p>
      } @else {
        <ul>
          @for (env of vars(); track env.key) {
            <li class="flex flex-wrap items-center gap-3 px-5 py-3" style="border-bottom:1px solid var(--glass-border-subtle);">
              <code class="min-w-[140px] font-mono text-sm font-semibold text-text-primary">{{ env.key }}</code>
              <code class="min-w-0 flex-1 truncate font-mono text-sm" style="color:var(--color-text-secondary);">
                {{ revealed().has(env.key) ? env.value : '••••••••' }}
              </code>
              <button type="button" class="flex h-8 w-8 items-center justify-center rounded-lg transition-smooth hover:bg-[var(--glass-bg-subtle)]" style="color:var(--color-text-tertiary);"
                [attr.aria-label]="'databases.detail.reveal' | translate" (click)="toggle(env.key)">
                <i class="pi text-xs" [class.pi-eye]="!revealed().has(env.key)" [class.pi-eye-slash]="revealed().has(env.key)"></i>
              </button>
              <button type="button" class="flex h-8 w-8 items-center justify-center rounded-lg transition-smooth hover:bg-[var(--glass-bg-subtle)]" style="color:var(--color-danger);"
                [attr.aria-label]="'applications.detail.removeNamed' | translate: { name: env.key }" [disabled]="removing() === env.key" (click)="remove(env)">
                @if (removing() === env.key) { <idem-loader size="xs" /> } @else { <i class="pi pi-trash text-xs"></i> }
              </button>
            </li>
          }
        </ul>
      }

      <form class="grid gap-3 px-5 py-4 sm:grid-cols-[1fr_1.5fr_auto] sm:items-end" style="background:var(--glass-bg-light);" [formGroup]="form" (ngSubmit)="add()">
        <div>
          <label class="mb-1 block text-xs font-semibold" style="color:var(--color-text-secondary);" for="env-key">{{ 'applications.detail.keyLabel' | translate }}</label>
          <input type="text" id="env-key" class="font-mono text-sm" autocomplete="off" [placeholder]="'applications.detail.keyPlaceholder' | translate" formControlName="key" />
        </div>
        <div>
          <label class="mb-1 block text-xs font-semibold" style="color:var(--color-text-secondary);" for="env-value">{{ 'applications.detail.valueLabel' | translate }}</label>
          <input type="text" id="env-value" class="font-mono text-sm" autocomplete="off" [placeholder]="'applications.detail.valuePlaceholder' | translate" formControlName="value" />
        </div>
        <button class="inner-button" type="submit" [disabled]="form.invalid || saving()">
          @if (saving()) { <idem-loader size="xs" /> } @else { <i class="pi pi-plus mr-2 text-xs"></i> }
          {{ 'applications.detail.add' | translate }}
        </button>
      </form>
    </section>
  `,
})
export class AppEnvTabComponent implements OnInit {
  private api = inject(ApiService);
  private fb = inject(FormBuilder);

  readonly uuid = input.required<string>();
  readonly countChange = output<number>();

  protected readonly vars = signal<EnvVar[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly removing = signal<string | null>(null);
  protected readonly revealed = signal<Set<string>>(new Set());

  protected readonly form = this.fb.nonNullable.group({
    key: ['', Validators.required],
    value: ['', Validators.required],
  });

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.api.listEnvVars(this.uuid()).subscribe({
      next: (v) => {
        this.vars.set(v);
        this.loading.set(false);
        this.countChange.emit(v.length);
      },
      error: () => this.loading.set(false),
    });
  }

  protected toggle(key: string): void {
    this.revealed.update((set) => {
      const next = new Set(set);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  protected add(): void {
    if (this.form.invalid) return;
    this.saving.set(true);
    const raw = this.form.getRawValue();
    this.api.upsertEnvVar(this.uuid(), { key: raw.key.trim(), value: raw.value }).subscribe({
      next: () => {
        this.form.reset();
        this.saving.set(false);
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }

  protected remove(env: EnvVar): void {
    this.removing.set(env.key);
    this.api.deleteEnvVar(this.uuid(), env.key).subscribe({
      next: () => {
        this.vars.update((list) => list.filter((e) => e.key !== env.key));
        this.removing.set(null);
        this.countChange.emit(this.vars().length);
      },
      error: () => this.removing.set(null),
    });
  }
}
