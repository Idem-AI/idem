import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ApiService } from '../../../shared/services/api.service';
import { Database, DatabaseType } from '../../../shared/models/ideploy.models';

@Component({
  selector: 'app-databases-list',
  imports: [ReactiveFormsModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="mb-6 text-2xl font-bold">{{ 'databases.title' | translate }}</h1>

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div>
        @if (loading()) {
          <p class="text-sm" style="color: var(--color-text-secondary)">{{ 'databases.loading' | translate }}</p>
        } @else if (databases().length === 0) {
          <div class="box">{{ 'databases.empty' | translate }}</div>
        } @else {
          <div class="space-y-3">
            @for (db of databases(); track db.uuid) {
              <div class="box flex items-center justify-between">
                <div>
                  <div class="font-semibold">{{ db.name }}</div>
                  <div class="text-sm" style="color: var(--color-text-secondary)">
                    {{ db.type }} · {{ db.image }} · {{ db.status }}
                  </div>
                </div>
                <div class="flex gap-2">
                  <button class="button-secondary" (click)="action(db, 'start')">{{ 'databases.start' | translate }}</button>
                  <button class="button-secondary" (click)="action(db, 'stop')">{{ 'databases.stop' | translate }}</button>
                  <button class="button-secondary" (click)="backup(db)">{{ 'databases.backupNow' | translate }}</button>
                  <button class="text-xs text-red-400" (click)="remove(db)">{{ 'databases.delete' | translate }}</button>
                </div>
              </div>
            }
          </div>
        }
      </div>

      <form class="box space-y-3" [formGroup]="form" (ngSubmit)="create()">
        <h2 class="font-semibold">{{ 'databases.newDatabase' | translate }}</h2>
        <div>
          <label class="mb-1 block text-sm">{{ 'databases.type' | translate }}</label>
          <select class="input" formControlName="type">
            @for (t of types; track t) {
              <option [value]="t">{{ t }}</option>
            }
          </select>
        </div>
        <div>
          <label class="mb-1 block text-sm">{{ 'databases.name' | translate }}</label>
          <input class="input" formControlName="name" />
        </div>
        <div class="flex gap-3">
          <div class="flex-1">
            <label class="mb-1 block text-sm">{{ 'databases.environmentId' | translate }}</label>
            <input class="input" type="number" formControlName="environment_id" />
          </div>
          <div class="flex-1">
            <label class="mb-1 block text-sm">{{ 'databases.destinationId' | translate }}</label>
            <input class="input" type="number" formControlName="destination_id" />
          </div>
        </div>
        @if (error()) {
          <p class="text-sm text-red-400">{{ error() }}</p>
        }
        <button class="button" type="submit" [disabled]="form.invalid || saving()">
          {{ (saving() ? 'databases.creating' : 'databases.createDatabase') | translate }}
        </button>
      </form>
    </div>
  `,
})
export class DatabasesListComponent implements OnInit {
  private api = inject(ApiService);
  private fb = inject(FormBuilder);
  private translate = inject(TranslateService);

  protected readonly types: DatabaseType[] = [
    'postgresql',
    'mysql',
    'mariadb',
    'mongodb',
    'redis',
    'keydb',
    'dragonfly',
    'clickhouse',
  ];

  protected readonly databases = signal<Database[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    type: ['postgresql' as DatabaseType, Validators.required],
    name: ['', Validators.required],
    environment_id: [0, Validators.required],
    destination_id: [0, Validators.required],
  });

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.api.listDatabases().subscribe({
      next: (dbs) => {
        this.databases.set(dbs);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected create(): void {
    if (this.form.invalid) return;
    this.saving.set(true);
    this.error.set(null);
    const { type, ...body } = this.form.getRawValue();
    this.api.createDatabase(type, body).subscribe({
      next: () => {
        this.form.reset({ type: 'postgresql', name: '', environment_id: 0, destination_id: 0 });
        this.saving.set(false);
        this.load();
      },
      error: (e) => {
        this.error.set(e?.error?.error?.message ?? this.translate.instant('databases.createError'));
        this.saving.set(false);
      },
    });
  }

  protected action(db: Database, act: 'start' | 'stop' | 'restart'): void {
    this.api.dbLifecycle(db.type, db.uuid, act).subscribe(() => this.load());
  }

  protected backup(db: Database): void {
    this.api.backupNow(db.type, db.uuid).subscribe();
  }

  protected remove(db: Database): void {
    this.api.deleteDatabase(db.type, db.uuid).subscribe(() => {
      this.databases.update((list) => list.filter((d) => d.uuid !== db.uuid));
    });
  }
}
