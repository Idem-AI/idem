import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { ColorModel } from '../../../../models/brand-identity.model';

interface ColorHSL {
  h: number;
  s: number;
  l: number;
}

type ColorKey = keyof ColorModel['colors'];

/** Durée de la sortie, alignée sur l'animation `cc-sink-out` du CSS. */
const LEAVE_MS = 180;

/**
 * Ajustement d'une palette générée.
 *
 * L'aperçu de la marque suit chaque retouche ; les cinq couleurs sont toutes
 * visibles, chacune avec son nuancier et son code. Quand une couleur en
 * entraîne une autre (la principale règle l'accent, le fond règle le texte),
 * la couleur ajustée le signale un instant : rien ne change en silence.
 *
 * La fenêtre s'anime à l'entrée et à la sortie ; elle ne prévient le parent
 * (`closed`, `colorsUpdated`) qu'une fois sortie, pour que celui-ci puisse la
 * retirer sans couper l'animation.
 */
@Component({
  selector: 'app-color-customizer',
  imports: [TranslateModule],
  templateUrl: './color-customizer.component.html',
  styleUrl: './color-customizer.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown.escape)': 'close()',
  },
})
export class ColorCustomizerComponent {
  readonly initialColors = input.required<ColorModel>();
  /** Nom affiché dans l'aperçu (le nom du projet). */
  readonly brandName = input<string>('');

  readonly colorsUpdated = output<ColorModel>();
  readonly closed = output<void>();

  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');

  protected readonly customColors = signal<ColorModel['colors']>({
    primary: '',
    secondary: '',
    accent: '',
    background: '',
    text: '',
  });

  protected readonly closing = signal(false);
  /** Couleur que l'harmonisation vient de modifier, signalée un instant. */
  protected readonly autoAdjusted = signal<ColorKey | null>(null);
  private autoAdjustedTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly colorKeys: ColorKey[] = ['primary', 'secondary', 'accent', 'background', 'text'];

  protected readonly onPrimary = computed(() => this.readableOn(this.customColors().primary));
  protected readonly onSecondary = computed(() => this.readableOn(this.customColors().secondary));

  /** Rapport de contraste WCAG du texte sur le fond (4,5:1 = lisible). */
  protected readonly textContrast = computed(() => {
    const { text, background } = this.customColors();
    const a = this.luminance(text);
    const b = this.luminance(background);
    if (a === null || b === null) return 21;
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  });

  protected readonly isDirty = computed(() => {
    const initial = this.initialColors().colors;
    const current = this.customColors();
    return this.colorKeys.some((k) => initial[k]?.toLowerCase() !== current[k]?.toLowerCase());
  });

  constructor() {
    effect(() => {
      const initial = this.initialColors();
      if (initial) {
        this.customColors.set({ ...initial.colors });
      }
    });
    // Le focus entre dans la fenêtre : le clavier et les lecteurs d'écran y sont.
    afterNextRender(() => this.panel()?.nativeElement.focus());
  }

  // ─────────────────────────────────────────────── Saisie

  protected onPick(key: ColorKey, event: Event): void {
    this.applyChange(key, (event.target as HTMLInputElement).value);
  }

  /** Code saisi à la main : appliqué seulement s'il est complet et valide. */
  protected onHex(key: ColorKey, event: Event): void {
    const field = event.target as HTMLInputElement;
    const value = this.normalizeHex(field.value);
    if (value) {
      this.applyChange(key, value);
      field.value = value;
    } else {
      field.value = this.customColors()[key];
    }
  }

  private applyChange(key: ColorKey, value: string): void {
    const updated = { ...this.customColors(), [key]: value };
    let adjusted: ColorKey | null = null;

    if (key === 'primary') {
      updated.accent = this.generateAccentColor(value);
      adjusted = 'accent';
    } else if (key === 'secondary') {
      updated.background = this.adjustBackgroundForSecondary(value);
      adjusted = 'background';
    } else if (key === 'background') {
      updated.text = this.generateContrastingTextColor(value);
      adjusted = 'text';
    }

    this.customColors.set(updated);
    this.flagAutoAdjusted(adjusted);
  }

  private flagAutoAdjusted(key: ColorKey | null): void {
    if (this.autoAdjustedTimer) clearTimeout(this.autoAdjustedTimer);
    this.autoAdjusted.set(key);
    if (key) {
      this.autoAdjustedTimer = setTimeout(() => this.autoAdjusted.set(null), 2500);
    }
  }

  // ─────────────────────────────────────────────── Actions

  protected applyColors(): void {
    const updated: ColorModel = { ...this.initialColors(), colors: this.customColors() };
    this.leave(() => this.colorsUpdated.emit(updated));
  }

  protected resetColors(): void {
    this.customColors.set({ ...this.initialColors().colors });
    this.flagAutoAdjusted(null);
  }

  protected close(): void {
    this.leave(() => this.closed.emit());
  }

  /** Joue la sortie, puis prévient le parent. Une seule sortie à la fois. */
  private leave(done: () => void): void {
    if (this.closing()) return;
    this.closing.set(true);
    setTimeout(done, LEAVE_MS);
  }

  // ─────────────────────────────────────────────── Lisibilité

  /** Encre lisible sur une couleur : sombre sur clair, blanche sur foncé. */
  protected readableOn(hex: string): string {
    const l = this.luminance(hex);
    return l !== null && l > 0.4 ? '#111111' : '#ffffff';
  }

  private luminance(hex: string): number | null {
    const value = this.normalizeHex(hex);
    if (!value) return null;
    const [r, g, b] = [1, 3, 5].map((i) => {
      const v = parseInt(value.slice(i, i + 2), 16) / 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  /** `#abc`, `abc`, `#aabbcc` → `#aabbcc` ; tout le reste → null. */
  private normalizeHex(raw: string): string | null {
    const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec((raw ?? '').trim());
    if (!m) return null;
    const hex = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1];
    return `#${hex.toLowerCase()}`;
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

  /**
   * Fond dérivé de la secondaire : un blanc CASSÉ, teinté de cette secondaire.
   *
   * Cette méthode posait auparavant une clarté de 5 % — un quasi-noir. Changer
   * la couleur secondaire suffisait donc à faire basculer tout le projet en
   * thème sombre, sans que l'utilisateur n'ait touché au fond : la charte, les
   * livrables et le site généré alignent tous leur polarité sur ce champ.
   */
  private adjustBackgroundForSecondary(secondaryHex: string): string {
    const hsl = this.hexToHSL(secondaryHex);
    const newHue = (hsl.h + 10) % 360; // Slight hue shift
    const newSat = Math.min(12, hsl.s * 0.15); // Une teinte, pas une couleur
    const newLight = 97; // Blanc cassé
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
}
