import { NgOptimizedImage } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { environment } from '@env';

import { AuthService } from '../../core/auth';
import { LanguageService, SupportedLanguage } from '../../core/i18n/language.service';
import { ResolvedTheme, ThemeService } from '../../core/theme/theme.service';
import { SimulationStore } from '../../features/simulations/data-access';
import { LinkedProject } from '../../features/simulations/models';
import { LanguageMenu } from '../../shared/components/language-menu/language-menu';
import { ThemeToggle } from '../../shared/components/theme-toggle/theme-toggle';

/**
 * Barre supérieure, commune à toutes les coquilles.
 *
 * Elle porte l'identité — le logo IDEM et le nom du produit à gauche, le compte
 * à droite — et rien d'autre que ce que l'écran courant lui demande d'afficher.
 * L'écran d'accueil s'ouvre sans navigation latérale : la barre doit donc tenir
 * seule, y compris pour un visiteur sans compte.
 */
@Component({
  selector: 'sim-topbar',
  imports: [RouterLink, TranslatePipe, NgOptimizedImage, ThemeToggle, LanguageMenu],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'closeMenus()',
  },
  templateUrl: './topbar.html',
})
export class Topbar {
  private readonly auth = inject(AuthService);
  private readonly store = inject(SimulationStore);
  private readonly router = inject(Router);
  private readonly themeService = inject(ThemeService);
  private readonly languageService = inject(LanguageService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Bouton de navigation : absent des écrans qui n'ont pas de colonne. */
  readonly navToggleVisible = input(false);
  /** Sélecteur de projet : absent tant qu'aucun écran n'en dépend. */
  readonly projectPickerVisible = input(false);
  readonly navCollapsed = input(false);

  readonly navToggle = output<void>();

  protected readonly dashboardUrl = environment.services.dashboard.url;
  protected readonly user = this.auth.user;
  protected readonly authenticated = this.auth.isAuthenticated;
  protected readonly projects = this.store.projects;
  protected readonly activeProject = this.store.project;

  protected readonly theme = this.themeService.theme;
  /** Deux états seulement, comme `ThemeToggle` : « système » reste le défaut
      stocké, mais n'a pas d'affordance visible. */
  protected readonly themes: readonly ResolvedTheme[] = ['light', 'dark'];
  protected readonly language = this.languageService.language;
  protected readonly languages = this.languageService.available;

  /** Le logo est blanc : il doit être inversé sur fond clair. */
  protected readonly onLightTheme = computed(() => this.theme() === 'light');

  protected readonly accountMenuOpen = signal(false);
  protected readonly projectMenuOpen = signal(false);

  protected readonly initials = computed(() => {
    const user = this.user();
    const source = user?.displayName || user?.email || '';
    const parts = source.split(/[\s.@]+/).filter(Boolean);
    return (parts[0]?.[0] ?? '?').concat(parts[1]?.[0] ?? '').toUpperCase();
  });

  /**
   * Thème et langue depuis le menu du compte : sur mobile la barre n'a plus la
   * place de porter leurs deux boutons, ils vivent donc ici. Le menu reste
   * ouvert — le changement se voit à l'écran, le refermer le cacherait.
   */
  protected chooseTheme(theme: ResolvedTheme): void {
    this.themeService.set(theme);
  }

  protected chooseLanguage(language: SupportedLanguage): void {
    this.languageService.use(language);
  }

  protected chooseProject(project: LinkedProject): void {
    this.projectMenuOpen.set(false);
    this.store.selectProject(project.id);
    void this.router.navigate(['/simulations']);
  }

  /** La déconnexion vaut pour tout IDEM : `AuthService` renvoie au login central. */
  protected async signOut(): Promise<void> {
    this.closeMenus();
    await this.auth.signOut();
  }

  /** Connexion depuis la barre : on revient sur l'écran courant. */
  protected signIn(): void {
    this.closeMenus();
    this.auth.redirectToLogin(this.router.url, { force: true });
  }

  protected closeMenus(): void {
    this.accountMenuOpen.set(false);
    this.projectMenuOpen.set(false);
  }

  protected onDocumentClick(event: MouseEvent): void {
    if (!this.accountMenuOpen() && !this.projectMenuOpen()) {
      return;
    }
    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.closeMenus();
    }
  }
}
