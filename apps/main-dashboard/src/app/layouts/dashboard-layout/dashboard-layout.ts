import { Component, inject, signal } from '@angular/core';
import { JourneyCardComponent } from '@idem/shared-journey/angular';
import { FloatingJourney, JourneyFloatService } from '../../shared/services/journey-float.service';
import { JourneyService } from '../../shared/services/journey.service';
import { LanguageService } from '../../shared/services/language.service';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SidebarDashboard } from '../../modules/dashboard/components/sidebar-dashboard/sidebar-dashboard';
import { GuidedStepBarComponent } from '../../modules/guided/components/guided-step-bar/guided-step-bar';
import { NextStepBarComponent } from '../../modules/guided/components/next-step-bar/next-step-bar';
import { TopbarComponent } from '../../shared/components/topbar/topbar';
import { AppFooterComponent } from '../../shared/components/app-footer/app-footer';

import { PromoBannerComponent } from '@idem/shared-promotions/angular';
import { ReadOnlyNoticeComponent } from '../../modules/team/components/read-only-notice/read-only-notice';
import { ReadOnlyFieldsDirective } from '../../modules/team/directives/read-only-fields.directive';

@Component({
  selector: 'app-dashboard-layout',
  standalone: true,
  imports: [RouterOutlet, SidebarDashboard, CommonModule, GuidedStepBarComponent, NextStepBarComponent, TopbarComponent, PromoBannerComponent, AppFooterComponent, JourneyCardComponent, ReadOnlyNoticeComponent, ReadOnlyFieldsDirective],
  templateUrl: './dashboard-layout.html',
  styleUrl: './dashboard-layout.css',
})
export class DashboardLayoutComponent {
  protected readonly isSidebarCollapsed = signal(false);
  private readonly journeyFloat = inject(JourneyFloatService);
  private readonly language = inject(LanguageService);
  protected readonly journey = inject(JourneyService);
  /** La suite proposée par la boucle IDEM, confiée par la page qui l'affiche (`app-journey-next`). */
  protected readonly floatingJourney = this.journeyFloat.current;
  protected get lang(): string {
    return this.language.getCurrentLanguage();
  }

  protected closeJourney(card: FloatingJourney): void {
    this.journeyFloat.clear(card.recommendation.id);
    card.dismissed();
  }

  constructor() {
    // Initialize with saved sidebar state from localStorage to prevent flicker
    const savedSidebarState = localStorage.getItem('sidebarCollapsed');
    if (savedSidebarState) {
      this.isSidebarCollapsed.set(savedSidebarState === 'true');
    }
  }

  /**
   * Handle sidebar state changes from the sidebar component
   */
  onSidebarCollapsedChange(collapsed: boolean): void {
    this.isSidebarCollapsed.set(collapsed);
  }
}
