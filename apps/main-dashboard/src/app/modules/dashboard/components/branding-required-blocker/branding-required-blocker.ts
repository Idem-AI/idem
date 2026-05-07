import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-branding-required-blocker',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslateModule],
  templateUrl: './branding-required-blocker.html',
  styleUrl: './branding-required-blocker.css',
})
export class BrandingRequiredBlockerComponent {
  missingElements = input<string[]>([]);
  featureName = input<string>('cette fonctionnalité');

  constructor(private router: Router) {}

  protected onCompleteBranding(): void {
    this.router.navigate(['/console/project/branding']);
  }

  protected onBackToDashboard(): void {
    this.router.navigate(['/console/project/dashboard']);
  }
}
