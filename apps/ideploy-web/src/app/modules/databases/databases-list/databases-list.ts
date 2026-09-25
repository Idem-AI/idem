import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ApiService } from '../../../shared/services/api.service';
import { Database, DatabaseType } from '../../../shared/models/ideploy.models';
import { DB_ENGINES, dbEngine } from '../../../shared/utils/db-icon.util';
import {
  WorkspaceTarget,
  WorkspaceTargetPickerComponent,
} from '../../../shared/components/workspace-target-picker/workspace-target-picker';

@Component({
  selector: 'app-databases-list',
  imports: [RouterLink, ReactiveFormsModule, TranslateModule, WorkspaceTargetPickerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="mb-6 text-2xl font-bold">{{ 'databases.title' | translate }}</h1>

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div>
        @if (loading()) {
          <p class="text-sm" style="color: var(--color-text-secondary)">{{ 'databases.loading' | translate }}</p>
        } @else if (databases().length === 0) {
          <div class="glass-card p-4">{{ 'databases.empty' | translate }}</div>
        } @else {
          <div class="space-y-3">
            @for (db of databases(); track db.uuid) {
              <div class="glass-card p-4 flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <div
                    class="flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg [&_svg]:h-6 [&_svg]:w-6"
                    style="background:var(--color-surface-2);"
                    [innerHTML]="iconHtml(db.type)"
                  ></div>
                  <div>
                    <a class="font-semibold hover:underline" [routerLink]="['/databases', db.type, db.uuid]">{{ db.name }}</a>
                    <div class="text-sm" style="color: var(--color-text-secondary)">
                      {{ db.type }} · {{ db.image }} · {{ db.status }}
                    </div>
                  </div>
                </div>
                <div class="flex gap-2">
                  <button class="outer-button" (click)="action(db, 'start')">{{ 'databases.start' | translate }}</button>
                  <button class="outer-button" (click)="action(db, 'stop')">{{ 'databases.stop' | translate }}</button>
                  <button class="outer-button" (click)="backup(db)">{{ 'databases.backupNow' | translate }}</button>
                  <button class="text-xs text-red-400" (click)="remove(db)">{{ 'databases.delete' | translate }}</button>
                </div>
              </div>
            }
          </div>
        }
      </div>

      <div class="glass-card p-4 space-y-4">
        <h2 class="font-semibold">{{ 'databases.newDatabase' | translate }}</h2>

        <div>
          <label class="mb-2 block text-sm">{{ 'databases.chooseEngine' | translate }}</label>
          <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
            @for (engine of engines; track engine.type) {
              <button
                type="button"
                class="flex flex-col items-center gap-2 rounded-xl p-3 text-center transition-colors"
                [style.border]="form.controls.type.value === engine.type ? '1px solid ' + engine.color : '1px solid var(--color-surface-2)'"
                [style.background]="form.controls.type.value === engine.type ? 'color-mix(in srgb, ' + engine.color + ' 12%, transparent)' : 'var(--color-surface-1)'"
                (click)="form.controls.type.setValue(engine.type)"
              >
                <div class="flex h-10 w-10 items-center justify-center [&_svg]:h-7 [&_svg]:w-7" [innerHTML]="iconHtml(engine.type)"></div>
                <span class="text-xs font-semibold">{{ engine.name }}</span>
              </button>
            }
          </div>
          <p class="mt-2 text-xs" style="color: var(--color-text-secondary)">{{ dbEngine(form.controls.type.value).description }}</p>
        </div>

        <form class="space-y-3" [formGroup]="form" (ngSubmit)="create()">
          <div>
            <label class="mb-1 block text-sm">{{ 'databases.name' | translate }}</label>
            <input class="input" formControlName="name" />
          </div>

          <app-workspace-target-picker (targetChange)="target.set($event)" />

          @if (error()) {
            <p class="text-sm text-red-400">{{ error() }}</p>
          }
          <button class="inner-button" type="submit" [disabled]="form.invalid || !target() || saving()">
            {{ (saving() ? 'databases.creating' : 'databases.createDatabase') | translate }}
          </button>
        </form>
      </div>
    </div>
  `,
})
export class DatabasesListComponent implements OnInit {
  private api = inject(ApiService);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private translate = inject(TranslateService);
  private sanitizer = inject(DomSanitizer);

  protected readonly engines = DB_ENGINES;
  protected readonly dbEngine = dbEngine;

  private readonly iconCache = new Map<DatabaseType, SafeHtml>();

  protected readonly databases = signal<Database[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly target = signal<WorkspaceTarget | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    type: ['postgresql' as DatabaseType, Validators.required],
    name: ['', Validators.required],
  });

  ngOnInit(): void {
    this.load();
  }

  /** Trusted markup — hand-authored SVGs in `db-icon.util.ts`, never user input. */
  protected iconHtml(type: DatabaseType): SafeHtml {
    let html = this.iconCache.get(type);
    if (!html) {
      html = this.sanitizer.bypassSecurityTrustHtml(dbEngine(type).svg);
      this.iconCache.set(type, html);
    }
    return html;
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
    const target = this.target();
    if (this.form.invalid || !target) return;
    this.saving.set(true);
    this.error.set(null);
    const { type, name } = this.form.getRawValue();
    this.api
      .createDatabase(type, {
        name,
        workspace_uuid: target.workspace_uuid,
        environment_name: target.environment_name,
        project_name: target.project_name,
      })
      .subscribe({
        next: (db) => {
          // Straight to the resource that was just created, not back to a list
          // it now silently sits in — that's the page with the Start button and
          // the live console, and it's what the "was this created?" question
          // actually needs an answer from.
          this.saving.set(false);
          this.router.navigate(['/databases', db.type, db.uuid]);
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
