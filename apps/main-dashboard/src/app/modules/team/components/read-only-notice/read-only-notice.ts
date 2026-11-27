import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { filter, map } from 'rxjs';
import { CurrentProjectService } from '../../../../shared/services/current-project.service';
import { isReadOnlyRoute, routeSpace } from '../../../../shared/utils/project-space-routes';

/**
 * « Vous consultez cet espace en lecture seule. »
 *
 * Flotte en haut au centre avec les autres rappels, sur les pages d'un espace
 * qu'un membre peut voir sans le modifier. Il dit pourquoi les actions
 * échoueront et à qui demander plus. Fermé, il ne revient pas pour cet espace
 * pendant la session.
 */
@Component({
  selector: 'app-read-only-notice',
  imports: [TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible(); as space) {
      <div class="glass-card flex items-start gap-3 px-4 py-3 text-sm" role="status">
        <i class="pi pi-eye mt-0.5 text-primary-500" aria-hidden="true"></i>
        <p class="min-w-0 flex-1 text-text-primary">
          <strong>{{ 'team.readOnly.title' | translate }}</strong>
          · {{ 'team.readOnly.body' | translate: { space: ('team.spaces.' + space + '.label' | translate), owner: ownerName() } }}
        </p>
        <button
          type="button"
          class="button-icon button-sm"
          [attr.aria-label]="'common.close' | translate"
          (click)="dismiss(space)"
        >
          <i class="pi pi-times" aria-hidden="true"></i>
        </button>
      </div>
    }
  `,
})
export class ReadOnlyNoticeComponent {
  private readonly router = inject(Router);
  private readonly projects = inject(CurrentProjectService);
  private readonly dismissed = signal<ReadonlySet<string>>(new Set());

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  protected readonly ownerName = computed(() => this.projects.access()?.ownerName ?? '');

  protected readonly visible = computed(() => {
    const url = this.url();
    if (!isReadOnlyRoute(this.projects.access(), url)) return null;
    const space = routeSpace(url);
    return space && !this.dismissed().has(space) ? space : null;
  });

  protected dismiss(space: string): void {
    this.dismissed.update((set) => new Set([...set, space]));
  }
}
