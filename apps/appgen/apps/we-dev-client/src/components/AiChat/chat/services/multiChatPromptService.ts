import { ProjectModel } from '@/api/persistence/models/project.model';

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
   * Generate the appropriate prompt based on LandingPageConfig and ChatType
   */
  generatePrompt(projectData: ProjectModel): string {
    return this.generateLandingOnlyPrompt(projectData);
  }

  /**
   * Generate prompt for ONLY_LANDING config (landing page only)
   */
  private generateLandingOnlyPrompt(projectData: ProjectModel): string {
    return this.generateLandingPagePrompt(projectData);
  }

  /**
   * Generate comprehensive landing page prompt
   */
  private generateLandingPagePrompt(projectData: ProjectModel): string {
    const projectInfo = this.getCompleteProjectInfo(projectData);
    const brandInfo = this.getCompleteBrandInfo(projectData);

    const title = 'Landing Page Generation';

    return `# ${title}

${projectInfo}

${brandInfo}

## TARGET AUDIENCE - SUB-SAHARAN AFRICA (CRITICAL)
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

Generate the complete landing page code with all necessary files.`;
  }

  /**
   * Generate comprehensive application prompt
   */
  private generateApplicationPrompt(
    projectData: ProjectModel,
    type: 'separate' | 'integrated' | 'none'
  ): string {
    const projectInfo = this.getCompleteProjectInfo(projectData);
    const brandInfo = this.getCompleteBrandInfo(projectData);

    let title = 'Web Application Generation';

    return `# ${title}

${projectInfo}

${brandInfo}

## TARGET AUDIENCE - SUB-SAHARAN AFRICA (CRITICAL)
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

Generate the complete application code with all necessary files.`;
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
