import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ApiService } from '../../../shared/services/api.service';
import { ServiceTemplate } from '../../../shared/models/ideploy.models';
import { serviceLogoUrl } from '../../../shared/utils/service-logo.util';

/**
 * Inline, optional "add a message broker" step (microservices architecture
 * only) — a condensed pick-and-deploy from the same one-click service
 * catalog `new-project.ts`'s own "Clone Template" panel offers, minus the
 * screenshots and category browsing that panel has room for and this one
 * doesn't need. Skippable: unlike the database and app steps, nothing later
 * in the guide depends on this existing.
 */
@Component({
  selector: 'app-guide-service-step',
  imports: [FormsModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-3">
      <div class="relative">
        <i class="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-xs" style="color:var(--color-text-tertiary);"></i>
        <input class="input" style="padding-left:30px;" [ngModel]="query()" (ngModelChange)="query.set($event)" [placeholder]="'projects.new.searchReposPlaceholder' | translate" />
      </div>

      @if (deploying()) {
        <p class="text-sm" style="color:var(--color-text-secondary);"><i class="fa-solid fa-circle-notch fa-spin mr-1"></i>{{ 'projects.common.deploying' | translate }}</p>
      } @else {
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-3" style="max-height:280px;overflow-y:auto;">
          @for (t of filtered(); track t.name) {
            <button type="button" class="db-glass flex flex-col items-center gap-2 rounded-xl p-3 text-center hover:border-blue-500/50 transition-colors" (click)="deploy(t)">
              @if (logo(t); as l) {
                <img [src]="l" class="h-8 w-8 object-contain" alt="" (error)="onLogoError($event)" />
              } @else {
                <i class="fa-solid fa-cube text-xl" style="color:var(--color-text-secondary);"></i>
              }
              <span class="truncate text-xs font-semibold capitalize">{{ t.name }}</span>
            </button>
          }
        </div>
      }

      @if (error()) {
        <p class="text-sm text-red-400">{{ error() }}</p>
      }

      <button type="button" class="text-xs font-semibold hover:underline" style="color:var(--color-text-tertiary);" (click)="completed.emit()">
        {{ 'architectures.skipStep' | translate }}
      </button>
    </div>
  `,
})
export class GuideServiceStepComponent implements OnInit {
  private api = inject(ApiService);
  private translate = inject(TranslateService);

  readonly workspaceUuid = input.required<string>();
  readonly completed = output<void>();

  protected readonly templates = signal<ServiceTemplate[]>([]);
  protected readonly query = signal('');
  protected readonly deploying = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    const list = this.templates();
    return (q ? list.filter((t) => t.name.toLowerCase().includes(q)) : list).slice(0, 30);
  });

  ngOnInit(): void {
    this.api.listServiceTemplates().subscribe((list) => this.templates.set(list));
  }

  protected logo(t: ServiceTemplate): string | null {
    return serviceLogoUrl(t.logo);
  }

  protected onLogoError(event: Event): void {
    (event.target as HTMLImageElement).style.display = 'none';
  }

  protected deploy(t: ServiceTemplate): void {
    this.deploying.set(true);
    this.error.set(null);
    this.api.createServiceFromTemplate({ template: t.name, name: t.name, workspace_uuid: this.workspaceUuid() }).subscribe({
      next: () => {
        this.deploying.set(false);
        this.completed.emit();
      },
      error: (e) => {
        this.deploying.set(false);
        this.error.set(e?.error?.error?.message ?? this.translate.instant('projects.common.deploymentFailed'));
      },
    });
  }
}
