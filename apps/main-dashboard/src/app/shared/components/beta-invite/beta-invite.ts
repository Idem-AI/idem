import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  PLATFORM_ID,
  inject,
  viewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { NavigationEnd, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule } from '@ngx-translate/core';
import { distinctUntilChanged, filter, firstValueFrom, map, startWith } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../modules/auth/services/auth.service';
import { BillingService } from '../../../modules/billing/services/billing.service';

/** Mémorisé sur le compte (`/auth/tours`) : l'invitation n'est montrée qu'une fois. */
const INVITE_ID = 'main-dashboard:beta-premium-invite';

/**
 * Invitation au programme bêta premium, montrée une seule fois par compte,
 * juste après la première connexion.
 *
 * Rien n'est proposé à un compte qui bénéficie déjà de la bêta (abonnement
 * offert), ni sur l'écran de connexion lui-même. Le « déjà vu » est gardé sur
 * le compte et non dans le navigateur : changer d'appareil ne la rejoue pas.
 * Une panne réseau s'abstient plutôt que d'insister.
 */
@Component({
  selector: 'app-beta-invite',
  imports: [TranslateModule],
  templateUrl: './beta-invite.html',
  styleUrl: './beta-invite.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BetaInviteComponent {
  private readonly auth = inject(AuthService);
  private readonly billing = inject(BillingService);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly toursUrl = `${environment.services.api.url}/auth/tours`;

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private checkedFor: string | null = null;

  protected readonly formUrl = environment.betaProgramUrl;

  constructor() {
    if (!isPlatformBrowser(inject(PLATFORM_ID))) return;

    this.auth.user$
      .pipe(
        map((user) => user?.uid ?? null),
        distinctUntilChanged(),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe((uid) => {
        if (uid) void this.consider(uid);
        else this.checkedFor = null;
      });
  }

  private async consider(uid: string): Promise<void> {
    if (this.checkedFor === uid) return;
    this.checkedFor = uid;

    try {
      const { toursSeen } = await firstValueFrom(
        this.http.get<{ toursSeen: string[] }>(this.toursUrl, { withCredentials: true }),
      );
      if (toursSeen?.includes(INVITE_ID)) return;
    } catch {
      return;
    }

    await firstValueFrom(this.billing.loadMe());
    if (this.billing.betaActive()) return;

    // Pas par-dessus l'écran de connexion : on attend d'en être sorti.
    await firstValueFrom(
      this.router.events.pipe(
        filter((event) => event instanceof NavigationEnd),
        startWith(null),
        map(() => this.router.url),
        filter((url) => !url.startsWith('/login')),
      ),
    );

    // L'utilisateur a pu se déconnecter entre-temps.
    if (this.checkedFor !== uid) return;
    const dialog = this.dialog().nativeElement;
    if (!dialog.open) dialog.showModal();
  }

  /** Ouvre le formulaire dans un nouvel onglet, puis referme l'invitation. */
  protected join(): void {
    window.open(this.formUrl, '_blank', 'noopener');
    this.dialog().nativeElement.close();
  }

  protected later(): void {
    this.dialog().nativeElement.close();
  }

  /** Toute fermeture (bouton, Échap) vaut « vu » : on ne la rejoue pas. */
  protected onClose(): void {
    void firstValueFrom(
      this.http.post(this.toursUrl, { tourId: INVITE_ID }, { withCredentials: true }),
    ).catch(() => undefined);
  }

  /** Un clic sur le voile, hors du panneau, referme aussi. */
  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement) this.later();
  }
}
