import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import { ReceivedInvitationView } from '@idem/shared-models';
import { CurrentProjectService } from '../../../../shared/services/current-project.service';
import { PalaverTreeIllustrationComponent } from '../../../../shared/components/palaver-tree-illustration/palaver-tree-illustration';
import { AccessSummaryComponent } from '../../components/access-summary/access-summary';
import { TeamService } from '../../services/team.service';

/**
 * La page du lien reçu par e-mail : « Awa vous invite sur le projet X ».
 *
 * Rien ne s'accepte en ouvrant le lien — les messageries ouvrent parfois les
 * liens d'elles-mêmes pour les analyser. La personne voit ce qu'on lui ouvre,
 * puis choisit. Le bouton qu'elle a cliqué dans l'e-mail est mis en avant.
 */
@Component({
  selector: 'app-invitation-page',
  imports: [TranslateModule, RouterLink, IdemLoaderComponent, PalaverTreeIllustrationComponent, AccessSummaryComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="mx-auto flex min-h-[70vh] w-full max-w-lg flex-col items-center justify-center gap-6 p-6 text-center">
      @if (loading()) {
        <idem-loader block [label]="'team.invitation.loading' | translate" />
      } @else if (errorCode(); as code) {
        <app-palaver-tree-illustration class="h-28 w-36 text-text-tertiary" />
        <h1 class="text-xl font-bold text-text-primary">{{ 'team.invitation.errorTitle' | translate }}</h1>
        <p class="text-sm text-text-secondary">{{ 'team.errors.' + code | translate }}</p>
        <a routerLink="/projects" class="outer-button">{{ 'team.invitation.toProjects' | translate }}</a>
      } @else if (invitation(); as inv) {
        <app-palaver-tree-illustration class="h-28 w-36 text-text-tertiary" />
        <div class="flex flex-col gap-2">
          <h1 class="text-xl font-bold text-text-primary sm:text-2xl">
            {{ 'team.invitation.title' | translate: { project: inv.projectName } }}
          </h1>
          <p class="text-sm text-text-secondary">
            {{ 'team.invitation.from' | translate: { name: inv.invitedBy.displayName || inv.invitedBy.email || '' } }}
          </p>
        </div>

        @if (inv.status === 'pending') {
          <div class="glass-card w-full p-4 text-left">
            <p class="mb-2 text-sm font-medium text-text-primary">{{ 'team.invitation.accessLabel' | translate }}</p>
            <app-access-summary [permissions]="inv.permissions" />
          </div>
          <div class="flex w-full flex-col-reverse gap-3 sm:flex-row sm:justify-center">
            <button
              type="button"
              [class]="intent() === 'decline' ? 'inner-button' : 'button-ghost'"
              [disabled]="answering()"
              (click)="answer(false)"
            >
              {{ 'team.invitation.decline' | translate }}
            </button>
            <button
              type="button"
              [class]="intent() === 'decline' ? 'outer-button' : 'inner-button'"
              [disabled]="answering()"
              (click)="answer(true)"
            >
              @if (answering()) {
                <idem-loader size="xs" />
              }
              <span>{{ 'team.invitation.accept' | translate }}</span>
            </button>
          </div>
        } @else if (inv.status === 'declined') {
          <p class="text-sm text-text-secondary">{{ 'team.invitation.declinedDone' | translate }}</p>
          <a routerLink="/projects" class="outer-button">{{ 'team.invitation.toProjects' | translate }}</a>
        } @else if (inv.status === 'active') {
          <button type="button" class="inner-button" (click)="open(inv.projectId)">{{ 'team.invitation.open' | translate }}</button>
        } @else {
          <p class="text-sm text-text-secondary">{{ 'team.errors.invitation_expired' | translate }}</p>
          <a routerLink="/projects" class="outer-button">{{ 'team.invitation.toProjects' | translate }}</a>
        }
      }
    </main>
  `,
})
export class InvitationPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly teamService = inject(TeamService);
  private readonly projects = inject(CurrentProjectService);

  protected readonly loading = signal(true);
  protected readonly answering = signal(false);
  protected readonly invitation = signal<ReceivedInvitationView | null>(null);
  protected readonly errorCode = signal<string | null>(null);
  protected readonly intent = signal<'accept' | 'decline'>('accept');

  private token = '';

  ngOnInit(): void {
    this.token = this.route.snapshot.paramMap.get('token') ?? '';
    if (this.route.snapshot.queryParamMap.get('action') === 'decline') this.intent.set('decline');
    this.teamService.invitation(this.token).subscribe({
      next: (invitation) => {
        this.invitation.set(invitation);
        this.loading.set(false);
      },
      error: (error) => {
        this.errorCode.set(this.known(TeamService.errorCode(error)));
        this.loading.set(false);
      },
    });
  }

  private known(code: string): string {
    return ['invitation_not_found', 'invitation_expired', 'invitation_wrong_account'].includes(code) ? code : 'generic';
  }

  protected answer(accept: boolean): void {
    this.answering.set(true);
    this.teamService.answer({ token: this.token }, accept).subscribe({
      next: ({ projectId }) => {
        this.answering.set(false);
        if (accept) {
          void this.open(projectId);
        } else {
          this.invitation.update((inv) => (inv ? { ...inv, status: 'declined' } : inv));
        }
      },
      error: (error) => {
        this.answering.set(false);
        this.errorCode.set(this.known(TeamService.errorCode(error)));
      },
    });
  }

  /** Ouvre le projet rejoint : la liste est rechargée pour qu'il y figure. */
  protected async open(projectId: string): Promise<void> {
    try {
      await firstValueFrom(this.projects.load(true));
    } catch {
      // La liste se rechargera sur la page suivante.
    }
    this.projects.select(projectId, { navigate: false });
    await this.router.navigate(['/project/dashboard']);
  }
}
