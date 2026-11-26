import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  LOCALE_ID,
  PLATFORM_ID,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { trigger, transition, style, animate } from '@angular/animations';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { environment } from '../../../environments/environment';
import { isSupportedLocale, writeLocaleCookie } from '../../shared/utils/locale-cookie';

/**
 * La barre de navigation : une pilule centrée qui flotte au-dessus de la page,
 * pour que le fond du héros occupe tout l'écran derrière elle. Une seule
 * action à droite, « Essayer gratuitement » : la connexion, le tableau de bord
 * et GitHub ne sont plus dans la barre (la création de projet mène à la
 * connexion quand il le faut).
 */
@Component({
  selector: 'app-header',
  imports: [RouterLinkActive, RouterLink],
  templateUrl: './header.html',
  styleUrl: './header.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(window:scroll)': 'onScroll()',
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'closeAll()',
  },
  animations: [
    trigger('slideInOut', [
      transition(':enter', [
        style({ transform: 'translateX(-100%)', opacity: 0 }),
        animate('360ms cubic-bezier(0.22, 1, 0.36, 1)', style({ transform: 'translateX(0)', opacity: 1 })),
      ]),
      transition(':leave', [
        animate('260ms cubic-bezier(0.55, 0.055, 0.675, 0.19)', style({ transform: 'translateX(-100%)', opacity: 0 })),
      ]),
    ]),
    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(-4px)' }),
        animate('200ms cubic-bezier(0.22, 1, 0.36, 1)', style({ opacity: 1, transform: 'translateY(0)' })),
      ]),
      transition(':leave', [animate('150ms ease-in', style({ opacity: 0 }))]),
    ]),
  ],
})
export class Header {
  private readonly document = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly locale = inject(LOCALE_ID);

  protected readonly dashboardUrl = environment.services.dashboard.url;

  protected readonly isMenuOpen = signal(false);
  protected readonly activeDropdown = signal<string | null>(null);
  /** La page a quitté son tout début : la pilule prend une surface plus nette. */
  protected readonly scrolled = signal(false);

  private readonly menuRef = viewChild<ElementRef<HTMLElement>>('menu');

  // L'accueil n'a plus d'entrée : le logo y mène.
  protected readonly navItems: Array<{
    id: string;
    label: string;
    route?: string;
    type: 'link' | 'dropdown';
    badge?: string;
    items?: Array<{ label: string; route: string }>;
  }> = [
    {
      id: 'product',
      label: $localize`:@@header.menu.product:Product`,
      type: 'dropdown',
      // Les cinq services, dans l'ordre du parcours IDEM (`WORKFLOW` de
      // `@idem/shared-seo`) : on éprouve l'idée, on écrit l'application, on la
      // met en ligne, on lui donne son nom, puis on la fait connaître.
      items: [
        { label: 'iSimulator', route: '/simulator' },
        { label: 'iCode', route: '/idev' },
        { label: 'iDeploy', route: '/ideploy' },
        { label: 'iDomain', route: '/idomain' },
        { label: 'iVision', route: '/ivision' },
      ],
    },
    {
      // Les tarifs sont ce que cherche un visiteur décidé : un lien direct, pas un menu à ouvrir.
      id: 'pricing',
      label: $localize`:@@header.menu.pricing:Pricing`,
      route: '/pricing',
      type: 'link',
    },
    {
      // Idem Builders est mis en avant au premier niveau, badge compris.
      // Retirer le badge quand le programme n'est plus une nouveauté.
      id: 'builders',
      label: 'Idem Builders',
      route: '/builders',
      type: 'link',
      badge: $localize`:@@header.badge.new:New`,
    },
    {
      id: 'company',
      label: $localize`:@@header.menu.company:Company`,
      type: 'dropdown',
      items: [
        { label: $localize`:@@header.menu.vision:Vision`, route: '/african-market' },
        { label: $localize`:@@header.menu.openSource:Open Source`, route: '/open-source' },
        { label: $localize`:@@header.menu.about:About`, route: '/about' },
      ],
    },
    {
      id: 'blog',
      label: $localize`:@@header.menu.blog:Blog`,
      route: '/blog',
      type: 'link',
    },
    {
      id: 'contact',
      label: $localize`:@@header.nav.contact:Contact`,
      route: '/contact',
      type: 'link',
    },
  ];

  protected onScroll(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const past = window.scrollY > 12;
    if (past !== this.scrolled()) this.scrolled.set(past);
  }

  protected toggleMenu(): void {
    this.isMenuOpen.update((open) => !open);
  }

  protected toggleMenuDropdown(groupName: string): void {
    this.activeDropdown.update((current) => (current === groupName ? null : groupName));
  }

  protected closeAllDropdowns(): void {
    this.activeDropdown.set(null);
  }

  protected closeAll(): void {
    this.activeDropdown.set(null);
    this.isMenuOpen.set(false);
  }

  /** Un clic hors de la barre ferme ses menus ; hors du tiroir, le tiroir. */
  protected onDocumentClick(event: Event): void {
    const target = event.target as Node | null;
    if (!target) return;
    if (this.activeDropdown() && !this.host.nativeElement.querySelector('.nav-pill')?.contains(target)) {
      this.activeDropdown.set(null);
    }
    const menu = this.menuRef()?.nativeElement;
    const burger = this.host.nativeElement.querySelector('.nav-burger');
    if (this.isMenuOpen() && menu && !menu.contains(target) && !burger?.contains(target)) {
      this.isMenuOpen.set(false);
    }
  }

  /** Change de langue : le cookie partagé fait foi, l'URL suit (/fr, /en). */
  protected switchLanguage(targetLang: string): void {
    if (this.locale === targetLang) return;

    if (isSupportedLocale(targetLang)) {
      writeLocaleCookie(targetLang);
    }
    localStorage.setItem('idem_lang', targetLang);

    const pathname = this.document.location.pathname;
    let newPath: string;
    if (pathname.startsWith('/fr/') || pathname === '/fr') {
      newPath = pathname.replace(/^\/fr(\/|$)/, `/${targetLang}$1`);
    } else if (pathname.startsWith('/en/') || pathname === '/en') {
      newPath = pathname.replace(/^\/en(\/|$)/, `/${targetLang}$1`);
    } else {
      newPath = `/${targetLang}${pathname.startsWith('/') ? pathname : '/' + pathname}`;
    }
    this.document.location.href = `${this.document.location.origin}${newPath}`;
  }
}
