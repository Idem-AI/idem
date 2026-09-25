import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';

interface LogoAsset {
  file: string;
  /** Variant for the dark theme, when the brand mark would not read on a dark surface. */
  darkFile?: string;
}

/**
 * Framework preset label → vendored brand mark under `assets/frameworks/`,
 * always in colour: Simple Icons (CC0) and Devicon (MIT) for the multicolour
 * ones (Angular, Java, Next.js).
 */
const LOGOS: Record<string, LogoAsset> = {
  Vite: { file: 'vite' },
  'Next.js': { file: 'nextjs', darkFile: 'nextjs-dark' },
  'Node.js': { file: 'nodedotjs' },
  Angular: { file: 'angular' },
  Static: { file: 'html5' },
  'Spring Boot (Maven)': { file: 'springboot' },
  'Spring Boot (Gradle)': { file: 'springboot' },
  'Java (Maven)': { file: 'java' },
  'Java (Gradle)': { file: 'java' },
  Django: { file: 'django', darkFile: 'django-dark' },
  FastAPI: { file: 'fastapi' },
  Flask: { file: 'flask' },
  Python: { file: 'python' },
  Go: { file: 'go' },
  'Ruby on Rails': { file: 'rubyonrails' },
  Ruby: { file: 'ruby' },
  Laravel: { file: 'laravel' },
  PHP: { file: 'php' },
  Dockerfile: { file: 'docker' },
};

/**
 * The logo of a framework preset, or a neutral box for one without a mark.
 *
 * @example
 * ```html
 * <app-framework-logo framework="Angular" [size]="20" />
 * ```
 */
@Component({
  selector: 'app-framework-logo',
  imports: [NgOptimizedImage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex shrink-0 items-center justify-center' },
  template: `
    @if (asset(); as a) {
      @if (a.darkFile) {
        <img [ngSrc]="url(a.file)" [alt]="framework()" [width]="size()" [height]="size()" class="block dark:hidden" />
        <img [ngSrc]="url(a.darkFile)" alt="" aria-hidden="true" [width]="size()" [height]="size()" class="hidden dark:block" />
      } @else {
        <img [ngSrc]="url(a.file)" [alt]="framework()" [width]="size()" [height]="size()" class="block" />
      }
    } @else {
      <i class="pi pi-box text-text-secondary" [style.font-size.px]="size()" aria-hidden="true"></i>
    }
  `,
})
export class FrameworkLogoComponent {
  /** A preset label, as listed in the import form (`Angular`, `Spring Boot (Maven)`…). */
  readonly framework = input.required<string>();
  readonly size = input(20);

  protected readonly asset = computed<LogoAsset | null>(() => LOGOS[this.framework()] ?? null);

  protected url(file: string): string {
    return `/assets/frameworks/${file}.svg`;
  }
}
