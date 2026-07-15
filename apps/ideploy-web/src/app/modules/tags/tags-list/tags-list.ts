import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { ApiService } from '../../../shared/services/api.service';
import { Tag } from '../../../shared/models/ideploy.models';

@Component({
  selector: 'app-tags-list',
  imports: [ReactiveFormsModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="mb-6 text-2xl font-bold">{{ 'tags.title' | translate }}</h1>
    <div class="box max-w-lg">
      @if (loading()) {
        <p class="text-sm" style="color: var(--color-text-secondary)">{{ 'tags.loading' | translate }}</p>
      } @else {
        <div class="mb-4 flex flex-wrap gap-2">
          @for (tag of tags(); track tag.uuid) {
            <span class="inline-flex items-center gap-2 rounded-md px-3 py-1 text-sm"
                  style="background-color: var(--color-surface-2)">
              {{ tag.name }}
              <button class="text-xs text-red-400" (click)="remove(tag)">×</button>
            </span>
          }
        </div>
      }
      <form class="flex gap-2" [formGroup]="form" (ngSubmit)="add()">
        <input class="input flex-1" [placeholder]="'tags.newTagPlaceholder' | translate" formControlName="name" />
        <button class="button" type="submit" [disabled]="form.invalid">{{ 'tags.add' | translate }}</button>
      </form>
    </div>
  `,
})
export class TagsListComponent implements OnInit {
  private api = inject(ApiService);
  private fb = inject(FormBuilder);

  protected readonly tags = signal<Tag[]>([]);
  protected readonly loading = signal(true);
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
    this.api.createTag(this.form.getRawValue().name).subscribe(() => {
      this.form.reset();
      this.load();
    });
  }

  protected remove(tag: Tag): void {
    this.api.deleteTag(tag.uuid).subscribe(() => {
      this.tags.update((list) => list.filter((t) => t.uuid !== tag.uuid));
    });
  }
}
