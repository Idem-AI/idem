import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface LegalSection {
  id: string;
  title: string;
  titleI18n: string;
  content?: string;
  contentI18n?: string;
  /**
   * Les paragraphes qui suivent `content`.
   *
   * Un texte juridique sérieux ne tient pas en une phrase : sans cela, chaque
   * section devait soit mentir par omission, soit entasser quatre idées dans
   * un seul paragraphe illisible.
   */
  paragraphs?: string[];
  subsections?: LegalSubsection[];
  list?: LegalListItem[];
  table?: LegalTable;
  warning?: LegalWarning;
}

/** Un tableau : durées de conservation, sous-traitants, pays. */
export interface LegalTable {
  /** Intitulé lu par les lecteurs d'écran et affiché au-dessus du tableau. */
  caption?: string;
  headers: string[];
  rows: string[][];
}

export interface LegalSubsection {
  title: string;
  titleI18n: string;
  content: string;
  contentI18n: string;
  paragraphs?: string[];
  list?: LegalListItem[];
  table?: LegalTable;
}

export interface LegalListItem {
  text: string;
  textI18n: string;
  strong?: string;
  strongI18n?: string;
  /** Un lien en fin de puce, quand la puce renvoie à un autre texte. */
  link?: { label: string; href: string };
}

export interface LegalWarning {
  type: 'info' | 'warning' | 'error';
  title: string;
  titleI18n: string;
  content: string;
  contentI18n: string;
  icon?: string;
}

export interface LegalNavItem {
  id: string;
  title: string;
  titleI18n: string;
  children?: LegalNavItem[];
}

@Component({
  selector: 'app-legal-document-template',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './legal-document-template.html',
  styleUrl: './legal-document-template.css',
})
export class LegalDocumentTemplate {
  @Input() title: string = '';
  @Input() titleI18n: string = '';
  @Input() subtitle: string = '';
  @Input() subtitleI18n: string = '';
  @Input() effectiveDate: string = '';
  @Input() effectiveDateI18n: string = '';
  @Input() sections: LegalSection[] = [];
  @Input() navigation: LegalNavItem[] = [];
  @Input() showVersionSelector: boolean = false;
  @Input() versions: string[] = [];
  @Input() currentVersion: string = '';
  /** Le numéro de version du texte, affiché à côté de sa date d'effet. */
  @Input() version: string = '';
  /** Les textes voisins : le global pour un complément, les compléments pour le global. */
  @Input() related: { label: string; href: string; note?: string }[] = [];
  /** Intitulé du bloc des textes voisins. */
  @Input() relatedTitle: string = '';
  /** Intitulé devant le numéro de version. */
  @Input() versionLabel: string = '';

  protected activeSection: string = '';
  protected showMobileNav: boolean = false;

  scrollToSection(sectionId: string): void {
    this.activeSection = sectionId;
    const element = document.getElementById(sectionId);
    if (element) {
      const offset = 100;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth',
      });
    }
    this.showMobileNav = false;
  }

  toggleMobileNav(): void {
    this.showMobileNav = !this.showMobileNav;
  }

  getWarningClasses(type: string): string {
    switch (type) {
      case 'warning':
        return 'bg-yellow-500/10 border-yellow-600/30 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300';
      case 'error':
        return 'bg-red-500/10 border-red-600/30 text-red-700 dark:bg-red-900/20 dark:text-red-300';
      case 'info':
      default:
        return 'bg-blue-500/10 border-blue-600/30 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300';
    }
  }

  getWarningContentClasses(type: string): string {
    switch (type) {
      case 'warning':
        return 'text-yellow-800 dark:text-yellow-200';
      case 'error':
        return 'text-red-800 dark:text-red-200';
      case 'info':
      default:
        return 'text-blue-800 dark:text-blue-200';
    }
  }
}
