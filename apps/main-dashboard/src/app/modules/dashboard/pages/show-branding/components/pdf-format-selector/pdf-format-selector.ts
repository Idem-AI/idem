import { Component, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

export type PdfFormat = 'A4_PORTRAIT' | 'SLIDE_16_9';

@Component({
  selector: 'app-pdf-format-selector',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  template: `
    <div class="glass-card p-6 mb-6">
      <h3 class="text-lg font-semibold text-white mb-4">
        {{ 'dashboard.showBranding.formatSelector.title' | translate }}
      </h3>
      <p class="text-gray-400 text-sm mb-6">
        {{ 'dashboard.showBranding.formatSelector.description' | translate }}
      </p>
      
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <!-- A4 Portrait Option -->
        <button
          (click)="selectFormat('A4_PORTRAIT')"
          [ngClass]="{
            'border-primary ring-2 ring-primary/30 bg-primary/10': selectedFormat() === 'A4_PORTRAIT',
            'border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20': selectedFormat() !== 'A4_PORTRAIT'
          }"
          class="relative p-6 rounded-lg border-2 transition-all duration-300 text-left group"
        >
          <!-- Icon -->
          <div class="flex items-center justify-center mb-4">
            <svg class="w-16 h-20 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="3" width="12" height="18" rx="1" stroke-width="1.5"/>
              <line x1="9" y1="7" x2="15" y2="7" stroke-width="1.5" stroke-linecap="round"/>
              <line x1="9" y1="11" x2="15" y2="11" stroke-width="1.5" stroke-linecap="round"/>
              <line x1="9" y1="15" x2="12" y2="15" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </div>
          
          <!-- Title & Description -->
          <div class="text-center">
            <h4 class="text-white font-semibold mb-2">
              {{ 'dashboard.showBranding.formatSelector.a4Portrait.title' | translate }}
            </h4>
            <p class="text-gray-400 text-sm mb-2">210mm × 297mm</p>
            <p class="text-gray-500 text-xs">
              {{ 'dashboard.showBranding.formatSelector.a4Portrait.description' | translate }}
            </p>
          </div>
          
          <!-- Selected Indicator -->
          @if (selectedFormat() === 'A4_PORTRAIT') {
            <div class="absolute top-3 right-3">
              <svg class="w-6 h-6 text-primary" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
              </svg>
            </div>
          }
        </button>

        <!-- Landscape 16:9 Option -->
        <button
          (click)="selectFormat('SLIDE_16_9')"
          [ngClass]="{
            'border-primary ring-2 ring-primary/30 bg-primary/10': selectedFormat() === 'SLIDE_16_9',
            'border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20': selectedFormat() !== 'SLIDE_16_9'
          }"
          class="relative p-6 rounded-lg border-2 transition-all duration-300 text-left group"
        >
          <!-- Icon -->
          <div class="flex items-center justify-center mb-4">
            <svg class="w-20 h-16 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <rect x="3" y="6" width="18" height="12" rx="1" stroke-width="1.5"/>
              <line x1="7" y1="10" x2="17" y2="10" stroke-width="1.5" stroke-linecap="round"/>
              <line x1="7" y1="14" x2="14" y2="14" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </div>
          
          <!-- Title & Description -->
          <div class="text-center">
            <h4 class="text-white font-semibold mb-2">
              {{ 'dashboard.showBranding.formatSelector.landscape.title' | translate }}
            </h4>
            <p class="text-gray-400 text-sm mb-2">297mm × 167mm</p>
            <p class="text-gray-500 text-xs">
              {{ 'dashboard.showBranding.formatSelector.landscape.description' | translate }}
            </p>
          </div>
          
          <!-- Selected Indicator -->
          @if (selectedFormat() === 'SLIDE_16_9') {
            <div class="absolute top-3 right-3">
              <svg class="w-6 h-6 text-primary" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
              </svg>
            </div>
          }
        </button>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
  `]
})
export class PdfFormatSelectorComponent {
  protected readonly selectedFormat = signal<PdfFormat>('SLIDE_16_9');
  readonly formatSelected = output<PdfFormat>();

  protected selectFormat(format: PdfFormat): void {
    this.selectedFormat.set(format);
    this.formatSelected.emit(format);
  }
}
