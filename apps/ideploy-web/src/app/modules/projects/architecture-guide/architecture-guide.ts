import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { ArchitectureTemplate, GuideStep, getArchitectureTemplate } from '../../../shared/data/architecture-templates';

/**
 * Architecture guide — a checklist that orients the user through deploying a
 * multi-resource architecture (e.g. "3-Tier Application": frontend + backend +
 * database), one real, working flow per step. It does not create or link any
 * resource itself: each step hands off to `/new-project` (Git/Docker Compose/
 * Docker Image import) or `/databases`, the same flows reachable directly from
 * the sidebar. "Done" here is the visitor ticking a box after doing the work
 * elsewhere — there is nothing server-side tracking real completion, and the
 * copy says so rather than implying otherwise.
 */
@Component({
  selector: 'app-architecture-guide',
  imports: [RouterLink, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex h-16 items-center justify-between border-b px-6" style="border-color:var(--color-surface-2);">
      <a routerLink="/new-project" class="flex items-center gap-2 text-sm transition-colors hover:text-text-primary" style="color:var(--color-text-secondary);">
        <i class="fa-solid fa-arrow-left"></i> {{ 'projects.common.back' | translate }}
      </a>
      <span class="text-sm font-semibold font-mono text-text-primary">{{ 'architectures.guideTitle' | translate }}</span>
      <span class="w-12"></span>
    </div>

    <div class="mx-auto max-w-3xl px-6 py-12">
      @if (!template()) {
        <div class="box">
          <p class="mb-3">{{ 'architectures.notFound' | translate }}</p>
          <a class="button-secondary" routerLink="/new-project">{{ 'projects.new.chooseAnotherSource' | translate }}</a>
        </div>
      } @else {
        <div class="mb-8 flex items-center gap-4">
          <div class="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl" style="background:var(--color-surface-2);">
            <i [class]="template()!.icon" class="text-2xl" style="color:var(--color-primary-400);"></i>
          </div>
          <div>
            <h1 class="text-2xl font-bold">{{ template()!.name | translate }}</h1>
            <p class="text-sm" style="color:var(--color-text-secondary);">{{ template()!.description | translate }}</p>
          </div>
        </div>

        <p class="mb-6 text-sm" style="color:var(--color-text-tertiary);">{{ 'architectures.guideHint' | translate }}</p>

        <div class="space-y-3">
          @for (step of template()!.steps; track $index; let i = $index) {
            <div class="box flex items-center gap-4" [style.opacity]="done().has(i) ? '0.6' : '1'">
              <button
                type="button"
                class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border transition-colors"
                [style.border-color]="done().has(i) ? 'var(--color-success)' : 'var(--color-surface-2)'"
                [style.background]="done().has(i) ? 'var(--color-success)' : 'transparent'"
                [attr.aria-label]="'architectures.markDone' | translate"
                (click)="toggleDone(i)"
              >
                @if (done().has(i)) {
                  <i class="fa-solid fa-check text-xs text-white"></i>
                } @else {
                  <span class="text-xs font-semibold" style="color:var(--color-text-tertiary);">{{ i + 1 }}</span>
                }
              </button>
              <div class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg" style="background:var(--color-surface-2);">
                <i [class]="step.icon" style="color:var(--color-primary-400);"></i>
              </div>
              <div class="min-w-0 flex-1">
                <div class="font-semibold">{{ step.title | translate }}</div>
                <p class="text-sm" style="color:var(--color-text-secondary);">{{ step.description | translate }}</p>
              </div>
              <a class="button-secondary flex-shrink-0" [routerLink]="targetFor(step)" [queryParams]="workspaceQuery()" (click)="toggleDone(i, true)">
                {{ 'architectures.goToStep' | translate }} <i class="fa-solid fa-arrow-right ml-1"></i>
              </a>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class ArchitectureGuideComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  protected readonly template = signal<ArchitectureTemplate | null>(null);
  protected readonly done = signal<Set<number>>(new Set());
  private workspaceUuid: string | null = null;

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.template.set(getArchitectureTemplate(id));
    this.workspaceUuid = this.route.snapshot.queryParamMap.get('workspace');
  }

  protected workspaceQuery(): Record<string, string> {
    return this.workspaceUuid ? { workspace: this.workspaceUuid } : {};
  }

  protected targetFor(step: GuideStep): string {
    switch (step.action) {
      case 'create-database':
        return '/databases';
      case 'create-service':
        return '/templates';
      case 'import-app':
      default:
        return '/new-project';
    }
  }

  /** Self-reported only — clicking "Go" marks a step visited, ticking the box marks it done; neither is verified against an actual deployment. */
  protected toggleDone(index: number, forceOn = false): void {
    this.done.update((set) => {
      const next = new Set(set);
      if (forceOn) next.add(index);
      else if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }
}
