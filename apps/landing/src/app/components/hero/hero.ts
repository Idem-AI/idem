import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { environment } from '../../../environments/environment';
import { TrustedByComponent } from '@idem/shared-trusted-by/angular';

@Component({
  selector: 'app-hero',
  standalone: true,
  imports: [CommonModule, TrustedByComponent],
  templateUrl: './hero.html',
  styleUrl: './hero.css',
})
export class Hero {
  protected mouseX = signal(0);
  protected mouseY = signal(0);
  protected scrollY = signal(0);
  protected isInViewport = signal(true);
  protected spotlightX = signal(0);
  protected spotlightY = signal(0);
  protected dashboardUrl = environment.services.dashboard.url;
}
