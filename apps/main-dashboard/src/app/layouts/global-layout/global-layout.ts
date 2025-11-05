import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SidebarGlobal } from '../../modules/dashboard/components/sidebar-global/sidebar-global';
import { LanguageSelectorComponent } from '../../shared/components/language-selector/language-selector';

@Component({
  selector: 'app-global-layout',
  standalone: true,
  imports: [RouterOutlet, SidebarGlobal, CommonModule, LanguageSelectorComponent],
  templateUrl: './global-layout.html',
  styleUrl: './global-layout.css',
})
export class GlobalLayoutComponent {
  protected readonly isSidebarCollapsed = signal(false);

  constructor() {
    // Initialize with saved sidebar state from localStorage
    const savedSidebarState = localStorage.getItem('globalSidebarCollapsed');
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
