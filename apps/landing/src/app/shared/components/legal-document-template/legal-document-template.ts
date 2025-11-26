import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface LegalSection {
  id: string;
  title: string;
  titleI18n: string;
  content?: string;
  contentI18n?: string;
  subsections?: LegalSubsection[];
  list?: LegalListItem[];
  warning?: LegalWarning;
}

export interface LegalSubsection {
  title: string;
  titleI18n: string;
  content: string;
  contentI18n: string;
  list?: LegalListItem[];
}

export interface LegalListItem {
  text: string;
  textI18n: string;
  strong?: string;
  strongI18n?: string;
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
        return 'bg-yellow-900/20 border-yellow-600/30 text-yellow-300';
      case 'error':
        return 'bg-red-900/20 border-red-600/30 text-red-300';
      case 'info':
      default:
        return 'bg-blue-900/20 border-blue-600/30 text-blue-300';
    }
  }

  getWarningContentClasses(type: string): string {
    switch (type) {
      case 'warning':
        return 'text-yellow-200';
      case 'error':
        return 'text-red-200';
      case 'info':
      default:
        return 'text-blue-200';
    }
  }
}
