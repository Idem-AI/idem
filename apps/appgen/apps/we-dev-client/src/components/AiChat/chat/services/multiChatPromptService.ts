import { ProjectModel } from '@/api/persistence/models/project.model';
import { LandingPageConfig } from '@/api/persistence/models/development.model';

export class MultiChatPromptService {
  /**
   * Explicit negative constraints.
   *
   * A model given a vague brief returns the mean of its training data: the
   * purple-to-blue gradient, Inter, the centred hero over three identical
   * cards. Naming those defaults is what removes them — asking for "something
   * original" has no anchor and changes nothing. The list below is the set of
   * tells that make a generated site recognisable at a glance; the server-side
   * design linter checks the same rules on the emitted files.
   */
  private static readonly ANTI_GENERIC_RULES = `### Anti-generic rules (non negotiable)
These are the defaults that make a site read as machine-made. They override any habit.

BLOCKING:
- No purple / indigo / violet gradient, and no gradient that the art direction did not ask for.
- No gradient headline (bg-clip-text). A headline is one colour.
- No Inter, Roboto, Poppins, Open Sans, Lato or system-ui, unless one of them IS a brand font.
- No "centred hero + three identical feature cards + CTA" skeleton. No row of cards sharing the same width, padding and shadow.
- No reflexive glassmorphism (backdrop-blur over translucent white) unless the art direction prescribes it.
- No colour outside the brand palette. Tints come from opacity, never from a new hue.

STRONG SMELLS:
- \`rounded-2xl shadow-lg\` on everything. One border radius for the whole site, taken from the art direction.
- The icon-in-a-rounded-square repeated in a grid.
- Emoji as bullets or section icons.
- The tiny uppercase tracked eyebrow above every section: keep one at most.
- Default Tailwind blue buttons, arrows welded to button labels, "Get started" as the only CTA wording.
- Light grey body text (text-gray-400): it fails AA and sits outside the palette.
- Placeholder copy: "Lorem ipsum", "Feature One", "Your Company", invented statistics presented as facts.

COPY:
- Banned: "elevate", "unlock", "seamless", "empower", "supercharge", "cutting-edge", "game-changing", "next-generation", "world-class", "revolutionary", "in today's fast-paced world".
- Write what the product literally does, with a concrete noun and a verb.

LAYOUT IS WHERE IT IS WON:
- Fix the layout before the colours. A brand colour on a generic layout is still a generic layout.
- Sections must not all share the same skeleton: alternate asymmetric splits, full-bleed bands, editorial columns, and offset images.
- Vary spacing to express hierarchy. Uniform \`gap-4 p-6\` everywhere reads as unfinished.`;

  /**
   * Who the generated product is for. Shared by the website and the
   * application prompts: a full application shows people and places too.
   */
  private static readonly AFRICA_AUDIENCE = `## TARGET AUDIENCE - SUB-SAHARAN AFRICA (CRITICAL)
This platform primarily targets Sub-Saharan Africa. ALL generated content MUST reflect this:

### Images of People
- ALWAYS use images featuring Black African people. NEVER use generic Western/European/Asian stock photos.
- Use Unsplash with search terms: "african business", "african woman", "african man", "african team", "black professional", "african entrepreneur"
- For avatars/testimonials: use diverse Black African faces (men, women, young professionals)
- For hero/team photos: show diverse African teams in modern work environments

### UI and Cultural Context
- Testimonials and user names MUST use African names (e.g., Amara Diallo, Kwame Asante, Fatou Ndiaye, Chidi Okonkwo, Aisha Mbeki)
- Locations MUST reference African cities (Lagos, Nairobi, Dakar, Accra, Douala, Abidjan, Kigali, Johannesburg)
- Currency references: use local currencies (XAF/FCFA, NGN, KES, GHS, XOF) or USD
- Phone numbers: use African country codes (+237, +234, +254, +233, +225)

### Content and Messaging
- Use inclusive language that resonates with African audiences
- Social proof should mention African companies, organizations, or communities
- Success stories should feature African entrepreneurs and businesses
- Placeholder company names should be African-sounding or Africa-based
`;

  /**
   * A complete application: interface + server + database. Every development
   * configuration that is not a showcase website alone is one — the older
   * "app", "both" and "integrated" choices all had a server and a database.
   */
  static isFullApplication(projectData: ProjectModel | null | undefined): boolean {
    const configs = projectData?.analysisResultModel?.development?.configs;
    return !!configs && configs.landingPageConfig !== LandingPageConfig.ONLY_LANDING;
  }

  /** The application plan (diagrams) drawn on the IDEM dashboard. */
  static hasPlan(projectData: ProjectModel | null | undefined): boolean {
    return (projectData?.analysisResultModel?.design?.sections?.length ?? 0) > 0;
  }

  /**
   * Generate the appropriate prompt based on the project's development choice:
   * a showcase website, or a complete application built on its plan.
   */
  generatePrompt(projectData: ProjectModel): string {
    return MultiChatPromptService.isFullApplication(projectData)
      ? this.generateFullStackPrompt(projectData)
      : this.generateLandingPagePrompt(projectData);
  }

  /**
   * Generate comprehensive landing page prompt
   */
  private generateLandingPagePrompt(projectData: ProjectModel): string {
    const projectInfo = this.getCompleteProjectInfo(projectData);
    const brandInfo = this.getCompleteBrandInfo(projectData);

    return `# Landing Page Generation

${projectInfo}

${brandInfo}

${MultiChatPromptService.AFRICA_AUDIENCE}
Generate the complete landing page code with all necessary files.`;
  }

  /**
   * Complete application prompt: frontend + backend + database.
   *
   * Two things make it different from the website prompt, and both are
   * contracts rather than suggestions:
   * - the plan drawn on the dashboard is the source of truth for the data
   *   model and the screens — without it the model invents a generic CRUD;
   * - the repository layout and the environment variable names are exactly
   *   what iDeploy's "3-tier application" guide wires on its own: it creates
   *   PostgreSQL, fills the backend's DATABASE_URL, then fills the frontend's
   *   VITE_API_URL with the backend's public address. Any other name and the
   *   user has to wire it by hand.
   */
  private generateFullStackPrompt(projectData: ProjectModel): string {
    const projectInfo = this.getCompleteProjectInfo(projectData);
    const brandInfo = this.getCompleteBrandInfo(projectData);
    const plan = this.getPlanInfo(projectData);
    const configs = projectData.analysisResultModel?.development?.configs;
    const withLanding =
      configs?.landingPageConfig === LandingPageConfig.INTEGRATED ||
      configs?.landingPageConfig === LandingPageConfig.SEPARATE;
    const features = configs?.projectConfig;

    return `# Complete Web Application Generation (frontend + backend + database)

${projectInfo}

${plan}

## Architecture — MANDATORY (this is exactly what iDeploy deploys)
One repository, two folders side by side. No Docker files: iDeploy builds each folder on its own.

### backend/ — Node.js + Express + TypeScript + Prisma + PostgreSQL
- \`prisma/schema.prisma\` (provider "postgresql", url = env("DATABASE_URL")) derived from the plan above: one model per entity, the relations it shows, sensible indexes and timestamps.
- Reads ONLY these variables: \`DATABASE_URL\`, \`PORT\` (default 3001), \`JWT_SECRET\`, \`CORS_ORIGIN\` (default "*"). Never hard-code a connection string.
- REST API under \`/api\`, one router per entity, input validated (zod), errors returned as JSON \`{ error: string }\` with the right status code.
- \`GET /health\` answers \`{ "status": "ok" }\` without touching the database.
${features?.authentication !== false ? '- Authentication: email + password (bcrypt) and JWT; `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`. Protected routes check the token.\n' : ''}- package.json scripts: \`dev\` (tsx watch), \`build\` ("prisma generate && tsc"), \`start\` ("prisma migrate deploy && node dist/index.js"), \`seed\`.
- A first migration in \`prisma/migrations\` and a seed script with realistic sample data (African names, cities, currencies).
- \`.env.example\` listing every variable above.

### frontend/ — React + Vite + TypeScript + Tailwind CSS + React Router
- Calls the API through ONE client module whose base URL is \`import.meta.env.VITE_API_URL\` (fallback \`http://localhost:3001\`). Never another variable name.
- One screen per use case of the plan, reachable from the navigation; lists, detail and forms for each main entity; a dashboard as the home of signed-in users.
${withLanding ? '- A public home page at `/` presents the product (brand, offer, call to action); the application lives behind sign-in.\n' : ''}- Every screen handles three states: loading, empty, error. When the API cannot be reached (the in-browser preview runs the frontend only), show a clear message — never a blank page.
- package.json scripts: \`dev\`, \`build\` (output in \`dist/\`), \`preview\`.
- \`.env.example\` with \`VITE_API_URL\`.

### Repository root
- \`README.md\`: what the application does, the two folders, every environment variable, and how to run both locally.

## Order of work
1. The Prisma schema, from the plan.
2. The backend routes, entity by entity.
3. The frontend screens that call them.

${brandInfo}

${MultiChatPromptService.AFRICA_AUDIENCE}
Generate the complete application code — both folders — with all necessary files.`;
  }

  /**
   * The plan drawn on the dashboard (diagrams), fenced so the model reads each
   * one as Mermaid. It decides the data model and the screens.
   */
  private getPlanInfo(projectData: ProjectModel): string {
    const sections = projectData.analysisResultModel?.design?.sections ?? [];
    if (sections.length === 0) {
      return '## Application Plan\n- No plan available. Derive the entities and screens from the project description, and keep them few.';
    }

    const blocks = sections
      .filter((section) => section?.data)
      .map((section) => {
        const data = String(section.data).trim();
        const fenced = data.startsWith('```') ? data : `\`\`\`${data}\n\`\`\``;
        return `### ${section.name}${section.summary ? `\n${section.summary}` : ''}\n${fenced}`;
      });

    return `## Application Plan — SOURCE OF TRUTH
These diagrams were drawn for this project before generation. Build exactly what they describe:
- entities, attributes and relations → the Prisma models;
- use cases and sequences → the API routes and the screens that call them;
- actors → the user roles.
Do not add entities the plan does not show, and do not drop any it does.

${blocks.join('\n\n')}`;
  }

  /**
   * Get complete project information
   */
  private getCompleteProjectInfo(projectData: ProjectModel): string {
    const typeStr =
      typeof projectData.type === 'object'
        ? JSON.stringify(projectData.type)
        : projectData.type || 'web';
    const scopeStr =
      typeof projectData.scope === 'object'
        ? JSON.stringify(projectData.scope)
        : projectData.scope || 'Not specified';
    const targetsStr = Array.isArray(projectData.targets)
      ? projectData.targets.join(', ')
      : typeof projectData.targets === 'object'
        ? JSON.stringify(projectData.targets)
        : projectData.targets || 'Not specified';

    return `## Project Information
- **Name**: ${projectData.name}
- **Description**: ${projectData.description || 'No description provided'}
- **Type**: ${typeStr}
- **Scope**: ${scopeStr}
- **Targets**: ${targetsStr}`;
  }

  /**
   * Turn a logo field into a usable <img src>. Inline SVG markup becomes a data
   * URI; anything else is passed through when it already looks like a URL.
   */
  private toImgSrc(value?: string): string {
    const trimmed = (value || '').trim();
    if (!trimmed) return '';
    if (
      trimmed.startsWith('http://') ||
      trimmed.startsWith('https://') ||
      trimmed.startsWith('data:')
    ) {
      return trimmed;
    }
    if (trimmed.includes('<svg')) {
      return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(trimmed)))}`;
    }
    return '';
  }

  /**
   * Art direction block.
   *
   * The generated site is one of the brand's deliverables: without the art
   * direction it landed on the model's default look — Inter, a purple gradient,
   * a centered hero and three rounded cards — which matched nothing else the
   * project had produced. The direction is decided once in the brand book and
   * read here.
   */
  private getArtDirectionInfo(projectData: ProjectModel): string {
    const ad = (projectData.analysisResultModel?.branding as any)?.artDirection;
    if (!ad?.styleId) return '';

    const lines = [
      '### Art Direction (MANDATORY — this is the brand\'s fixed visual grammar)',
      `- **Style**: ${ad.styleName || ad.styleId} — "${ad.tagline || ''}"`,
      `- **Why**: ${ad.rationale || ''}`,
      `- **Moodboard**: ${(ad.keywords || []).join(', ')}`,
      `- **Grid**: ${ad.layout?.grid || ''}`,
      `- **Density / whitespace**: ${ad.layout?.density || ''} — ${ad.layout?.whitespace || ''}`,
      `- **Signature move (must be visible)**: ${ad.layout?.signatureMove || ''}`,
      `- **Colour distribution**: ${ad.color?.distribution || ''} — ${ad.color?.application || ''}`,
      `- **Type scale**: ${ad.typography?.scaleContrast || ''} — ${ad.typography?.caseAndTracking || ''}`,
      `- **Imagery**: ${ad.imagery?.medium || ''}; subjects: ${ad.imagery?.subjects || ''}; treatment: ${ad.imagery?.treatment || ''}; lighting: ${ad.imagery?.lighting || ''}`,
      `- **Recurring graphic devices**: ${(ad.graphicDevices || []).join(' / ')}`,
      `- **Do**: ${(ad.dos || []).join(' | ')}`,
      `- **Never**: ${(ad.donts || []).join(' | ')}`,
      '',
      'Apply it to the LAYOUT first, not only to the colours: a brand colour on a generic centred hero still reads as a template. The border radius, the rules, the shadows and the type scale come from this direction and are identical across every section.',
    ].filter((line) => !/: *$/.test(line) && !/— *$/.test(line));

    return lines.join('\n') + '\n';
  }

  /**
   * Get complete brand information including logos
   */
  private getCompleteBrandInfo(projectData: ProjectModel): string {
    const branding = projectData.analysisResultModel?.branding;
    if (!branding) return '## Brand Information\n- No brand information specified';

    let brandInfo = '## Brand Information\n';

    // Logo: the URL alone was not enough. A model handed a value with no verb
    // treats it as context, not as something to render — which is exactly why
    // generated sites shipped without the brand logo. The block below carries
    // every declension AND the obligation to place them.
    if (branding.logo) {
      const logo: any = branding.logo;
      const primary = this.toImgSrc(logo.assetUrls?.primary) || this.toImgSrc(logo.svg);
      const pick = (...candidates: Array<string | undefined>): string => {
        for (const candidate of candidates) {
          const src = this.toImgSrc(candidate);
          if (src) return src;
        }
        return primary;
      };

      if (primary) {
        brandInfo += `### Logo — MANDATORY, render it as <img src="…" />\n`;
        brandInfo += `Ready-to-use image URLs. Copy them EXACTLY. Never invent a URL, never inline raw SVG, never write a symbolic path such as "branding.logo.url".\n`;
        brandInfo += `- **Primary (full logo)**: ${primary}\n`;
        brandInfo += `- **With text — DARK ink, for a LIGHT background**: ${pick(logo.assetUrls?.withText?.lightBackground, logo.variations?.withText?.lightBackground)}\n`;
        brandInfo += `- **With text — LIGHT ink, for a DARK background**: ${pick(logo.assetUrls?.withText?.darkBackground, logo.variations?.withText?.darkBackground)}\n`;
        brandInfo += `- **Icon only — DARK ink, for a LIGHT background**: ${pick(logo.assetUrls?.iconOnly?.lightBackground, logo.variations?.iconOnly?.lightBackground, logo.assetUrls?.icon, logo.iconSvg)}\n`;
        brandInfo += `- **Icon only — LIGHT ink, for a DARK background**: ${pick(logo.assetUrls?.iconOnly?.darkBackground, logo.variations?.iconOnly?.darkBackground, logo.assetUrls?.icon, logo.iconSvg)}\n`;
        brandInfo += `Rules: the logo MUST appear in the header and in the footer. Pick the declension by the actual luminance of the surface behind it — dark ink on a light surface, light ink on a dark surface; a light-ink logo on a light header erases the brand. Header size: h-9 to h-12, w-auto, full opacity, never inside a coloured pill. Use the icon-only declension for the favicon and for compact placements.\n`;
      } else {
        brandInfo += `### Logo\n- This brand has NO logo asset. Do not draw one and do not invent a URL: set the brand name in the display typeface as the wordmark.\n`;
      }
    }

    // Colors
    if (branding.colors) {
      brandInfo += `### Colors\n`;
      brandInfo += `- **Color Scheme**: ${branding.colors.name}\n`;
      brandInfo += `- **Reference**: ${branding.colors.url} (URL)\n`;
      if (branding.colors.colors) {
        brandInfo += `- **Primary**: ${branding.colors.colors.primary}\n`;
        brandInfo += `- **Secondary**: ${branding.colors.colors.secondary}\n`;
        brandInfo += `- **Accent**: ${branding.colors.colors.accent}\n`;
        brandInfo += `- **Background**: ${branding.colors.colors.background}\n`;
        brandInfo += `- **Text**: ${branding.colors.colors.text}\n`;
      }
    }

    // Typography
    if (branding.typography) {
      brandInfo += `### Typography\n`;
      brandInfo += `- **Font System**: ${branding.typography.name}\n`;
      brandInfo += `- **Reference**: ${branding.typography.url} (URL)\n`;
      brandInfo += `- **Primary Font**: ${branding.typography.primaryFont}\n`;
      brandInfo += `- **Secondary Font**: ${branding.typography.secondaryFont}\n`;
      brandInfo += `- Load these two families from Google Fonts and use NOTHING else. Do not fall back to Inter, Roboto or a system stack: the typeface is the fastest way a site stops looking generic.\n`;
    }

    const artDirection = this.getArtDirectionInfo(projectData);
    if (artDirection) {
      brandInfo += `\n${artDirection}`;
    }

    brandInfo += `\n${MultiChatPromptService.ANTI_GENERIC_RULES}\n`;

    return brandInfo;
  }
}
