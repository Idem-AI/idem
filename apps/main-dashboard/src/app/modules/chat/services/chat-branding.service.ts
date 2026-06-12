import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ProjectModel } from '@idem/shared-models';
import { BrandingService } from '../../dashboard/services/ai-agents/branding.service';
import { ProjectService } from '../../dashboard/services/project.service';
import { ColorModel, TypographyModel } from '../../dashboard/models/brand-identity.model';
import { LogoModel, LogoPreferencesModel } from '../../dashboard/models/logo.model';
import { ChatSessionService } from './chat-session.service';

/**
 * Étape suivante du flux de complétion d'identité de marque.
 * Dérivée de l'état du projet (et non d'un état local) : le flux est donc
 * reprenable à tout moment, exactement là où il en est.
 */
export type BrandingFlowStep =
  | 'colors-generate'
  | 'colors-pick'
  | 'typography-pick'
  | 'logo-type'
  | 'logos-generate'
  | 'logos-pick'
  | 'variations-generate'
  | 'complete';

/**
 * Complétion conversationnelle de l'identité de marque : réutilise les API du
 * workflow « Complétez votre identité de marque » (couleurs + typographies
 * générées, préférences logo, concepts de logos) et persiste chaque sélection
 * dans le projet, comme le fait la page complete-branding.
 */
@Injectable({ providedIn: 'root' })
export class ChatBrandingService {
  private readonly brandingService = inject(BrandingService);
  private readonly projectService = inject(ProjectService);
  private readonly session = inject(ChatSessionService);

  nextStep(project: ProjectModel | null): BrandingFlowStep {
    const branding = project?.analysisResultModel?.branding;
    if (!branding?.generatedColors?.length) return 'colors-generate';
    if (!branding.colors) return 'colors-pick';
    if (!branding.typography) return 'typography-pick';
    if (branding.logo) {
      // Déclinaisons du logo (fond clair/sombre, monochrome) après sélection
      return branding.logo.variations ? 'complete' : 'variations-generate';
    }
    if (!branding.logoPreferences?.type) return 'logo-type';
    if (!branding.generatedLogos?.length) return 'logos-generate';
    return 'logos-pick';
  }

  /** La charte graphique (sections branding + PDF) a-t-elle été générée ? */
  hasCharte(project: ProjectModel | null): boolean {
    return (project?.analysisResultModel?.branding?.sections?.length ?? 0) > 0;
  }

  isComplete(project: ProjectModel | null): boolean {
    return this.nextStep(project) === 'complete';
  }

  /** Éléments d'identité encore manquants (pour le bandeau d'avertissement). */
  missingParts(project: ProjectModel | null): Array<'logo' | 'colors' | 'typography'> {
    const branding = project?.analysisResultModel?.branding;
    const missing: Array<'logo' | 'colors' | 'typography'> = [];
    if (!branding?.logo) missing.push('logo');
    if (!branding?.colors) missing.push('colors');
    if (!branding?.typography) missing.push('typography');
    return missing;
  }

  generatedColors(project: ProjectModel | null): ColorModel[] {
    return project?.analysisResultModel?.branding?.generatedColors ?? [];
  }

  generatedTypography(project: ProjectModel | null): TypographyModel[] {
    return project?.analysisResultModel?.branding?.generatedTypography ?? [];
  }

  generatedLogos(project: ProjectModel | null): LogoModel[] {
    return project?.analysisResultModel?.branding?.generatedLogos ?? [];
  }

  /** Persiste un patch branding dans le projet et met à jour la session. */
  private async persistBranding(
    project: ProjectModel,
    patch: Record<string, unknown>,
  ): Promise<ProjectModel> {
    const updated: ProjectModel = {
      ...project,
      analysisResultModel: {
        ...project.analysisResultModel,
        branding: {
          ...project.analysisResultModel?.branding,
          ...patch,
        },
      },
    };
    await firstValueFrom(this.projectService.updateProject(project.id!, updated));
    this.session.upsertProject(updated);
    return updated;
  }

  /** Génère palettes + typographies (même API que le mode Avancé) et les persiste. */
  async generateColorsAndTypography(project: ProjectModel): Promise<ProjectModel> {
    const response = await firstValueFrom(
      this.brandingService.generateColorsAndTypography(project),
    );
    return this.persistBranding(project, {
      generatedColors: response.colors,
      generatedTypography: response.typography,
    });
  }

  async selectColor(project: ProjectModel, color: ColorModel): Promise<ProjectModel> {
    return this.persistBranding(project, { colors: color });
  }

  async selectTypography(project: ProjectModel, typography: TypographyModel): Promise<ProjectModel> {
    return this.persistBranding(project, { typography });
  }

  async saveLogoPreferences(
    project: ProjectModel,
    preferences: LogoPreferencesModel,
  ): Promise<ProjectModel> {
    return this.persistBranding(project, { logoPreferences: preferences });
  }

  /** Génère les concepts de logos (couleurs/typo/préférences lus côté serveur). */
  async generateLogos(project: ProjectModel): Promise<ProjectModel> {
    const branding = project.analysisResultModel?.branding;
    if (!branding?.colors || !branding?.typography) {
      throw new Error('Branding colors/typography must be selected before logo generation');
    }
    const response = await firstValueFrom(
      this.brandingService.generateLogosWithPreferences(
        project.id!,
        branding.colors,
        branding.typography,
        branding.logoPreferences ?? { type: 'icon', useAIGeneration: true },
      ),
    );
    return this.persistBranding(project, { generatedLogos: response.logos });
  }

  async selectLogo(project: ProjectModel, logo: LogoModel): Promise<ProjectModel> {
    return this.persistBranding(project, { logo });
  }

  /** Génère les déclinaisons du logo sélectionné et les rattache au logo. */
  async generateVariations(project: ProjectModel): Promise<ProjectModel> {
    const logo = project.analysisResultModel?.branding?.logo;
    if (!logo) {
      throw new Error('A logo must be selected before generating variations');
    }
    const response = await firstValueFrom(
      this.brandingService.generateLogoVariations(logo, project),
    );
    const updatedLogo: LogoModel = { ...logo, variations: response.variations };
    return this.persistBranding(project, { logo: updatedLogo });
  }

  /** Télécharge le pack de logos (déclinaisons) au format ZIP. */
  async downloadLogosZip(projectId: string, projectName?: string): Promise<boolean> {
    try {
      const blob = await firstValueFrom(this.brandingService.downloadLogosZip(projectId, 'svg'));
      if (!blob || blob.size === 0) return false;
      const safeName = (projectName || 'idem-project')
        .toLowerCase()
        .replace(/[^a-z0-9]+/gi, '-')
        .replace(/^-+|-+$/g, '');
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${safeName}-logos.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      return true;
    } catch {
      return false;
    }
  }
}
