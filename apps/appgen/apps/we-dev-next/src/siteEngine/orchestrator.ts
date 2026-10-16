/**
 * Génération d'un site vitrine : design system dynamique, composition libre.
 *
 * Opération A — conception (deux appels courts, en parallèle) :
 *   - l'architecte écrit le manifeste du site (pages, sections, composants) ;
 *   - le directeur artistique écrit la configuration du design system (JSON).
 *
 * Opération B — application et génération :
 *   1. le socle (template React + TS + Tailwind + shadcn/ui + Motion) est déjà
 *      monté, ou posé ici s'il ne l'est pas ;
 *   2. le compilateur applique la configuration (variables CSS, réglages des
 *      composants) ;
 *   3. le code écrit les faits (`@/site/data`), les documents des pages, les
 *      points d'entrée ;
 *   4. les visuels sont choisis et produits ;
 *   5. un agent par composant écrit l'en-tête, le pied de page et chaque
 *      section, avec le contrat des composants disponibles ; chaque composant
 *      est monté dans un DOM avec les fichiers réels du site avant d'être
 *      accepté (`renderCheck.ts`) : un plantage à l'exécution repart au modèle
 *      comme une erreur de forme, avec sa ligne ;
 *   6. le code assemble les pages (imports dans l'ordre) et lance l'aperçu.
 *
 * Pas d'évaluation esthétique, pas de réparation après coup, pas de gabarit de
 * secours : une erreur est dite dans la conversation et le code est conservé.
 */

import type { Response } from 'express';
import { SiteStream } from './stream.js';
import { ProjectModel } from '../types/project.js';
import { getFallbackModelKeys } from '../config/modelConfig.js';
import { isLightSurface, normalizeHex } from '../design/charter.js';
import { fetchBrandAsset } from '../utils/brandAsset.js';
import { ChatLogger } from '../utils/logger.js';
import { ResilientStream } from '../utils/resilientStream.js';
import { CATALOG } from './catalog.js';
import { configureDesignSystem } from './designConfig.js';
import { authorComponent, AuthoringContext, authorSystemPrompt, footerPrompt, headerPrompt, inventedNames, ReviewContext, sectionPrompt } from './authoring.js';
import { themeColorsFromCss } from './autocorrect.js';
import { importPolicy, Issue, renderRemarks } from './repair.js';
import { createFactGuard, stripSentences } from './factGuard.js';
import { designManifest, ManifestPage, ManifestSection, SiteManifest } from './manifest.js';
import { ModelCaller } from './modelCaller.js';
import { createApiMediaClient, MediaClient } from './media/mediaClient.js';
import { AssetDecision, directMedia, MediaSlot } from './media/mediaDirector.js';
import { createLimiter, MediaAsset, produceMedia } from './media/mediaPipeline.js';
import { buildSiteScaffold, renderPage, renderPageShells } from './project.js';
import { renderBrandModule, renderDataModule, renderMediaModule, renderSeo } from './siteData.js';
import { detectSiteLanguage, readSiteFacts, renderFacts } from './siteFacts.js';
import { FUNCTIONAL_DEPENDENCIES, SITE_ENGINE_ID } from './template.js';

/** Composants écrits en même temps. */
const CONCURRENCY = 4;

export interface SiteBuildInput {
  projectData: ProjectModel;
  language: string;
  /** La demande telle qu'écrite (brief de l'atelier ou message de l'utilisateur). */
  request: string;
  model: string;
  userId: string | null;
  /** Le socle est-il déjà monté dans l'espace de travail ? Sinon, il part dans le flux. */
  scaffoldMounted: boolean;
  /** La session de l'utilisateur, relayée à l'API IDEM pour les médias. */
  credentials?: Record<string, string>;
  /** Un client de médias déjà construit (bancs d'essai) ; sinon celui de l'API IDEM. */
  mediaClient?: MediaClient;
}

/** Le moteur prend-il ce tour ? Le premier tour d'un site, quand il y a un projet. */
export function shouldGenerateSite(options: {
  target: string;
  isFirstTurn: boolean;
  projectData?: ProjectModel;
  outOfBand?: string;
}): boolean {
  return options.target === 'site' && options.isFirstTurn && !!options.projectData && !options.outOfBand?.trim();
}

/** Le motif de la charte sur fond clair : un visuel calme quand une section en veut un sans photo. */
async function resolveBrandPattern(projectData: ProjectModel): Promise<{ svg: string; ground: string; tile: number } | null> {
  const branding = (projectData.analysisResultModel?.branding ?? {}) as Record<string, any>;
  const items: any[] = Array.isArray(branding.patterns?.items) ? branding.patterns.items : [];
  for (const item of items) {
    const ground = normalizeHex(item?.ground);
    if (!ground || !isLightSurface(ground) || typeof item?.url !== 'string') continue;
    const asset = await fetchBrandAsset(item.url).catch(() => null);
    const svg = asset?.text?.trim();
    if (!svg || !/^(<\?xml[\s\S]*?\?>\s*)?<svg[\s>]/i.test(svg)) continue;
    return { svg, ground, tile: Math.min(320, Math.max(48, Number(item.tile) || 160)) };
  }
  return null;
}

/** Les emplacements visuels du manifeste. */
function mediaSlotsOf(manifest: SiteManifest): MediaSlot[] {
  const slots: MediaSlot[] = [];
  for (const page of manifest.pages) {
    page.sections.forEach((section, index) => {
      if (section.visual === 'none') return;
      const opening = index === 0;
      slots.push({
        id: mediaKey(page, section),
        pageLabel: page.label,
        brief: section.brief,
        role: section.visual === 'video' ? 'showcase' : opening ? 'hero' : 'story',
        aspect: section.visual === 'video' || opening ? '16:9' : '4:3',
        required: false,
        count: 1,
        videoAllowed: section.visual === 'video',
        overlay: false,
      });
    });
  }
  return slots;
}

const mediaKey = (page: ManifestPage, section: ManifestSection) => `${page.key}-${section.id}`;

const KIND_LABEL: Record<MediaAsset['kind'], string> = {
  image: 'photo',
  drawing: 'illustration',
  video: 'vidéo',
  pattern: 'motif de la charte',
};

/** Le thème en une ligne, pour les auteurs. */
function themeSummary(config: Record<string, any>): string {
  const t = config.tokens ?? {};
  const c = config.components ?? {};
  return [
    `Polices : ${t.typography?.headingFont} (titres), ${t.typography?.bodyFont} (texte).`,
    `Rayon de base ${t.radius?.base ?? '—'}, ombres « ${t.elevation?.style ?? 'soft'} », densité ${config.appearance?.density}.`,
    `Boutons « ${c.button?.variant} », cartes « ${c.card?.variant} », champs « ${c.input?.style} ».`,
    `Mouvement « ${config.motion?.intensity} ».`,
  ].join(' ');
}

export function createSiteEngineStream(input: SiteBuildInput): ResilientStream {
  return {
    async pipeDataStreamToResponse(res: Response): Promise<void> {
      const startedAt = Date.now();
      const { projectData, request, model, userId } = input;
      const language = detectSiteLanguage(
        [request, projectData.description, (projectData as { longDescription?: string }).longDescription].filter(Boolean).join('\n'),
        input.language
      );
      const fr = language === 'fr';

      const abort = new AbortController();
      res.on('close', () => {
        if (!res.writableEnded) abort.abort();
      });

      const facts = readSiteFacts(projectData, language);
      const factsText = renderFacts(facts, language);
      const writer = process.env.SITE_WRITER_MODEL?.trim();
      const caller = new ModelCaller(writer && getFallbackModelKeys(writer).includes(writer) ? writer : model, userId, abort.signal);
      const usage = () => ({ promptTokens: caller.promptTokens, completionTokens: caller.completionTokens });

      const stream = new SiteStream(res);
      stream.open(model);
      stream.text(
        fr
          ? `Je conçois le site de ${facts.name} : son architecture et son identité visuelle, puis chaque section.\n\n`
          : `I'm designing the ${facts.name} website: its structure and visual identity, then each section.\n\n`
      );
      stream.text(`<boltArtifact id="idem-site" title="${facts.name.replace(/["<>]/g, '')}">\n`);

      // Les fichiers du site propres au projet, tels que l'aperçu les aura :
      // chaque composant y est monté avant d'être accepté (`renderCheck`).
      const siteFiles: Record<string, string> = {};
      const emit = (path: string, content: string) => {
        siteFiles[path] = content;
        stream.file(path, content);
      };

      // Socle absent (l'atelier n'a pas pu le monter) : il part dans le flux.
      if (!input.scaffoldMounted) {
        const scaffold = buildSiteScaffold(projectData, language);
        for (const [path, content] of Object.entries(scaffold.files)) emit(path, content);
      } else {
        // Monté par l'atelier : la marque n'en change que la source du logo, pas l'exécution.
        siteFiles['src/site/brand.tsx'] = renderBrandModule(projectData, facts.name);
      }

      // Opération A : architecture et design system, en parallèle.
      stream.note(fr ? "Je conçois l'architecture du site et son design system" : 'Designing the site structure and its design system');
      const [architecture, design, pattern] = await Promise.all([
        designManifest({ facts, factsText, request, language, caller }),
        configureDesignSystem({ projectData, facts, request, caller }),
        resolveBrandPattern(projectData).catch(() => null),
      ]);
      if (abort.signal.aborted) return;

      const manifest = architecture.manifest;
      if (!manifest) {
        ChatLogger.error('SITE_ENGINE', "Aucun manifeste exploitable : génération arrêtée");
        stream.text('</boltArtifact>\n');
        stream.close(
          usage(),
          architecture.providerDown
            ? fr
              ? "Le fournisseur IA est momentanément saturé. Le site n'a pas été généré : relancez dans quelques instants."
              : 'The AI provider is temporarily overloaded. The site was not generated: please try again in a moment.'
            : fr
              ? "Le modèle n'a pas pu concevoir l'architecture du site (réponse mal formée à chaque essai). Rien n'a été modifié : relancez la génération, ou choisissez un autre modèle."
              : 'The model could not design the site structure (malformed answer on every attempt). Nothing was changed: start again, or pick another model.'
        );
        return;
      }

      // Les briefs de l'architecte guident les auteurs : un détail inventé
      // (délai, moyen de paiement, promesse) y serait recopié dans le site. Les
      // phrases qui en portent un sont retirées avant que quiconque les lise.
      const check = createFactGuard(`${factsText}\n${request}`, language);
      let cleaned = 0;
      const clean = (text: string, fallback: string) => {
        const invented = [...check({ texts: [text] }), ...inventedNames([text], `${factsText}\n${request}`)];
        if (!invented.length) return text;
        cleaned += invented.length;
        const kept = String(stripSentences(text, invented) ?? '').trim();
        return kept || fallback;
      };
      for (const page of manifest.pages) {
        for (const section of page.sections) section.brief = clean(section.brief, page.purpose || page.label);
      }
      manifest.header = clean(manifest.header, '');
      manifest.footer = clean(manifest.footer, '');
      if (cleaned) ChatLogger.info('SITE_ENGINE', 'Briefs nettoyés des détails absents des faits', { items: cleaned });

      // Opération B : le design system compilé, puis les faits et les documents.
      for (const [path, content] of Object.entries(design.files)) emit(path, content);
      stream.note(
        fr
          ? `Design system appliqué : ${design.compiled.config.tokens.typography.headingFont} et ${design.compiled.config.tokens.typography.bodyFont}, ${manifest.pages.length} page${manifest.pages.length > 1 ? 's' : ''} (${manifest.pages.map((page) => page.label).join(', ')})`
          : `Design system applied: ${design.compiled.config.tokens.typography.headingFont} and ${design.compiled.config.tokens.typography.bodyFont}, ${manifest.pages.length} page${manifest.pages.length > 1 ? 's' : ''} (${manifest.pages.map((page) => page.label).join(', ')})`
      );

      emit('src/site/data.ts', renderDataModule(facts, manifest, language));
      stream.file('src/site/seo.json', renderSeo(facts, manifest, language));
      emit('src/site/media.ts', renderMediaModule({}));
      if (pattern) stream.file('public/brand/pattern.svg', `${pattern.svg}\n`);
      const shells = renderPageShells({
        manifest,
        language,
        siteName: facts.name,
        description: facts.description.slice(0, 160),
        themeColor: design.compiled.config.tokens.colors.primary,
      });
      for (const [path, content] of Object.entries(shells)) stream.file(path, content);

      // Les visuels : choisis par l'agent média, produits pendant que les composants s'écrivent.
      const mediaEnabled = (process.env.SITE_MEDIA ?? 'on').toLowerCase() !== 'off';
      const slots = mediaEnabled ? mediaSlotsOf(manifest) : [];
      const produced: Record<string, MediaAsset[]> = {};
      const mediaBySlot = new Map<string, Promise<MediaAsset[]>>();

      if (slots.length) {
        stream.note(fr ? 'Je choisis les visuels de chaque section' : 'Choosing the visuals for each section');
        const client =
          input.mediaClient ?? createApiMediaClient({ credentials: input.credentials ?? {}, projectId: projectData.id, signal: abort.signal });
        const decisions: AssetDecision[] = await directMedia({
          slots,
          facts,
          style: design.mediaStyle,
          caller,
          language,
          hasPattern: !!pattern,
          maxGenerated: Number(process.env.SITE_MEDIA_MAX_GENERATED ?? 4),
          allowVideo: (process.env.SITE_MEDIA_VIDEO ?? 'on').toLowerCase() !== 'off',
        });
        const limit = createLimiter(2);
        const context = {
          client,
          caller,
          facts,
          style: design.mediaStyle,
          language,
          pattern: pattern ? { src: '/brand/pattern.svg', ground: pattern.ground, tile: pattern.tile } : null,
          note: (text: string) => !abort.signal.aborted && stream.note(text),
          writeFile: (path: string, content: string) => !abort.signal.aborted && stream.file(path, content),
          limit,
        };
        for (const slot of slots) {
          const decision = decisions.find((item) => item.slot === slot.id);
          if (!decision) continue;
          mediaBySlot.set(
            slot.id,
            produceMedia(slot, decision, context)
              .catch((error) => {
                ChatLogger.warn('SITE_MEDIA', `${slot.id} : échec inattendu`, { message: (error as Error).message });
                return [] as MediaAsset[];
              })
              .then((assets) => {
                if (assets.length && !abort.signal.aborted) {
                  produced[slot.id] = assets;
                  emit('src/site/media.ts', renderMediaModule(produced));
                }
                return assets;
              })
          );
        }
      }

      // Les auteurs : un composant par tâche, avec le contrat des composants retenus.
      const ctx: AuthoringContext = {
        facts,
        factsText,
        manifest,
        language,
        components: manifest.components,
        themeSummary: themeSummary(design.compiled.config),
      };
      const system = authorSystemPrompt(ctx);
      const reference = `${factsText}\n${request}`;
      const review: ReviewContext = {
        policy: importPolicy(manifest.dependencies),
        check,
        reference,
        theme: themeColorsFromCss(design.compiled.css),
        siteFiles: () => siteFiles,
      };

      const issues: Issue[] = [];
      const valid = new Set<string>();
      const limit = createLimiter(CONCURRENCY);

      const write = async (
        path: string,
        label: string,
        display: string,
        prompt: string,
        props?: Record<string, unknown>
      ): Promise<boolean> => {
        if (abort.signal.aborted) return false;
        const authored = await authorComponent({ caller, label, system, prompt, review, language, target: { path, props } });
        if (abort.signal.aborted) return false;
        if (authored.removed.length) ChatLogger.info('SITE_ENGINE', `${label} : phrases non vérifiées retirées`, { removed: authored.removed });
        if (authored.code) stream.file(path, authored.code);
        if (!authored.valid) issues.push({ path, display, broken: true, unverified: [] });
        if (!authored.valid) {
          ChatLogger.warn('SITE_ENGINE', `${label} : conservé sans être affiché`, { problems: authored.problems });
          return false;
        }
        valid.add(path);
        return true;
      };

      stream.note(fr ? "J'écris l'en-tête, le pied de page et chaque section" : 'Writing the header, the footer and every section');
      const header = limit(() =>
        write('src/components/site/SiteHeader.tsx', 'header', fr ? "l'en-tête" : 'the header', headerPrompt(ctx, request), {
          current: manifest.pages[0]?.path ?? '/',
        })
      );
      const footer = limit(() =>
        write('src/components/site/SiteFooter.tsx', 'footer', fr ? 'le pied de page' : 'the footer', footerPrompt(ctx, request))
      );

      const pageJobs = manifest.pages.map(async (page) => {
        const results = await Promise.all(
          page.sections.map(async (section, index) => {
            const key = mediaKey(page, section);
            const assets = (await mediaBySlot.get(key)) ?? [];
            const ok = await limit(() =>
              write(
                `src/sections/${page.key}/${section.component}.tsx`,
                `${page.key}/${section.id}`,
                fr ? `la section « ${section.id} » (${page.label})` : `the "${section.id}" section (${page.label})`,
                sectionPrompt(
                  ctx,
                  {
                    page,
                    section,
                    opening: index === 0,
                    ...(assets.length
                      ? { mediaKey: key, mediaKind: KIND_LABEL[assets[0].kind], mediaAspect: index === 0 ? '16:9' : '4:3' }
                      : {}),
                  },
                  request
                )
              )
            );
            return { name: section.component, ok };
          })
        );
        return { page, results };
      });

      const [pages] = await Promise.all([Promise.all(pageJobs), header, footer]);
      if (abort.signal.aborted) return;

      // L'assemblage : chaque page importe ses sections écrites, dans l'ordre.
      // Un en-tête ou un pied de page qui ne compile pas n'est pas importé.
      const hasHeader = valid.has('src/components/site/SiteHeader.tsx');
      const hasFooter = valid.has('src/components/site/SiteFooter.tsx');
      for (const { page, results } of pages) {
        stream.file(
          `src/pages/${page.key}.tsx`,
          renderPage(page, results, { header: hasHeader, footer: hasFooter })
        );
      }

      if (manifest.dependencies.length) stream.command('shell', `npm install ${manifest.dependencies.join(' ')}`);
      stream.command('start', 'npm run dev');
      stream.text('</boltArtifact>\n');

      // Ce qui reste à corriger, en clair, avec la marque du bouton « Corriger ».
      const remarks = renderRemarks(issues, language);
      if (remarks) stream.text(remarks);

      const sections = manifest.pages.reduce((total, page) => total + page.sections.length, 0);
      ChatLogger.success('SITE_ENGINE', 'Site généré', {
        generator: SITE_ENGINE_ID,
        pages: manifest.pages.length,
        sections: `${sections - issues.filter((issue) => issue.broken && issue.path.startsWith('src/sections/')).length}/${sections}`,
        designFromModel: design.fromModel,
        designErrors: design.compiled.report.errors.length,
        components: manifest.components,
        catalog: CATALOG.length,
        media: Object.keys(produced).length,
        promptTokens: caller.promptTokens,
        completionTokens: caller.completionTokens,
        seconds: Math.round((Date.now() - startedAt) / 1000),
      });

      stream.close(usage());
    },
  };
}
