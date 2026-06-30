import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../../../shared/services/api.service';

/** Team-scoped shared environment variables (Coolify Shared Variables). */
@Component({
  selector: 'app-shared-variables',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="heading-serif mb-6" style="font-size:32px;font-weight:700;color:#fff;">Shared Variables</h1>
    <p class="mb-4 text-sm" style="color: var(--color-text-secondary)">Team-level variables reusable across all resources.</p>

    <div class="box max-w-2xl">
      @for (v of vars(); track v.key) {
        <div class="mb-2 flex items-center gap-2 text-sm">
          <code>{{ v.key }}</code>
          <span style="color: var(--color-text-secondary)">= {{ v.value }}</span>
        </div>
      }
      <form class="mt-3 flex gap-2" [formGroup]="form" (ngSubmit)="add()">
        <input class="input flex-1" placeholder="KEY" formControlName="key" />
        <input class="input flex-1" placeholder="value" formControlName="value" />
        <button class="button" type="submit" [disabled]="form.invalid || teamId() === null">Add</button>
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
}
