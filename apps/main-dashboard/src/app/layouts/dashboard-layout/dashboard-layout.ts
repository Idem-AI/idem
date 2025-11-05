import { Component, signal, inject, HostListener } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SidebarDashboard } from '../../modules/dashboard/components/sidebar-dashboard/sidebar-dashboard';
import { LanguageSelectorComponent } from '../../shared/components/language-selector/language-selector';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';

@Component({
  selector: 'app-dashboard-layout',
  standalone: true,
  imports: [RouterOutlet, SidebarDashboard, CommonModule, LanguageSelectorComponent],
  templateUrl: './dashboard-layout.html',
  styleUrl: './dashboard-layout.css',
})
export class DashboardLayoutComponent {
  protected readonly isSidebarCollapsed = signal(false);

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
