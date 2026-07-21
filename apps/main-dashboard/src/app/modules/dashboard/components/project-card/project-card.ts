import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { ProjectModel } from '@idem/shared-models';
import { Router } from '@angular/router';
import { DatePipe, UpperCasePipe } from '@angular/common';
import { CookieService } from '../../../../shared/services/cookie.service';
import { TranslateModule } from '@ngx-translate/core';
import { SafeHtmlPipe } from '../../../../shared/pipes/safe-html.pipe';

@Component({
  selector: 'app-project-card',
  imports: [DatePipe, UpperCasePipe, TranslateModule, SafeHtmlPipe],
  templateUrl: './project-card.html',
  styleUrl: './project-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectCard {
  project = input<ProjectModel>();
  router = inject(Router);
  cookieService = inject(CookieService);

  /** Track if the logo image has failed to load */
  readonly logoLoadError = signal(false);

  /** Safe string representation of the project type, handling both string and object */
  readonly projectType = computed(() => {
    const proj = this.project();
    if (!proj) return '';
    const type = proj.type;
    if (typeof type === 'string') return type;
    if (type && typeof type === 'object') {
      return (type as any).code || (type as any).name || '';
    }
    return '';
  });

  /** Icon matching the project type */
  readonly typeIcon = computed(() => {
    const type = this.projectType();
    switch (type) {
      case 'web':
        return 'pi pi-globe';
      case 'mobile':
        return 'pi pi-mobile';
      case 'iot':
        return 'pi pi-cog';
      case 'desktop':
        return 'pi pi-desktop';
      default:
        return 'pi pi-folder';
    }
  });

  /** Monogram for visual placeholder logo */
  readonly monogram = computed(() => {
    const proj = this.project();
    if (!proj) return '';
    return proj.name.substring(0, 2).toUpperCase();
  });

  /** Dynamic professional gradient background style based on name/id hash */
  readonly placeholderBgStyle = computed(() => {
    const proj = this.project();
    if (!proj) return '';
    const stringToHash = proj.id || proj.name;
    let hash = 0;
    for (let i = 0; i < stringToHash.length; i++) {
      hash = stringToHash.charCodeAt(i) + ((hash << 5) - hash);
    }
    const gradients = [
      'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)', // Blue - Indigo
      'linear-gradient(135deg, #10b981 0%, #047857 100%)', // Emerald - Teal
      'linear-gradient(135deg, #ec4899 0%, #be185d 100%)', // Rose - Pink
      'linear-gradient(135deg, #f59e0b 0%, #b45309 100%)', // Amber - Orange
      'linear-gradient(135deg, #8b5cf6 0%, #5b21b6 100%)', // Violet - Purple
      'linear-gradient(135deg, #64748b 0%, #334155 100%)', // Slate - Dark gray
    ];
    const index = Math.abs(hash) % gradients.length;
    return `background: ${gradients[index]}`;
  });

  /** SVG of the logo - detects if inline SVG string */
  readonly logoIsInline = computed(() => {
    const svg = this.project()?.analysisResultModel?.branding?.logo?.svg;
    return !!svg && svg.trimStart().startsWith('<');
  });

  /** Handles image loading errors */
  handleImageError() {
    this.logoLoadError.set(true);
  }

  cardClick(id: string) {
    this.cookieService.set('projectId', id);
    this.router.navigate(['/project/dashboard']);
  }
}
