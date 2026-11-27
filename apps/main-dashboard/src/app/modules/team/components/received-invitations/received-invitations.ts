import { ChangeDetectionStrategy, Component, inject, OnInit, output, signal } from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import { NotificationService } from '../../../../shared/services/notification.service';
import { AccessSummaryComponent } from '../access-summary/access-summary';
import { PendingInvitation, TeamService } from '../../services/team.service';

/**
 * Les invitations en attente, en tête de « Mes projets ».
 *
 * L'e-mail peut se perdre ou être ouvert plus tard : la personne invitée doit
 * retrouver l'invitation là où elle cherche ses projets. Rien ne s'affiche
 * quand il n'y en a pas.
 */
@Component({
  selector: 'app-received-invitations',
  imports: [TranslateModule, IdemLoaderComponent, AccessSummaryComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (invitations().length > 0) {
      <section class="mt-4 flex shrink-0 flex-col gap-2" aria-labelledby="received-invitations-title">
        <h2 id="received-invitations-title" class="text-sm font-semibold text-text-primary">
          <i class="pi pi-envelope mr-1 text-primary-500" aria-hidden="true"></i>
          {{ 'team.received.title' | translate: { count: invitations().length } }}
        </h2>
        <ul class="flex flex-col gap-2">
          @for (inv of invitations(); track inv.memberId) {
            <li class="glass-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div class="min-w-0">
                <p class="text-sm text-text-primary">
                  {{ 'team.received.line' | translate: { name: inv.invitedBy.displayName || inv.invitedBy.email || '', project: inv.projectName } }}
                </p>
                <app-access-summary [permissions]="inv.permissions" />
              </div>
              <div class="flex shrink-0 gap-2">
                <button type="button" class="button-ghost button-sm" [disabled]="busy() === inv.memberId" (click)="answer(inv, false)">
                  {{ 'team.invitation.decline' | translate }}
                </button>
                <button type="button" class="inner-button button-sm" [disabled]="busy() === inv.memberId" (click)="answer(inv, true)">
                  @if (busy() === inv.memberId) {
                    <idem-loader size="xs" />
                  }
                  <span>{{ 'team.invitation.accept' | translate }}</span>
                </button>
              </div>
            </li>
          }
        </ul>
      </section>
    }
  `,
})
export class ReceivedInvitationsComponent implements OnInit {
  private readonly teamService = inject(TeamService);
  private readonly notifications = inject(NotificationService);
  private readonly translate = inject(TranslateService);

  /** Une invitation acceptée : la liste des projets doit se recharger. */
  readonly joined = output<string>();

  protected readonly invitations = signal<PendingInvitation[]>([]);
  protected readonly busy = signal<string | null>(null);

  ngOnInit(): void {
    // Silencieux en cas d'échec : la liste des projets reste l'essentiel de la page.
    this.teamService.myInvitations().subscribe({ next: (list) => this.invitations.set(list), error: () => undefined });
  }

  protected answer(inv: PendingInvitation, accept: boolean): void {
    this.busy.set(inv.memberId);
    this.teamService.answer({ memberId: inv.memberId }, accept).subscribe({
      next: () => {
        this.busy.set(null);
        this.invitations.update((list) => list.filter((item) => item.memberId !== inv.memberId));
        if (accept) {
          this.notifications.showSuccess({
            title: this.translate.instant('team.received.joinedTitle'),
            message: this.translate.instant('team.received.joinedBody', { project: inv.projectName }),
          });
          this.joined.emit(inv.projectId);
        }
      },
      error: () => {
        this.busy.set(null);
        this.notifications.showError({
          title: this.translate.instant('team.errors.title'),
          message: this.translate.instant('team.errors.generic'),
        });
      },
    });
  }
}
