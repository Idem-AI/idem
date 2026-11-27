import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { ApiService } from '../../../shared/services/api.service';

/** Team-scoped shared environment variables (Coolify Shared Variables). */
@Component({
  selector: 'app-shared-variables',
  imports: [ReactiveFormsModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="heading-serif text-2xl sm:text-[32px] break-words mb-6" style="font-weight:700;color:var(--color-text-primary);">{{ 'sharedVariables.title' | translate }}</h1>
    <p class="mb-4 text-sm" style="color: var(--color-text-secondary)">{{ 'sharedVariables.description' | translate }}</p>

    <div class="glass-card p-4 max-w-2xl">
      @for (v of vars(); track v.key) {
        <div class="mb-2 flex items-center gap-2 text-sm">
          <code class="shrink-0">{{ v.key }}</code>
          <span class="min-w-0 truncate" style="color: var(--color-text-secondary)">= {{ v.value }}</span>
          <button type="button" class="ml-auto shrink-0 text-xs" style="color:var(--color-danger);" (click)="remove(v)">{{ 'sharedVariables.delete' | translate }}</button>
        </div>
      }
      <form class="mt-3 flex flex-col gap-2 sm:flex-row" [formGroup]="form" (ngSubmit)="add()">
        <input type="text" class="sm:flex-1 sm:!w-auto min-w-0" [placeholder]="'sharedVariables.keyPlaceholder' | translate" formControlName="key" />
        <input type="text" class="sm:flex-1 sm:!w-auto min-w-0" [placeholder]="'sharedVariables.valuePlaceholder' | translate" formControlName="value" />
        <button class="inner-button justify-center" type="submit" [disabled]="form.invalid || teamId() === null">{{ 'sharedVariables.add' | translate }}</button>
      </form>
    </div>
  `,
})
export class SharedVariablesComponent implements OnInit {
  private api = inject(ApiService);
  private fb = inject(FormBuilder);

  protected readonly vars = signal<{ id: number; key: string; value: string | null }[]>([]);
  protected readonly teamId = signal<number | null>(null);
  protected readonly form = this.fb.nonNullable.group({
    key: ['', Validators.required],
    value: ['', Validators.required],
  });

  ngOnInit(): void {
    this.api.me().subscribe((m) => {
      if (m.team) {
        this.teamId.set(m.team.id);
        this.load();
      }
    });
  }

  private load(): void {
    const id = this.teamId();
    if (id === null) return;
    this.api.listSharedVariables('team', id).subscribe((v) => this.vars.set(v));
  }

  protected add(): void {
    const id = this.teamId();
    if (this.form.invalid || id === null) return;
    this.api.upsertSharedVariable('team', id, this.form.getRawValue()).subscribe(() => {
      this.form.reset();
      this.load();
    });
  }

  protected remove(v: { key: string }): void {
    const id = this.teamId();
    if (id === null) return;
    this.api.deleteSharedVariable('team', id, v.key).subscribe(() => {
      this.vars.update((list) => list.filter((x) => x.key !== v.key));
    });
  }
}
