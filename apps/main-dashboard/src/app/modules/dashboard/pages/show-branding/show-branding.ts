import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { CookieService } from '../../../../shared/services/cookie.service';
import { BrandingService } from '../../services/ai-agents/branding.service';
import { ProjectService } from '../../services/project.service';
import {
  BrandIdentityModel,
  ColorModel,
  SocialAssetFile,
  TypographyModel,
} from '../../models/brand-identity.model';
import { LogoModel } from '../../models/logo.model';
import { ProjectModel } from '@idem/shared-models';
import { Dialog } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { BrandingValidationService } from '../../services/branding-validation.service';
import { IncompleteProjectBannerComponent } from '../../components/incomplete-project-banner/incomplete-project-banner';
import { LogoSrcPipe } from '../../../../shared/pipes/logo-src.pipe';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';

type LogoGround = 'light' | 'dark';

interface LogoVariant {
  id: string;
  labelKey: string;
  ground: LogoGround;
  src: string;
}

interface PaletteStrip {
  role: string;
  weight: number;
  hex: string;
  ink: string;
}

/**
 * Papier et encre de repli pour la scène du logo, quand la palette n'a ni
 * fond ni couleur de texte. Ce sont des couleurs de SUPPORT (où le logo sera
 * posé), pas de l'interface : elles ne suivent donc pas le thème.
 */
const BRAND_PAPER = '#ffffff';
const BRAND_INK = '#111111';

/** Encre lisible sur une couleur de marque : noire ou blanche selon sa luminance. */
function readableInk(hex: string): string {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? value.replace(/./g, (c) => c + c) : value.slice(0, 6);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
  if ([r, g, b].some(Number.isNaN)) return BRAND_INK;
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return luminance > 0.4 ? BRAND_INK : BRAND_PAPER;
}

@Component({
  selector: 'app-show-branding',
  imports: [
    CommonModule,
    Dialog,
    ButtonModule,
    TranslateModule,
    IncompleteProjectBannerComponent,
    IdemLoaderComponent,
  ],
  templateUrl: './show-branding.html',
  styleUrl: './show-branding.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShowBrandingComponent implements OnInit {
  private readonly brandingService = inject(BrandingService);
  private readonly projectService = inject(ProjectService);
  private readonly cookieService = inject(CookieService);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly brandingValidation = inject(BrandingValidationService);
  private readonly logoSrcPipe = new LogoSrcPipe();

  // Loading and error states
  protected readonly isLoading = signal<boolean>(true);
  protected readonly hasError = signal<boolean>(false);
  protected readonly errorMessage = signal<string>('');
  protected readonly isRetryable = signal<boolean>(false);

  // Project and branding data
  protected readonly projectIdFromCookie = signal<string | null>(null);
  protected readonly currentProject = signal<ProjectModel | null>(null);
  protected readonly existingBranding = signal<BrandIdentityModel | null>(null);

  // Branding validation
  protected readonly isBrandingComplete = signal<boolean>(false);
  protected readonly brandingMissingElements = signal<string[]>([]);

  // Dialog state for logo download
  protected visible = false;
  protected selectedExtension = 'svg';
  protected readonly isDownloading = signal<boolean>(false);

  /**
   * Formats proposés au téléchargement. Le SVG est mis en avant : c'est le
   * seul qui ne se dégrade pas, et donc le bon choix par défaut pour un logo.
   */
  protected readonly logoFormats = [
    { id: 'svg', recommended: true },
    { id: 'png', recommended: false },
    { id: 'psd', recommended: false },
  ];

  /** Archive complète de la marque en cours de préparation. */
  protected readonly isDownloadingAssets = signal<boolean>(false);
  /** Bannières de réseaux sociaux et photo de profil, en fichiers. */
  protected readonly socialAssets = signal<SocialAssetFile[]>([]);
  protected readonly socialAssetsState = signal<'idle' | 'loading' | 'ready' | 'error'>('idle');
  /** Fichier de bannière en cours de téléchargement (un à la fois). */
  protected readonly downloadingAssetId = signal<string | null>(null);

  // Computed properties for UI state
  protected readonly hasProjectData = computed(() => {
    const project = this.currentProject();
    return project !== null;
  });

  protected readonly hasBrandingGuide = computed(() => {
    return this.existingBranding() !== null;
  });

  protected readonly hasBrandingSections = computed(() => {
    const branding = this.existingBranding();
    return branding && branding.sections && branding.sections.length > 0;
  });

  protected readonly hasBrandingData = computed(() => {
    const branding = this.existingBranding();
    return (
      branding &&
      (branding.logo ||
        branding.generatedLogos?.length > 0 ||
        branding.colors ||
        branding.generatedColors?.length > 0 ||
        branding.typography ||
        branding.generatedTypography?.length > 0)
    );
  });

  /**
   * Les cartes de visite dérivent du logo et de la palette RETENUS : tant que
   * l'un des deux manque, la génération échouerait côté serveur — on n'affiche
   * donc pas l'accès (mêmes critères que la page cartes de visite).
   */
  protected readonly canCreateBusinessCards = computed(() => {
    const branding = this.existingBranding();
    return Boolean(
      branding?.colors?.colors?.primary ||
        branding?.logo?.assetUrls?.primary ||
        branding?.logo?.svg,
    );
  });

  /** Déclinaison affichée en grand sur la scène du logo. */
  protected readonly selectedVariantId = signal<string>('main');
  /** Couleur dont la valeur vient d'être copiée (retour visuel bref). */
  protected readonly copiedColor = signal<string | null>(null);
  private copiedTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Le logo et ses déclinaisons, dans l'ordre où on les cherche : le logo
   * retenu, puis avec texte, puis l'icône seule. Chaque déclinaison dit sur
   * quel fond elle se pose — c'est ce fond que la scène prend.
   */
  protected readonly logoVariants = computed<LogoVariant[]>(() => {
    const logo = this.existingBranding()?.logo;
    if (!logo) return [];
    const urls = logo.assetUrls;
    const variations = logo.variations;
    const candidates: (LogoVariant | null)[] = [
      this.variant('main', 'dashboard.showBranding.sections.logos.main', 'light', urls?.primary, logo.svg),
      this.variant('text-light', 'dashboard.showBranding.sections.logos.lightBg', 'light', urls?.withText?.lightBackground, variations?.withText?.lightBackground),
      this.variant('text-dark', 'dashboard.showBranding.sections.logos.darkBg', 'dark', urls?.withText?.darkBackground, variations?.withText?.darkBackground),
      this.variant('text-mono', 'dashboard.showBranding.sections.logos.monochrome', 'light', urls?.withText?.monochrome, variations?.withText?.monochrome),
      this.variant('icon-light', 'dashboard.showBranding.sections.logos.iconLight', 'light', urls?.iconOnly?.lightBackground, variations?.iconOnly?.lightBackground),
      this.variant('icon-dark', 'dashboard.showBranding.sections.logos.iconDark', 'dark', urls?.iconOnly?.darkBackground, variations?.iconOnly?.darkBackground),
      this.variant('icon-mono', 'dashboard.showBranding.sections.logos.iconMono', 'light', urls?.iconOnly?.monochrome, variations?.iconOnly?.monochrome),
    ];
    return candidates.filter((item): item is LogoVariant => item !== null);
  });

  protected readonly activeVariant = computed<LogoVariant | null>(() => {
    const variants = this.logoVariants();
    return variants.find((item) => item.id === this.selectedVariantId()) ?? variants[0] ?? null;
  });

  /**
   * La palette en bandes. La largeur suit la part d'usage de chaque rôle
   * (la primaire domine, l'accent ponctue) : la bande dit déjà comment doser.
   */
  protected readonly palette = computed<PaletteStrip[]>(() => {
    const colors = this.existingBranding()?.colors?.colors;
    if (!colors) return [];
    const roles: [keyof typeof colors, number][] = [
      ['primary', 3],
      ['secondary', 2],
      ['accent', 1.2],
      ['background', 1.6],
    ];
    return roles
      .filter(([role]) => Boolean(colors[role]))
      .map(([role, weight]) => ({
        role,
        weight,
        hex: colors[role].toUpperCase(),
        ink: readableInk(colors[role]),
      }));
  });

  /** Spécimen : le vrai nom et la vraie description, plutôt que « Aa Bb Cc ». */
  protected readonly specimenHeadline = computed(
    () => this.currentProject()?.name?.trim() || 'Aa Bb Cc',
  );
  protected readonly specimenBody = computed(() => {
    const project = this.currentProject();
    return (project?.description || '').trim();
  });

  /** Fond de la scène pour une déclinaison : le papier ou l'encre de la marque. */
  protected groundFor(ground: LogoGround): string {
    const colors = this.existingBranding()?.colors?.colors;
    return ground === 'dark' ? colors?.text || BRAND_INK : colors?.background || BRAND_PAPER;
  }

  protected selectVariant(id: string): void {
    this.selectedVariantId.set(id);
  }

  /** Copie la valeur d'une couleur ; la bande affiche « Copié » un instant. */
  protected copyColor(hex: string): void {
    navigator.clipboard?.writeText(hex).then(
      () => {
        this.copiedColor.set(hex);
        if (this.copiedTimer) clearTimeout(this.copiedTimer);
        this.copiedTimer = setTimeout(() => this.copiedColor.set(null), 1600);
      },
      () => this.copiedColor.set(null),
    );
  }

  private variant(
    id: string,
    labelKey: string,
    ground: LogoGround,
    hosted?: string,
    svg?: string,
  ): LogoVariant | null {
    const src = this.logoSrc(hosted, svg);
    return src ? { id, labelKey, ground, src } : null;
  }

  /**
   * Résout la source d'affichage d'un logo : privilégie l'URL PNG hébergée
   * (assetUrls) puis retombe sur le SVG. Ce repli peut être du markup inline
   * (concepts non encore externalisés) — un `<img>` ne sait pas l'afficher tel
   * quel, d'où la conversion en data-URI par le pipe partagé.
   */
  protected logoSrc(hostedUrl?: string, svgFallback?: string): string {
    const hosted = (hostedUrl || '').trim();
    if (hosted) return hosted;
    return this.logoSrcPipe.transform(svgFallback);
  }

  ngOnInit(): void {
    const projectId = this.cookieService.get('projectId');
    this.projectIdFromCookie.set(projectId);

    if (projectId) {
      this.loadProjectData(projectId);
    } else {
      this.isLoading.set(false);
    }
  }

  /**
   * Load project data and branding information
   */
  private loadProjectData(projectId: string): void {
    // Load project data first
    this.projectService.getProjectById(projectId).subscribe({
      next: (project) => {
        this.currentProject.set(project);

        // Check branding completion
        const { isComplete, missingElements } =
          this.brandingValidation.checkBrandingCompletion(project);
        this.isBrandingComplete.set(isComplete);
        this.brandingMissingElements.set(missingElements);

        // Then load branding data
        this.loadExistingBranding(project!);
      },
      error: (err: any) => {
        console.error('Error loading project data:', err);
        this.hasError.set(true);
        this.errorMessage.set(this.translate.instant('dashboard.showBranding.errors.loadProject'));
        this.isRetryable.set(true);
        this.isLoading.set(false);
      },
    });
  }

  /**
   * Load existing branding data for the project
   * Load branding data from project and check for PDF
   */
  /**
   * Le branding issu du workflow d'import peut être partiel (couleurs ou
   * typographie pas encore sélectionnées, sections absentes). On normalise
   * pour que le template puisse lire colors.colors, generatedColors.length,
   * logo.variations, etc. sans planter — les sections correspondantes
   * basculent alors sur leur état vide.
   */
  private normalizeBranding(branding: BrandIdentityModel): BrandIdentityModel {
    return {
      ...branding,
      logo: branding.logo ?? ({} as LogoModel),
      colors: branding.colors ?? ({} as ColorModel),
      typography: branding.typography ?? ({} as TypographyModel),
      generatedLogos: branding.generatedLogos ?? [],
      generatedColors: branding.generatedColors ?? [],
      generatedTypography: branding.generatedTypography ?? [],
      sections: branding.sections ?? [],
    };
  }

  /**
   * Lit la marque stockée sur le projet. Le PDF n'est PAS demandé ici : le
   * demander le faisait générer à chaque ouverture de la page. Il n'est
   * produit qu'à l'export (aperçu de la charte, archive des assets).
   */
  private loadExistingBranding(project: ProjectModel): void {
    const brandingData = project.analysisResultModel?.branding;
    if (brandingData) {
      this.existingBranding.set(this.normalizeBranding(brandingData));
      this.loadBrandFonts(brandingData.typography);
      // Les bannières sont composées à partir de la charte : sans elle, rien à montrer.
      if (this.hasBrandingSections()) this.loadSocialAssets(project.id!);
    }
    this.hasError.set(false);
    this.isLoading.set(false);
  }

  /**
   * Navigate to branding generation page
   */
  protected generateBranding(force = false): void {
    console.log('Navigating to branding generation page, force:', force);
    this.router.navigate(['/project/branding/generate'], {
      queryParams: force ? { force: 'true' } : {}
    });
  }

  /**
   * Navigate to branding generation (alias for banner)
   */
  protected navigateToBrandingGeneration(force = false): void {
    this.generateBranding(force);
  }

  /**
   * Navigate to branding display page
   */
  protected viewBrandingGuide(): void {
    console.log('Navigating to branding display page');
    this.router.navigate(['/project/branding/display']);
  }

  /** Ouvre l'éditeur WYSIWYG de la charte graphique. */
  protected editBrandingGuide(): void {
    this.router.navigate(['/project/branding/edit']);
  }

  /** Ouvre le module « cartes de visite » (dérivé de la charte graphique). */
  protected goToBusinessCards(): void {
    this.router.navigate(['/project/business-cards']);
  }

  /**
   * Retry loading the branding PDF
   */
  protected retryLoadBranding(): void {
    console.log('Retrying branding PDF load');
    const projectId = this.cookieService.get('projectId');
    if (projectId) {
      this.hasError.set(false);
      this.isLoading.set(true);
      this.loadProjectData(projectId);
    }
  }

  /**
   * Navigate to projects page
   */
  protected goToProjects(): void {
    console.log('Navigating to projects page');
    this.router.navigate(['/projects']);
  }

  /**
   * Open extension selection dialog for logo download
   */
  protected showDialog(): void {
    console.log('Opening extension selection dialog');
    this.visible = true;
  }

  /**
   * Select extension for logo download
   */
  protected selectExtension(extension: string): void {
    console.log('Selected extension:', extension);
    this.selectedExtension = extension;
  }

  /**
   * Download all logo variations as ZIP file with selected extension
   */
  protected downloadLogosZip(): void {
    const projectId = this.cookieService.get('projectId');
    if (!projectId) {
      console.error('No project ID found');
      return;
    }

    const extension = this.selectedExtension;
    console.log('Downloading logos ZIP for project:', projectId, 'with extension:', extension);

    // Start loading
    this.isDownloading.set(true);

    this.brandingService.downloadLogosZip(projectId, extension).subscribe({
      next: (zipBlob: Blob) => {
        // Stop loading
        this.isDownloading.set(false);

        if (zipBlob && zipBlob.size > 0) {
          // Create download link
          const url = window.URL.createObjectURL(zipBlob);
          const link = document.createElement('a');
          link.href = url;

          // Get project name for filename
          const projectName = this.currentProject()?.name || 'project';
          const sanitizedName = projectName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
          link.download = `${sanitizedName}_logos_${extension}.zip`;

          // Trigger download
          document.body.appendChild(link);
          link.click();

          // Cleanup
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);

          console.log('Logos ZIP download completed');

          // Close dialog after successful download
          this.visible = false;
        } else {
          console.error('Empty ZIP file received');
          alert(this.translate.instant('dashboard.showBranding.errors.emptyZip'));
        }
      },
      error: (err: any) => {
        // Stop loading
        this.isDownloading.set(false);

        console.error('Error downloading logos ZIP:', err);

        // Handle specific error cases
        if (err.message === 'LOGOS_NOT_FOUND') {
          alert(this.translate.instant('dashboard.showBranding.errors.noLogoVariations'));
        } else if (err.message === 'User not authenticated') {
          alert(this.translate.instant('dashboard.showBranding.errors.authRequired'));
        } else {
          alert(this.translate.instant('dashboard.showBranding.errors.downloadZip'));
        }
      },
    });
  }

  /**
   * Charge les feuilles de style des polices de la marque : sans elles, le
   * spécimen s'afficherait dans la police système sous le nom de la marque.
   */
  private loadBrandFonts(typography?: TypographyModel): void {
    const urls = [typography?.primary?.cssUrl, typography?.secondary?.cssUrl].filter(
      (url): url is string => Boolean(url),
    );
    for (const url of urls) {
      if (document.head.querySelector(`link[data-brand-font="${CSS.escape(url)}"]`)) continue;
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = url;
      link.dataset['brandFont'] = url;
      document.head.appendChild(link);
    }
  }

  /** Bannières et photo de profil : rendues côté serveur à la première visite. */
  protected loadSocialAssets(projectId = this.cookieService.get('projectId')): void {
    if (!projectId) return;
    this.socialAssetsState.set('loading');
    this.brandingService.getSocialAssets(projectId).subscribe({
      next: (items) => {
        this.socialAssets.set(items);
        this.socialAssetsState.set('ready');
      },
      error: (err: any) => {
        console.error('Error loading social assets:', err);
        this.socialAssetsState.set('error');
      },
    });
  }

  /** Télécharge une bannière (PNG aux dimensions exactes du réseau). */
  protected downloadSocialAsset(asset: SocialAssetFile): void {
    const projectId = this.cookieService.get('projectId');
    if (!projectId || this.downloadingAssetId()) return;
    this.downloadingAssetId.set(asset.id);
    this.brandingService.downloadSocialAsset(projectId, asset.id).subscribe({
      next: (blob) => {
        this.downloadingAssetId.set(null);
        this.saveBlob(blob, `${this.fileSlug()}-${asset.id}-${asset.width}x${asset.height}.png`);
      },
      error: (err: any) => {
        this.downloadingAssetId.set(null);
        console.error('Error downloading social asset:', err);
        alert(this.translate.instant('dashboard.showBranding.errors.downloadAsset'));
      },
    });
  }

  /** Toute la marque en une archive : logos, palette, polices, bannières, mockups, charte PDF. */
  protected downloadAllAssets(): void {
    const projectId = this.cookieService.get('projectId');
    if (!projectId || this.isDownloadingAssets()) return;
    this.isDownloadingAssets.set(true);
    this.brandingService.downloadBrandAssetsZip(projectId).subscribe({
      next: (blob) => {
        this.isDownloadingAssets.set(false);
        if (!blob || blob.size === 0) {
          alert(this.translate.instant('dashboard.showBranding.errors.emptyZip'));
          return;
        }
        this.saveBlob(blob, `${this.fileSlug()}-assets.zip`);
      },
      error: (err: any) => {
        this.isDownloadingAssets.set(false);
        console.error('Error downloading brand assets ZIP:', err);
        alert(this.translate.instant('dashboard.showBranding.errors.downloadAssets'));
      },
    });
  }

  private fileSlug(): string {
    return (
      (this.currentProject()?.name || 'marque')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'marque'
    );
  }

  private saveBlob(blob: Blob, fileName: string): void {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }
}
