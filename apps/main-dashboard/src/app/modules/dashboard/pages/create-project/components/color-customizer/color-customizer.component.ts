import { Component, input, output, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ColorModel } from '../../../../models/brand-identity.model';

interface ColorHSL {
  h: number;
  s: number;
  l: number;
}

@Component({
  selector: 'app-color-customizer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './color-customizer.component.html',
  styleUrl: './color-customizer.component.css',
})
export class ColorCustomizerComponent {
  // Inputs
  readonly initialColors = input.required<ColorModel>();

  // Outputs
  readonly colorsUpdated = output<ColorModel>();
  readonly closed = output<void>();

  // State
  protected readonly customColors = signal<ColorModel['colors']>({
    primary: '',
    secondary: '',
    accent: '',
    background: '',
    text: '',
  });

  protected readonly activeColor = signal<keyof ColorModel['colors'] | null>(null);

  // Color keys for iteration
  protected readonly colorKeys: Array<keyof ColorModel['colors']> = [
    'primary',
    'secondary',
    'accent',
    'background',
    'text',
  ];

  constructor() {
    effect(() => {
      const initial = this.initialColors();
      if (initial) {
        this.customColors.set({ ...initial.colors });
      }
    });
  }

  protected selectColor(colorKey: keyof ColorModel['colors']): void {
    this.activeColor.set(colorKey);
  }

  protected updateColor(colorKey: keyof ColorModel['colors'], event: Event): void {
    const target = event.target as HTMLInputElement;
    const newColor = target.value;

    const updatedColors = { ...this.customColors() };
    updatedColors[colorKey] = newColor;

    // Apply intelligent color harmonization
    if (colorKey === 'primary') {
      updatedColors.accent = this.generateAccentColor(newColor);
    } else if (colorKey === 'secondary') {
      updatedColors.background = this.adjustBackgroundForSecondary(newColor);
    } else if (colorKey === 'background') {
      updatedColors.text = this.generateContrastingTextColor(newColor);
    }

    this.customColors.set(updatedColors);
  }

  protected applyColors(): void {
    const original = this.initialColors();
    const updated: ColorModel = {
      ...original,
      colors: this.customColors(),
    };
    this.colorsUpdated.emit(updated);
  }

  protected resetColors(): void {
    const initial = this.initialColors();
    this.customColors.set({ ...initial.colors });
  }

  protected close(): void {
    this.closed.emit();
  }

  // Color harmony algorithms
  private hexToHSL(hex: string): ColorHSL {
    // Remove # if present
    hex = hex.replace('#', '');

    // Convert hex to RGB
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

      switch (max) {
        case r:
          h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
          break;
        case g:
          h = ((b - r) / d + 2) / 6;
          break;
        case b:
          h = ((r - g) / d + 4) / 6;
          break;
      }
    }

    return { h: h * 360, s: s * 100, l: l * 100 };
  }

  private hslToHex(h: number, s: number, l: number): string {
    s = s / 100;
    l = l / 100;

    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;

    let r = 0,
      g = 0,
      b = 0;

    if (h >= 0 && h < 60) {
      r = c;
      g = x;
      b = 0;
    } else if (h >= 60 && h < 120) {
      r = x;
      g = c;
      b = 0;
    } else if (h >= 120 && h < 180) {
      r = 0;
      g = c;
      b = x;
    } else if (h >= 180 && h < 240) {
      r = 0;
      g = x;
      b = c;
    } else if (h >= 240 && h < 300) {
      r = x;
      g = 0;
      b = c;
    } else if (h >= 300 && h < 360) {
      r = c;
      g = 0;
      b = x;
    }

    const toHex = (n: number) => {
      const hex = Math.round((n + m) * 255).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };

    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  private generateAccentColor(primaryHex: string): string {
    const hsl = this.hexToHSL(primaryHex);
    // Generate complementary color (opposite on color wheel)
    const newHue = (hsl.h + 180) % 360;
    // Slightly adjust saturation and lightness for better harmony
    const newSat = Math.min(100, hsl.s * 0.9);
    const newLight = Math.max(40, Math.min(60, hsl.l));
    return this.hslToHex(newHue, newSat, newLight);
  }

  private adjustBackgroundForSecondary(secondaryHex: string): string {
    const hsl = this.hexToHSL(secondaryHex);
    // Create a very dark background that complements the secondary color
    const newHue = (hsl.h + 10) % 360; // Slight hue shift
    const newSat = Math.max(10, hsl.s * 0.3); // Desaturate
    const newLight = 5; // Very dark
    return this.hslToHex(newHue, newSat, newLight);
  }

  private generateContrastingTextColor(backgroundHex: string): string {
    const hsl = this.hexToHSL(backgroundHex);
    // If background is dark, use light text; if light, use dark text
    const isBackgroundDark = hsl.l < 50;
    const textLightness = isBackgroundDark ? 95 : 15;
    const textSat = isBackgroundDark ? 5 : 10;
    return this.hslToHex(hsl.h, textSat, textLightness);
  }

  protected getColorLabel(key: string): string {
    const labels: Record<string, string> = {
      primary: 'Primary Color',
      secondary: 'Secondary Color',
      accent: 'Accent Color',
      background: 'Background Color',
      text: 'Text Color',
    };
    return labels[key] || key;
  }

  protected getColorDescription(key: string): string {
    const descriptions: Record<string, string> = {
      primary: 'Main brand color used for buttons and key elements',
      secondary: 'Supporting color that complements your primary',
      accent: 'Highlighting color for calls-to-action',
      background: 'Base background color for your designs',
      text: 'Primary text color for readability',
    };
    return descriptions[key] || '';
  }
}
