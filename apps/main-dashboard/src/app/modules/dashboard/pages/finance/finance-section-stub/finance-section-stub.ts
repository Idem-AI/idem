import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { CookieService } from '../../../../../shared/services/cookie.service';
import { FinanceService } from '../../../services/finance.service';
import { FINANCE_SECTIONS, FinanceModel } from '../../../models/finance.model';
import { AiFillButtonComponent } from '../../../components/ai-fill-button/ai-fill-button';

/**
 * Page placeholder pour chaque sous-section du module Finance.
 * Affiche un en-tête cohérent avec bouton "Remplir avec l'IA" et un message
 * indiquant que la section sera implémentée dans la prochaine phase.
 *
 * La clé de la section est passée via le routeur (data.sectionKey).
 */
@Component({
  selector: 'app-finance-section-stub',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslateModule, AiFillButtonComponent],
  templateUrl: './finance-section-stub.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FinanceSectionStubComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly cookieService = inject(CookieService);
  private readonly financeService = inject(FinanceService);
  private readonly translate = inject(TranslateService);

  protected readonly sectionKey = signal<string>('');
  protected readonly finance = signal<FinanceModel | null>(null);
  protected readonly isLoading = signal<boolean>(true);
  protected readonly aiLoading = signal<boolean>(false);

  protected readonly descriptor = computed(() => {
    const key = this.sectionKey();
    return FINANCE_SECTIONS.find((s) => s.key === key);
  });

  ngOnInit(): void {
    const sectionKey = this.route.snapshot.data['sectionKey'] as string;
    this.sectionKey.set(sectionKey || 'overview');

    const projectId = this.cookieService.get('projectId');
    if (!projectId) {
      this.router.navigate(['/projects']);
      return;
    }
    this.isLoading.set(true);
    this.financeService.getFinance(projectId).subscribe({
      next: (f) => {
        this.finance.set(f);
        this.isLoading.set(false);
      },
      error: (err) => {
        if (err?.status !== 404) {
          console.error('[FinanceSectionStub] load failed', err);
        }
        this.finance.set(null);
        this.isLoading.set(false);
      },
    });
  }

  protected onAutoFill(): void {
    this.aiLoading.set(true);
    // TODO Phase 3: appeler l'endpoint IA pour cette section précise.
    setTimeout(() => {
      this.aiLoading.set(false);
      // recharger
      const projectId = this.cookieService.get('projectId');
      if (projectId) {
        this.financeService.getFinance(projectId).subscribe({
          next: (f) => this.finance.set(f),
        });
      }
    }, 1200);
  }
}
