import { Component, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';

type AdminTabType = 'logo' | 'brand' | 'business' | 'legal';
type TechTabType = 'webapp' | 'deployment' | 'documentation';

@Component({
  selector: 'app-features',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './features.html',
  styleUrl: './features.css',
})
export class Features implements OnInit, OnDestroy {
  protected readonly activeAdminTab = signal<AdminTabType>('logo');
  protected readonly activeTechTab = signal<TechTabType>('webapp');

  private adminIntervalId?: number;
  private techIntervalId?: number;

  private adminAutoRotationStopped = false;
  private techAutoRotationStopped = false;

  private readonly adminTabs: AdminTabType[] = ['logo', 'brand', 'business', 'legal'];
  private readonly techTabs: TechTabType[] = ['webapp', 'deployment', 'documentation'];

  ngOnInit(): void {
    this.startAdminAutoRotation();
    this.startTechAutoRotation();
  }

  ngOnDestroy(): void {
    if (this.adminIntervalId) {
      clearInterval(this.adminIntervalId);
    }
    if (this.techIntervalId) {
      clearInterval(this.techIntervalId);
    }
  }

  private startAdminAutoRotation(): void {
    if (this.adminAutoRotationStopped) return;

    this.adminIntervalId = window.setInterval(() => {
      if (this.adminAutoRotationStopped) {
        if (this.adminIntervalId) {
          clearInterval(this.adminIntervalId);
        }
        return;
      }
      const currentIndex = this.adminTabs.indexOf(this.activeAdminTab());
      const nextIndex = (currentIndex + 1) % this.adminTabs.length;
      this.activeAdminTab.set(this.adminTabs[nextIndex]);
    }, 5000);
  }

  private startTechAutoRotation(): void {
    if (this.techAutoRotationStopped) return;

    this.techIntervalId = window.setInterval(() => {
      if (this.techAutoRotationStopped) {
        if (this.techIntervalId) {
          clearInterval(this.techIntervalId);
        }
        return;
      }
      const currentIndex = this.techTabs.indexOf(this.activeTechTab());
      const nextIndex = (currentIndex + 1) % this.techTabs.length;
      this.activeTechTab.set(this.techTabs[nextIndex]);
    }, 5000);
  }

  protected setActiveAdminTab(tab: AdminTabType): void {
    this.activeAdminTab.set(tab);
    this.adminAutoRotationStopped = true;
    if (this.adminIntervalId) {
      clearInterval(this.adminIntervalId);
      this.adminIntervalId = undefined;
    }
  }

  protected setActiveTechTab(tab: TechTabType): void {
    this.activeTechTab.set(tab);
    this.techAutoRotationStopped = true;
    if (this.techIntervalId) {
      clearInterval(this.techIntervalId);
      this.techIntervalId = undefined;
    }
  }
}
