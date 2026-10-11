import { ProjectModel } from '@/api/persistence/models/project.model';
import { LandingPageConfig } from '@/api/persistence/models/development.model';
import { currentProduct } from '@/utils/product';

/**
 * Le brief envoyé par l'atelier quand l'utilisateur lance la génération.
 *
 * Il ne porte plus que ce que le serveur ne sait pas déjà.
 *
 * Avant, ce fichier répétait côté client tout ce que le serveur assemble de son
 * côté : les règles anti-générique (skill `anti-slop`), le public visé (skill
 * `audience`), le logo et les polices (directive de marque + forge de jetons),
 * la palette (forgée et vérifiée en contraste), et jusqu'au contenu des
 * `package.json`. Quelques milliers de jetons d'entrée envoyés en double à
 * chaque première génération — et, pire, des consignes contradictoires : ce
 * brief réclamait Prisma et TypeScript là où le contrat de build exige du SQL
 * simple et un socle déjà posé.
 *
 * Restent les deux choses qui n'existent que dans les données du projet :
 * le plan dessiné sur le tableau de bord et la direction artistique de la
 * charte. Le serveur les reprend telles quelles dans le prompt final.
 */
export class MultiChatPromptService {
  /**
   * A complete application: interface + server + database. Every development
   * configuration that is not a showcase website alone is one — the older
   * "app", "both" and "integrated" choices all had a server and a database.
   */
  static isFullApplication(projectData: ProjectModel | null | undefined): boolean {
    // Le tableau de bord dit quel produit il ouvre : le site vitrine et
    // l'application d'un même projet ont chacun leur atelier.
    const product = currentProduct();
    if (product) return product === 'app';
    const configs = projectData?.analysisResultModel?.development?.configs;
    return !!configs && configs.landingPageConfig !== LandingPageConfig.ONLY_LANDING;
  }

  /** Le brief d'ouverture : intention produit, plan, direction artistique. */
  generatePrompt(projectData: ProjectModel): string {
    const kind = MultiChatPromptService.isFullApplication(projectData)
      ? 'complete application'
      : 'showcase website';

    return [
      `Build the ${kind} for "${projectData.name}".`,
      projectData.description ? `\n${projectData.description}` : '',
      this.getScopeInfo(projectData),
      this.getPlanInfo(projectData),
      this.getArtDirectionInfo(projectData),
    ]
      .filter((block) => block && block.trim().length > 0)
      .join('\n\n');
  }

  /** Périmètre et cibles, quand le projet les précise. */
  private getScopeInfo(projectData: ProjectModel): string {
    const scope =
      typeof projectData.scope === 'object'
        ? JSON.stringify(projectData.scope)
        : projectData.scope;
    const targets = Array.isArray(projectData.targets)
      ? projectData.targets.join(', ')
      : typeof projectData.targets === 'object'
        ? JSON.stringify(projectData.targets)
        : projectData.targets;

    const lines = [
      scope ? `- **Scope**: ${scope}` : '',
      targets ? `- **Targets**: ${targets}` : '',
    ].filter(Boolean);

    return lines.length ? `## Scope\n${lines.join('\n')}` : '';
  }

  /**
   * The plan drawn on the dashboard (diagrams), fenced so the model reads each
   * one as Mermaid. It decides the data model and the screens.
   */
  private getPlanInfo(projectData: ProjectModel): string {
    const sections = projectData.analysisResultModel?.design?.sections ?? [];
    if (sections.length === 0) {
      return '';
    }

    const blocks = sections
      .filter((section) => section?.data)
      .map((section) => {
        const data = String(section.data).trim();
        const fenced = data.startsWith('```') ? data : `\`\`\`${data}\n\`\`\``;
        return `### ${section.name}${section.summary ? `\n${section.summary}` : ''}\n${fenced}`;
      });

    if (!blocks.length) {
      return '';
    }

    return `## Application plan — SOURCE OF TRUTH
These diagrams were drawn for this project before generation. Build exactly what they describe:
- entities, attributes and relations → the database schema;
- use cases and sequences → the API routes and the screens that call them;
- actors → the user roles.
Do not add entities the plan does not show, and do not drop any it does.

${blocks.join('\n\n')}`;
  }

  /**
   * Art direction block.
   *
   * The generated site is one of the brand's deliverables, and this direction
   * was decided once in the brand book. It is the only visual decision the
   * server does not recompute, so it is the one this brief must carry.
   */
  private getArtDirectionInfo(projectData: ProjectModel): string {
    const ad = (projectData.analysisResultModel?.branding as any)?.artDirection;
    if (!ad?.styleId) return '';

    const lines = [
      "## Art direction from the brand book (MANDATORY — the brand's fixed visual grammar)",
      `- **Style**: ${ad.styleName || ad.styleId} — "${ad.tagline || ''}"`,
      `- **Moodboard**: ${(ad.keywords || []).join(', ')}`,
      `- **Grid**: ${ad.layout?.grid || ''}`,
      `- **Density / whitespace**: ${ad.layout?.density || ''} — ${ad.layout?.whitespace || ''}`,
      `- **Signature move (must be visible)**: ${ad.layout?.signatureMove || ''}`,
      `- **Colour distribution**: ${ad.color?.distribution || ''} — ${ad.color?.application || ''}`,
      `- **Type scale**: ${ad.typography?.scaleContrast || ''} — ${ad.typography?.caseAndTracking || ''}`,
      `- **Imagery**: ${ad.imagery?.medium || ''}; subjects: ${ad.imagery?.subjects || ''}; treatment: ${ad.imagery?.treatment || ''}`,
      `- **Recurring graphic devices**: ${(ad.graphicDevices || []).join(' / ')}`,
      `- **Do**: ${(ad.dos || []).join(' | ')}`,
      `- **Never**: ${(ad.donts || []).join(' | ')}`,
      '',
      'Apply it to the LAYOUT first, not only to the colours: a brand colour on a generic centred hero still reads as a template.',
    ].filter((line) => !/: *$/.test(line) && !/— *$/.test(line));

    return lines.join('\n');
  }
}
