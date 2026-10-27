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
import { marker } from './redesign/ask.js';
import { redesignArchitect, redesignDesign, redesignFacts } from './redesign/brief.js';
import { prepareRedesign, RedesignContext } from './redesign/flow.js';

/** Composants écrits en même temps. */
const CONCURRENCY = 4;

export interface SiteBuildInput {
  /** Le projet ; absent seulement pour une refonte qui le crée (`redesign`). */
  projectData?: ProjectModel;
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
  /**
   * Une REFONTE d'un site existant (réponse cliquée à la question de `redesign/ask.ts`) : le site est lu et
   * devient le projet (ou complète celui qui est ouvert), puis le moteur le refait.
   */
  redesign?: { url: string; choice: 'identity' | 'direct'; consent: boolean; creativity?: string };
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
      const { request, model, userId } = input;

      const abort = new AbortController();
      res.on('close', () => {
        if (!res.writableEnded) abort.abort();
      });

      const stream = new SiteStream(res);
      stream.open(model);

      // Une refonte : le site est lu et devient le projet avant que quoi que ce soit ne s'écrive. Ses
      // étapes s'affichent dans le même encadré que celles de la génération.
      let projectData = input.projectData;
      let redesign: RedesignContext | undefined;
      if (input.redesign) {
        const asked = input.language !== 'en';
        let host = input.redesign.url;
        try {
          host = new URL(input.redesign.url).hostname.replace(/^www\./, '');
        } catch {
          /* adresse gardée telle quelle */
        }
        stream.text(asked ? `Je lis ${host} pour le refaire.\n\n` : `Reading ${host} to redesign it.\n\n`);
        stream.text(`<boltArtifact id="idem-site" title="${host.replace(/["<>]/g, '')}">\n`);
        const prepared = await prepareRedesign({
          stream,
          signal: abort.signal,
          url: input.redesign.url,
          choice: input.redesign.choice,
          consent: input.redesign.consent,
          fr: asked,
          credentials: input.credentials ?? {},
          projectId: input.projectData?.id,
          creativity: input.redesign.creativity,
        });
        if (abort.signal.aborted) return;
        if ('stop' in prepared) {
          stream.text('</boltArtifact>\n');
          stream.text(prepared.stop);
          stream.close({ promptTokens: 0, completionTokens: 0 });
          return;
        }
        projectData = prepared.projectData;
        redesign = prepared.redesign;
      }
      if (!projectData) {
        stream.close({ promptTokens: 0, completionTokens: 0 }, 'project_required');
        return;
      }

      const language = detectSiteLanguage(
        [request, projectData.description, (projectData as { longDescription?: string }).longDescription, redesign?.content.paragraphs.slice(0, 3).join(' ')].filter(Boolean).join('\n'),
        redesign?.content.language === 'en' || redesign?.content.language === 'fr' ? redesign.content.language : input.language
      );
      const fr = language === 'fr';

      const facts = readSiteFacts(projectData, language);
      // Refonte : ce que le site dit aujourd'hui rejoint les faits — les auteurs le reprennent, le garde-fou
      // l'accepte (un téléphone ou une adresse du site n'est pas une invention).
      const factsText = redesign ? `${renderFacts(facts, language)}\n\n${redesignFacts(redesign.content, fr)}` : renderFacts(facts, language);
      const writer = process.env.SITE_WRITER_MODEL?.trim();
      const caller = new ModelCaller(writer && getFallbackModelKeys(writer).includes(writer) ? writer : model, userId, abort.signal);
      const usage = () => ({ promptTokens: caller.promptTokens, completionTokens: caller.completionTokens });

      if (!redesign) {
        stream.text(
          fr
            ? `Je conçois le site de ${facts.name} : son architecture et son identité visuelle, puis chaque section.\n\n`
            : `I'm designing the ${facts.name} website: its structure and visual identity, then each section.\n\n`
        );
        stream.text(`<boltArtifact id="idem-site" title="${facts.name.replace(/["<>]/g, '')}">\n`);
      }

      // Les fichiers du site propres au projet, tels que l'aperçu les aura :
      // chaque composant y est monté avant d'être accepté (`renderCheck`).
      const siteFiles: Record<string, string> = {};
      const emit = (path: string, content: string) => {
        siteFiles[path] = content;
        stream.file(path, content);
      };

      // Socle absent (l'atelier n'a pas pu le monter) : il part dans le flux. Une refonte l'y met toujours :
      // celui de l'atelier a été monté avant que le projet (et son logo) n'existe.
      const scaffoldMounted = input.scaffoldMounted && !redesign;
      if (!scaffoldMounted) {
        const scaffold = buildSiteScaffold(projectData, language);
        for (const [path, content] of Object.entries(scaffold.files)) emit(path, content);
      } else {
        // Monté par l'atelier : la marque n'en change que la source du logo, pas l'exécution.
        siteFiles['src/site/brand.tsx'] = renderBrandModule(projectData, facts.name);
      }

      // Opération A : architecture et design system, en parallèle.
      stream.note(fr ? "Je conçois l'architecture du site et son design system" : 'Designing the site structure and its design system');
      const [architecture, design, pattern] = await Promise.all([
        designManifest({ facts, factsText, request, language, caller, redesign: redesign ? redesignArchitect(redesign.content, fr) : undefined }),
        configureDesignSystem({ projectData, facts, request, caller, redesign: redesign ? redesignDesign(redesign.content, fr) : undefined }),
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

      // Refonte : les photos du site gardent leur place — l'ouverture d'abord, puis les sections qui attendent
      // une photo. Les emplacements restants passent par l'agent média comme d'habitude.
      if (redesign?.content.images.length && slots.length) {
        const own = [...redesign.content.images];
        const order = [...slots].sort((a, b) => (a.role === 'hero' ? -1 : b.role === 'hero' ? 1 : 0));
        for (const slot of order) {
          if (!own.length) break;
          if (slot.videoAllowed && slot.role !== 'hero') continue;
          const src = own.shift()!;
          const asset: MediaAsset = { kind: 'image', src, alt: facts.name, origin: 'site' };
          produced[slot.id] = [asset];
          mediaBySlot.set(slot.id, Promise.resolve([asset]));
        }
        emit('src/site/media.ts', renderMediaModule(produced));
        stream.note(fr ? `Je reprends ${Object.keys(produced).length} photo${Object.keys(produced).length > 1 ? 's' : ''} de votre site` : `Reusing ${Object.keys(produced).length} photo${Object.keys(produced).length > 1 ? 's' : ''} from your site`);
      }
      const open = slots.filter((slot) => !mediaBySlot.has(slot.id));

      if (open.length) {
        stream.note(fr ? 'Je choisis les visuels de chaque section' : 'Choosing the visuals for each section');
        const client =
          input.mediaClient ?? createApiMediaClient({ credentials: input.credentials ?? {}, projectId: projectData.id, signal: abort.signal });
        const decisions: AssetDecision[] = await directMedia({
          slots: open,
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
        for (const slot of open) {
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

      // Socle parti dans le flux : rien n'est installé dans l'aperçu, tout l'est ici.
      if (!scaffoldMounted) stream.command('shell', manifest.dependencies.length ? `npm install && npm install ${manifest.dependencies.join(' ')}` : 'npm install');
      else if (manifest.dependencies.length) stream.command('shell', `npm install ${manifest.dependencies.join(' ')}`);
      stream.command('start', 'npm run dev');

      // Identité visuelle pro : la charte, lancée avant le site, est attendue avant de conclure.
      let charterProblem: string | null = null;
      if (redesign?.charter) {
        stream.note(fr ? 'Je termine votre charte graphique' : 'Finishing your brand guidelines');
        charterProblem = await redesign.charter;
        if (abort.signal.aborted) return;
      }
      stream.text('</boltArtifact>\n');

      // Ce qui reste à corriger, en clair, avec la marque du bouton « Corriger ».
      const remarks = renderRemarks(issues, language);
      if (remarks) stream.text(remarks);

      if (redesign) {
        const lines = fr
          ? [
              `\nVotre site est refait : ${manifest.pages.length} page${manifest.pages.length > 1 ? 's' : ''}, avec votre marque et ${Object.values(produced).filter((a) => a[0]?.origin === 'site').length ? 'vos photos' : 'de nouveaux visuels'}, des textes réécrits pour vos clients.`,
              redesign.choice === 'identity' && !charterProblem ? 'Votre charte graphique est prête dans votre projet IDEM.' : '',
              charterProblem ?? '',
              'Demandez-moi une retouche quand vous voulez.',
            ]
          : [
              `\nYour site is redesigned: ${manifest.pages.length} page${manifest.pages.length > 1 ? 's' : ''}, with your brand and ${Object.values(produced).filter((a) => a[0]?.origin === 'site').length ? 'your photos' : 'new visuals'}, copy rewritten for your customers.`,
              redesign.choice === 'identity' && !charterProblem ? 'Your brand guidelines are ready in your IDEM project.' : '',
              charterProblem ?? '',
              'Ask me for any change whenever you like.',
            ];
        stream.text(`${lines.filter(Boolean).join(' ')}\n`);
      }
      // Ce qui vient de se passer, pour l'atelier : le projet auquel se rattacher (refonte qui l'a créé) et le
      // geste à signaler à la boucle IDEM (qui proposera la suite : faire connaître le site, le mettre en ligne…).
      if (redesign?.created && projectData.id) stream.text(marker('project', { id: projectData.id, name: projectData.name }));
      if (projectData.id) {
        stream.text(marker('journey', { event: redesign ? 'site.redesigned' : 'site.generated', projectId: projectData.id }));
        if (redesign?.choice === 'identity' && !charterProblem) stream.text(marker('journey', { event: 'charter.generated', projectId: projectData.id }));
      }

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
