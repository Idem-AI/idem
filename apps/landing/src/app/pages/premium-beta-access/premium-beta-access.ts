import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-premium-beta-access',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './premium-beta-access.html',
  styleUrl: './premium-beta-access.css',
})
export class PremiumBetaAccess {
  // Services

  // State signals
  protected readonly waitlistFormUrl = signal(
    environment.waitlistUrl || 'https://forms.gle/YourGoogleFormUrlHere',
  );

  // Methods
  protected openWaitlistForm(): void {
    window.open(this.waitlistFormUrl(), '_blank');
  }
}
