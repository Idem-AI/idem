import { Component, ChangeDetectionStrategy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-beta-badge',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (isBeta == true) {
      <div
        class="inline-flex items-center py-1 px-2 rounded-full text-xs font-medium bg-gradient-to-r glass"
      >
        <div class="flex items-center">
          <!-- Icône pulse -->
          <span class="relative flex h-2 w-2 mr-2">
            <span
              class="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"
            ></span>
            <span class="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
          </span>

          <!-- Texte BETA -->
          <span class="font-bold tracking-wider text-white">Beta</span>
        </div>
      </div>
    }
  `,
})
export class BetaBadgeComponent implements OnInit {
  protected isBeta = true;

  ngOnInit(): void {
    this.isBeta = environment.isBeta;
  }
}
