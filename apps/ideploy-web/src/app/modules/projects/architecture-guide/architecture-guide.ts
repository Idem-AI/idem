import { ChangeDetectionStrategy, Component, computed, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ApiService } from '../../../shared/services/api.service';
import { ArchitectureTemplate, GuideStep, getArchitectureTemplate } from '../../../shared/data/architecture-templates';
import { GuideSessionService } from '../../../shared/services/guide-session.service';
import { GuideWorkspaceStepComponent } from './guide-workspace-step';
import { GuideDbStepComponent } from './guide-db-step';
import { GuideAppStepComponent } from './guide-app-step';
import { GuideServiceStepComponent } from './guide-service-step';

/**
 * Architecture guide — pilots the entire deployment of a multi-resource
 * architecture (e.g. "3-Tier Application": database + backend + frontend)
 * from this one page, in dependency order: workspace, then each step of
 * `template.steps` in turn. Nothing here ever navigates the browser away —
 * each step is an inline component (`guide-*-step.ts`) that talks to the API
 * directly and reports back through `GuideSessionService`, the same session
 * store `import-config.ts`'s standalone flow used to read via query params
 * when steps lived on their own pages. Only one step is ever interactive at
 * a time (`activeIndex`); earlier ones collapse into a done summary, later
 * ones stay locked, so the operator is never asked two questions at once.
 */
@Component({
  selector: 'app-architecture-guide',
  imports: [RouterLink, TranslateModule, GuideWorkspaceStepComponent, GuideDbStepComponent, GuideAppStepComponent, GuideServiceStepComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex h-16 items-center justify-between border-b px-6" style="border-color:var(--color-surface-2);">
      <a routerLink="/new-project" class="flex items-center gap-2 text-sm transition-colors hover:text-text-primary" style="color:var(--color-text-secondary);">
        <i class="pi pi-arrow-left"></i> {{ 'projects.common.back' | translate }}
      </a>
      <span class="text-sm font-semibold font-mono text-text-primary">{{ 'architectures.guideTitle' | translate }}</span>
      <span class="w-12"></span>
    </div>

    <div class="mx-auto max-w-3xl px-6 py-12">
      @if (!template()) {
        <div class="glass-card p-4">
          <p class="mb-3">{{ 'architectures.notFound' | translate }}</p>
          <a class="outer-button" routerLink="/new-project">{{ 'projects.new.chooseAnotherSource' | translate }}</a>
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

        <p class="mb-6 text-sm" style="color:var(--color-text-tertiary);">{{ 'architectures.guideHintInline' | translate }}</p>

        <div class="space-y-3">
          <!-- Step 0: the workspace everything below lands in — a real prerequisite, not one of template().steps. -->
          <div class="glass-card p-4">
            <div class="mb-1 flex items-center gap-3">
              <div class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border" [style.border-color]="workspace() ? 'var(--color-success)' : 'var(--color-surface-2)'" [style.background]="workspace() ? 'var(--color-success)' : 'transparent'">
                @if (workspace()) {
                  <i class="pi pi-check text-xs text-white"></i>
                } @else {
                  <i class="pi pi-sitemap text-xs" style="color:var(--color-text-tertiary);"></i>
                }
              </div>
              <div class="font-semibold">{{ 'architectures.workspaceStepTitle' | translate }}</div>
            </div>
            @if (workspace(); as ws) {
              <p class="ml-11 text-sm" style="color:var(--color-text-secondary);">
                <i class="pi pi-clone mr-1"></i>{{ ws.name }}
              </p>
            } @else {
              <div class="ml-11 mt-3">
                <app-guide-workspace-step [architectureId]="architectureId" [suggestedName]="workspaceSuggestedName()" (completed)="onWorkspaceReady()" />
              </div>
            }
          </div>

          @if (workspace(); as ws) {
            @for (step of template()!.steps; track $index; let i = $index) {
              <div class="glass-card p-4" [style.opacity]="i > activeIndex() ? '0.5' : '1'">
                <div class="mb-1 flex items-center gap-4">
                  <div class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border" [style.border-color]="isDone(i, step) ? 'var(--color-success)' : 'var(--color-surface-2)'" [style.background]="isDone(i, step) ? 'var(--color-success)' : 'transparent'">
                    @if (isDone(i, step)) {
                      <i class="pi pi-check text-xs text-white"></i>
                    } @else if (i > activeIndex()) {
                      <i class="pi pi-lock text-xs" style="color:var(--color-text-tertiary);"></i>
                    } @else {
                      <span class="text-xs font-semibold" style="color:var(--color-text-tertiary);">{{ i + 1 }}</span>
                    }
                  </div>
                  <div class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg" style="background:var(--color-surface-2);">
                    <i [class]="step.icon" style="color:var(--color-primary-400);"></i>
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="font-semibold">{{ step.title | translate }}</div>
                    <p class="text-sm" style="color:var(--color-text-secondary);">{{ step.description | translate }}</p>
                  </div>
                </div>

                @if (isDone(i, step)) {
                  <div class="ml-11 mt-2 text-sm" style="color:var(--color-text-secondary);">
                    @if (step.action === 'create-database') {
                      <i class="pi pi-database mr-1"></i>{{ linkedDatabase()?.name }}
                      @if (linkedCache(); as c) {
                        <span class="ml-2"><i class="pi pi-bolt mr-1"></i>{{ c.name }}</span>
                      }
                    } @else if (step.action === 'import-app') {
                      <i class="pi pi-check-circle mr-1"></i>{{ appNameFor(i, step) }}
                      @if (appUrlFor(i, step); as url) {
                        <a [href]="url" target="_blank" rel="noopener noreferrer" class="ml-2 hover:underline" style="color:var(--color-primary-400);">
                          {{ url }} <i class="pi pi-external-link text-[10px]"></i>
                        </a>
                      }
                    } @else {
                      <i class="pi pi-check-circle mr-1"></i>{{ 'architectures.stepDone' | translate }}
                    }
                  </div>
                } @else if (i === activeIndex()) {
                  <div class="ml-11 mt-3">
                    @switch (step.action) {
                      @case ('create-database') {
                        <app-guide-db-step [architectureId]="architectureId" [workspaceUuid]="ws.uuid" [suggestedName]="dbSuggestedName()" (completed)="onStepChanged()" />
                      }
                      @case ('import-app') {
                        <app-guide-app-step [architectureId]="architectureId" [workspaceUuid]="ws.uuid" [role]="step.role" [suggestedName]="appSuggestedName(step)" (completed)="onStepChanged()" />
                      }
                      @case ('create-service') {
                        <app-guide-service-step [workspaceUuid]="ws.uuid" (completed)="onServiceStepDone(i)" />
                      }
                    }
                  </div>
                }
              </div>
            }

            @if (activeIndex() === -1) {
              <div class="glass-card p-4 text-center">
                <i class="pi pi-check-circle mb-2 text-2xl" style="color:var(--color-success);"></i>
                <p class="mb-3 font-semibold">{{ 'architectures.guideComplete' | translate }}</p>
                <a class="inner-button" [routerLink]="['/workspaces', ws.uuid]">{{ 'architectures.viewWorkspace' | translate }}</a>
              </div>
            }
          }
        </div>
      }
    </div>
  `,
})
export class ArchitectureGuideComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private api = inject(ApiService);
  private translate = inject(TranslateService);
  protected readonly guideSession = inject(GuideSessionService);

  protected readonly template = signal<ArchitectureTemplate | null>(null);
  /** Manual fallback only, for the one action (`create-service`) with no resource for `GuideSessionService` to link. */
  protected readonly manuallyDone = signal<Set<number>>(new Set());
  protected architectureId = '';

  protected readonly workspace = computed(() => (this.architectureId ? this.guideSession.workspace(this.architectureId) : null));
  protected readonly linkedDatabase = computed(() => (this.architectureId ? this.guideSession.database(this.architectureId) : null));
  protected readonly linkedCache = computed(() => (this.architectureId ? this.guideSession.cache(this.architectureId) : null));

  protected readonly workspaceSuggestedName = computed(() => (this.template() ? this.translate.instant(this.template()!.name) : ''));
  protected readonly dbSuggestedName = computed(() => {
    const name = this.workspace()?.name;
    return name ? `${name}-db` : 'database';
  });

  /** Index of the first not-yet-done step — everything before it is a done summary, everything after is locked. -1 once every step is done. */
  protected readonly activeIndex = computed(() => {
    const tpl = this.template();
    if (!tpl) return -1;
    for (let i = 0; i < tpl.steps.length; i++) {
      if (!this.isDone(i, tpl.steps[i])) return i;
    }
    return -1;
  });

  ngOnInit(): void {
    this.architectureId = this.route.snapshot.paramMap.get('id') ?? '';
    this.template.set(getArchitectureTemplate(this.architectureId));
    const workspaceUuid = this.route.snapshot.queryParamMap.get('workspace');

    // A session persists in sessionStorage so an OAuth round-trip or an
    // accidental reload mid-guide doesn't lose progress — but that same
    // persistence means clicking this same architecture card again *after*
    // finishing it would otherwise resume the finished run instead of
    // starting the new one the operator clearly means to. Only a session
    // that isn't fully done yet is worth resuming.
    if (this.architectureId && this.guideSession.hasSession(this.architectureId) && this.isSessionFullyDone()) {
      this.guideSession.clear();
    }
    if (this.architectureId) this.guideSession.start(this.architectureId, workspaceUuid);

    // A workspace uuid arriving via query param (from that workspace's own
    // "+ Nouvelle ressource" link) has no name yet — `start()` only stores
    // the uuid it was given. Resolve it once so the done-card and later
    // steps' suggested names have something real to show.
    const ws = this.guideSession.workspace(this.architectureId);
    if (ws && !ws.name) {
      this.api.getWorkspace(ws.uuid).subscribe({
        next: (w) => this.guideSession.setWorkspace(this.architectureId, w.uuid, w.name),
        error: () => undefined,
      });
    }
  }

  /**
   * Whether the existing (about-to-be-resumed) session already finished
   * every step — checked once, in `ngOnInit`, before `manuallyDone` (a
   * fresh, empty signal on this new component instance) would make an
   * already-confirmed `create-service` step look undone again. That one
   * quirk means a microservices guide's optional broker step doesn't
   * survive this staleness check across a reload — an accepted gap, not a
   * silent data loss: nothing about the broker itself is undone, only this
   * one completion check can't see it.
   */
  private isSessionFullyDone(): boolean {
    const tpl = this.template();
    if (!tpl) return false;
    return tpl.steps.every((step, i) => this.isDone(i, step));
  }

  protected isDone(index: number, step: GuideStep): boolean {
    if (step.action === 'create-database') return this.linkedDatabase() !== null;
    if (step.action === 'import-app') {
      const importStepsUpToHere = this.template()!.steps.slice(0, index + 1).filter((s) => s.action === 'import-app').length;
      return this.guideSession.appCount(this.architectureId) >= importStepsUpToHere;
    }
    return this.manuallyDone().has(index);
  }

  /** This step's position among every `import-app` step (0-based, document order) — how `GuideSessionService.appAt` finds the app THIS step (not some other one) linked. */
  private importIndexOf(index: number): number {
    return this.template()!.steps.slice(0, index + 1).filter((s) => s.action === 'import-app').length - 1;
  }

  /** The Nth `import-app` step's own linked app — for its done-card label. */
  protected appNameFor(index: number, step: GuideStep): string {
    if (step.action !== 'import-app') return '';
    return this.guideSession.appAt(this.architectureId, this.importIndexOf(index))?.name ?? this.translate.instant('architectures.stepDone');
  }

  /** Same app, its real reachable URL — null while not yet deployed, or for a step with no public URL of its own (e.g. it failed, or the operator continued past a failed build anyway). */
  protected appUrlFor(index: number, step: GuideStep): string | null {
    if (step.action !== 'import-app') return null;
    return this.guideSession.appAt(this.architectureId, this.importIndexOf(index))?.publicUrl ?? null;
  }

  protected appSuggestedName(step: GuideStep): string {
    return step.role ?? '';
  }

  protected onWorkspaceReady(): void {
    /* `workspace` is a computed signal over GuideSessionService's own state — nothing to do here but let it re-evaluate. */
  }

  protected onStepChanged(): void {
    /* Same as above: every inline step writes into GuideSessionService itself, so the computed signals above already reflect it. */
  }

  protected onServiceStepDone(index: number): void {
    this.manuallyDone.update((set) => new Set(set).add(index));
  }
}
