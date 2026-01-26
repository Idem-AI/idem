import { Component } from '@angular/core';
import { environment } from '../../../../../environments/environment';

@Component({
  selector: 'app-cta-section',
  standalone: true,
  imports: [],
  templateUrl: './cta-section.html',
  styleUrl: './cta-section.css',
})
export class CtaSection {
  protected dashboardUrl = environment.services.dashboard.url;
}
