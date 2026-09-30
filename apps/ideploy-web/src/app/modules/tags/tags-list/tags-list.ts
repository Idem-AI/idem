import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import { ApiService } from '../../../shared/services/api.service';
import { Tag } from '../../../shared/models/ideploy.models';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header';

/**
 * Tags — labels you pin on applications (from each application's own page)
 * to find and group them later. This page is the team's list of them: add
 * one, remove one. Adding sits first because an empty list has nothing else
 * to offer; removing is on each tag, where you'd look for it.
 */
@Component({
  selector: 'app-tags-list',
  imports: [ReactiveFormsModule, TranslateModule, IdemLoaderComponent, EmptyStateComponent, PageHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header [title]="'tags.title' | translate" [subtitle]="'tags.subtitle' | translate" [count]="loading() ? null : tags().length" />

    <div class="max-w-2xl space-y-6">
      <form class="glass-card flex flex-wrap items-end gap-3 p-5" [formGroup]="form" (ngSubmit)="add()">
        <div class="min-w-[200px] flex-1">
          <label class="mb-1 block text-sm" for="tag-name">{{ 'tags.newTagLabel' | translate }}</label>
          <input type="text" id="tag-name" [placeholder]="'tags.newTagPlaceholder' | translate" formControlName="name" autocomplete="off" />
        </div>
        <button class="inner-button" type="submit" [disabled]="form.invalid || saving()">
          @if (saving()) { <idem-loader size="xs" /> } @else { <i class="pi pi-plus mr-2 text-xs"></i> }
          {{ 'tags.add' | translate }}
        </button>
        @if (error()) {
          <p class="w-full text-sm" style="color:var(--color-danger);">{{ error() }}</p>
        }
      </form>

      @if (loading()) {
        <div class="flex flex-wrap gap-2" aria-hidden="true">
          @for (i of [1, 2, 3, 4, 5]; track i) { <div class="skeleton h-8 w-24 rounded-full"></div> }
        </div>
      } @else if (tags().length === 0) {
        <div class="glass-card">
          <app-empty-state kind="beads" [title]="'tags.emptyTitle' | translate" [body]="'tags.emptyBody' | translate" />
        </div>
      } @else {
        <ul class="flex flex-wrap gap-2">
          @for (tag of tags(); track tag.uuid) {
            <li class="inline-flex items-center gap-2 rounded-full border py-1 pl-3 pr-1 text-sm" style="border-color:var(--glass-border);background:var(--glass-bg-subtle);">
              <i class="pi pi-tag text-[10px]" style="color:var(--color-primary-500);"></i>
              <span class="text-text-primary">{{ tag.name }}</span>
              <button
                type="button"
                class="flex h-6 w-6 items-center justify-center rounded-full transition-smooth hover:bg-[var(--glass-bg-light)]"
                [style.color]="removing() === tag.uuid ? 'var(--color-danger)' : 'var(--color-text-tertiary)'"
                [attr.aria-label]="'tags.remove' | translate: { name: tag.name }"
                [disabled]="removing() === tag.uuid"
                (click)="remove(tag)"
              >
                @if (removing() === tag.uuid) { <idem-loader size="xs" /> } @else { <i class="pi pi-times text-[10px]"></i> }
              </button>
            </li>
          }
        </ul>
      }
    </div>
  `,
})
export class TagsListComponent implements OnInit {
  private api = inject(ApiService);
  private fb = inject(FormBuilder);
  private translate = inject(TranslateService);

  protected readonly tags = signal<Tag[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly removing = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly form = this.fb.nonNullable.group({ name: ['', Validators.required] });

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.api.listTags().subscribe({
      next: (t) => {
        this.tags.set(t);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected add(): void {
    if (this.form.invalid) return;
    this.saving.set(true);
    this.error.set(null);
    this.api.createTag(this.form.getRawValue().name.trim()).subscribe({
      next: () => {
        this.form.reset();
        this.saving.set(false);
        this.load();
      },
      error: (e) => {
        this.saving.set(false);
        this.error.set(e?.error?.error?.message ?? this.translate.instant('tags.addError'));
      },
    });
  }

  protected remove(tag: Tag): void {
    this.removing.set(tag.uuid);
    this.api.deleteTag(tag.uuid).subscribe({
      next: () => {
        this.tags.update((list) => list.filter((t) => t.uuid !== tag.uuid));
        this.removing.set(null);
      },
      error: () => this.removing.set(null),
    });
  }
}
