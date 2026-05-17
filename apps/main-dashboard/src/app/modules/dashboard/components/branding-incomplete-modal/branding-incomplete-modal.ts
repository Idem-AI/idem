import { Component, output, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-branding-incomplete-modal',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './branding-incomplete-modal.html',
  styleUrl: './branding-incomplete-modal.css',
})
export class BrandingIncompleteModalComponent {
  missingElements = input<string[]>([]);
  close = output<void>();

  constructor(private router: Router) {}

  protected onClose(): void {
    this.close.emit();
  }

  protected onCompleteBranding(): void {
    this.close.emit();
    this.router.navigate(['/console/project/branding']);
  }
}
