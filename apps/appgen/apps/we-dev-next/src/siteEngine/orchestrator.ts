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
import { designManifest, ManifestPage, ManifestSection, SiteManifest, originPagesOf } from './manifest.js';
import { ModelCaller, accountLimitMessage } from './modelCaller.js';
import { createApiMediaClient, MediaClient } from './media/mediaClient.js';
import { AssetDecision, directMedia, MediaSlot } from './media/mediaDirector.js';
import { createLimiter, MediaAsset, produceMedia } from './media/mediaPipeline.js';
import { buildSiteScaffold, renderPage, renderPageShells, shellMessages } from './project.js';
import { renderBrandModule, renderDataModule, renderMediaModule, renderSeo, siteDataOf } from './siteData.js';
import { collectMessages, dataMessages, languageLabel, localizeCode, pseudoLocaleFiles, renderI18nFiles, translateCatalog, withHeaderLanguageSwitcher, withLanguageSwitcher } from './i18n.js';
import { renderCheck } from './renderCheck.js';
import { detectSiteLanguage, readSiteFacts, renderFacts, writtenInOtherLanguage } from './siteFacts.js';
import { FUNCTIONAL_DEPENDENCIES, SITE_ENGINE_ID, templateFiles } from './template.js';
import { marker } from '../commands/choices.js';
import { redesignArchitect, redesignDesign, redesignFacts, RedesignFocus } from './redesign/brief.js';
import { prepareRedesign, RedesignContext } from './redesign/flow.js';
import { fetchSiteContent } from './redesign/idemClient.js';
import { MANIFEST_PATH, PlanTracker, readSavedDesign, remaining, SavedDesign, SitePlan } from './plan.js';
import { DESIGN_SYSTEM_PATHS } from './template.js';
import type { DesignOutcome } from './designConfig.js';
import { inventoryFacts, inventoryOutline, inventoryText, InventorySection, linkMapper, sectionIndex, sourceContent } from './redesign/inventory.js';

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
   * Une REFONTE d'un site existant (réponse cliquée aux questions de `commands/workflows/redesign.ts`) : le site est lu et
   * devient le projet (ou complète celui qui est ouvert), puis le moteur le refait.
   */
  redesign?: {
    url: string;
    choice: 'identity' | 'direct';
    focus?: RedesignFocus;
    consent: boolean;
    creativity?: string;
    /** Reprise après la question des couleurs (et des langues) : le site est déjà relevé, le projet existe. */
    resume?: { projectId: string; colors: 'site' | 'logo'; languages?: string[]; billed?: boolean };
  };
  /**
   * Reprise d'une génération interrompue (« continue ») : son plan et les fichiers déjà écrits. Ce qui est coché
   * n'est ni refait ni refacturé ; sans manifeste enregistré, la génération repart de la demande du plan.
   */
  resume?: { plan: SitePlan; files: Record<string, string> };
}

/** Le design system tel que la génération interrompue l'avait posé, relu dans ses fichiers. */
function savedDesignOutcome(files: Record<string, string>, saved: SavedDesign): DesignOutcome {
  const config = JSON.parse(files[DESIGN_SYSTEM_PATHS.source] ?? '{}');
  return {
    files: {},
    compiled: { config, css: files[DESIGN_SYSTEM_PATHS.css] ?? '', componentConfig: {}, fonts: [], report: { errors: [], derived: [], adjusted: [], files: [] } },
    fromModel: true,
    enforced: [],
    mediaStyle: saved.mediaStyle,
  } as DesignOutcome;
}

/** Les visuels déjà produits (`src/site/media.ts`), regroupés par emplacement (`clé`, `clé-2`…). */
function savedMedia(files: Record<string, string>, keys: string[]): Record<string, MediaAsset[]> {
  try {
    const flat = JSON.parse(files['src/site/media.ts']?.match(/=\s*(\{[\s\S]*\});\s*$/)?.[1] ?? '{}') as Record<string, MediaAsset>;
    const out: Record<string, MediaAsset[]> = {};
    for (const key of keys) {
      if (!flat[key]) continue;
      out[key] = [flat[key]];
      for (let i = 2; flat[`${key}-${i}`]; i++) out[key].push(flat[`${key}-${i}`]);
    }
    return out;
  } catch {
    return {};
  }
}

/** Au-delà, une langue de plus coûte plus qu'elle ne rapporte à un site vitrine. */
const MAX_LANGUAGES = Math.max(1, Number(process.env.SITE_MAX_LANGUAGES ?? 6));

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

/** Ce que la fin d'une refonte attend encore la charte, une fois le site écrit (au-delà, elle finit dans IDEM). */
const CHARTER_GRACE_MS = Number(process.env.SITE_CHARTER_GRACE_MS) || 3 * 60_000;

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
          focus: input.redesign.focus ?? 'all',
          consent: input.redesign.consent,
          fr: asked,
          credentials: input.credentials ?? {},
          projectId: input.projectData?.id,
          creativity: input.redesign.creativity,
          resume: input.redesign.resume,
        });
        if (abort.signal.aborted) return;
        // Une décision revient à l'utilisateur (les couleurs du logo ou celles du site) : on la lui pose.
        if ('ask' in prepared) {
          stream.text('</boltArtifact>\n');
          stream.text(`${prepared.ask.text}\n\n`);
          stream.text(marker('choices', { ...prepared.ask.choices, context: { ...prepared.ask.choices.context, original: request } }));
          stream.close({ promptTokens: 0, completionTokens: 0 });
          return;
        }
        if ('stop' in prepared) {
          stream.text('</boltArtifact>\n');
          stream.text(prepared.stop);
          stream.close({ promptTokens: 0, completionTokens: 0 });
          return;
        }
        projectData = prepared.projectData;
        redesign = prepared.redesign;
        // Le projet né de cette refonte, annoncé dès maintenant : l'atelier s'y rattache et y enregistre le site
        // pendant qu'il s'écrit (annoncé à la fin seulement, une actualisation en cours de route perdait tout).
        if (redesign.created && projectData.id) stream.text(marker('project', { id: projectData.id, name: projectData.name }));
      }
      // Reprise : le manifeste et le design system sont relus dans le projet ; une refonte retrouve le relevé de
      // l'ancien site dans IDEM (rien n'est relu sur le site lui-même, rien n'est refacturé).
      const saved = input.resume ? readSavedDesign(input.resume.files) : null;
      const resuming = input.resume && saved ? input.resume : undefined;
      if (resuming?.plan.redesign && !redesign) {
        const plan = resuming.plan.redesign;
        try {
          const content = await fetchSiteContent(plan.projectId, input.credentials ?? {}, abort.signal);
          redesign = { content, choice: plan.choice, focus: plan.focus, created: false };
        } catch (error) {
          ChatLogger.warn('SITE_ENGINE', 'Reprise : relevé du site introuvable', { message: (error as Error).message });
        }
      }
      if (!projectData) {
        stream.close({ promptTokens: 0, completionTokens: 0 }, 'project_required');
        return;
      }

      // Une refonte garde la langue de l'ancien site, lue sur ses pages : devinée sur les textes (la demande, la
      // description du projet), un site français dont le projet était décrit en anglais partait en anglais, avec
      // le français en seconde langue — menu en anglais, contenu en français.
      const siteLanguage = redesign?.content.inventory?.language || redesign?.content.language;
      const language = resuming
        ? resuming.plan.language
        : siteLanguage === 'fr' || siteLanguage === 'en'
          ? siteLanguage
          : detectSiteLanguage(
              [request, projectData.description, (projectData as { longDescription?: string }).longDescription, redesign?.content.paragraphs.slice(0, 3).join(' ')].filter(Boolean).join('\n'),
              input.language
            );
      const fr = language === 'fr';

      const facts = readSiteFacts(projectData, language);
      // Refonte : la fiche du projet a pu être rédigée dans une autre langue que le site (première lecture d'un site
      // passée par un traducteur automatique, puis projet réutilisé). Ses textes repartiraient tels quels dans le
      // site — description en anglais sur un site français. Le site parle alors pour lui-même, dans sa langue.
      if (redesign) {
        const own = (redesign.content.voice.valueProposition || redesign.content.description || redesign.content.paragraphs[0] || '').trim();
        if (own && writtenInOtherLanguage(facts.description, language)) facts.description = own.slice(0, 190);
        if (facts.story && writtenInOtherLanguage(facts.story, language)) facts.story = redesign.content.paragraphs.slice(0, 4).join('\n\n').slice(0, 3000);
      }
      // Refonte : ce que le site dit aujourd'hui rejoint les faits — les auteurs le reprennent, le garde-fou
      // l'accepte (un téléphone ou une adresse du site n'est pas une invention).
      const inventory = redesign?.content.inventory;
      const factsText = redesign
        ? `${renderFacts(facts, language)}\n\n${redesignFacts(redesign.content, fr)}${inventory ? `\n\n${inventoryFacts(inventory, fr)}` : ''}`
        : renderFacts(facts, language);
      // Tout le texte de l'ancien site : la référence du garde-fou (rien de ce qu'il dit n'est une invention).
      const sourceText = inventory ? `\n${inventoryText(inventory)}` : '';
      const writer = process.env.SITE_WRITER_MODEL?.trim();
      const caller = new ModelCaller(writer && getFallbackModelKeys(writer).includes(writer) ? writer : model, userId, abort.signal);
      const usage = () => ({ promptTokens: caller.promptTokens, completionTokens: caller.completionTokens });

      if (resuming) {
        const left = remaining(resuming.plan).length;
        stream.text(
          fr
            ? `Je reprends la génération de ${facts.name} là où elle s'était arrêtée : ${left} étape${left > 1 ? 's' : ''} sur ${resuming.plan.steps.length} restent à faire, le reste est gardé tel quel.\n\n`
            : `Resuming the ${facts.name} generation where it stopped: ${left} of ${resuming.plan.steps.length} step${resuming.plan.steps.length > 1 ? 's' : ''} left, everything else is kept as is.\n\n`
        );
        stream.text(`<boltArtifact id="idem-site-resume-${Date.now().toString(36)}" title="${facts.name.replace(/["<>]/g, '')}">\n`);
      } else if (!redesign) {
        stream.text(
          fr
            ? `Je conçois le site de ${facts.name} : son architecture et son identité visuelle, puis chaque section.\n\n`
            : `I'm designing the ${facts.name} website: its structure and visual identity, then each section.\n\n`
        );
        stream.text(`<boltArtifact id="idem-site" title="${facts.name.replace(/["<>]/g, '')}">\n`);
      }

      // Le plan de la génération, écrit avant la première étape et coché au fur et à mesure (`plan.ts`).
      const tracker = resuming
        ? PlanTracker.resume(stream, resuming.plan)
        : PlanTracker.create(stream, {
            request,
            language,
            languages: [language, ...(input.redesign?.resume?.languages ?? [])],
            ...(redesign && input.redesign && projectData.id
              ? { redesign: { projectId: projectData.id, url: input.redesign.url, choice: redesign.choice, focus: redesign.focus } }
              : {}),
            steps: [{ id: 'design', label: fr ? 'Architecture et design system' : 'Structure and design system', status: 'pending' }],
          });

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
      if (resuming) {
        // Les fichiers du site déjà écrits servent au montage de contrôle des composants qui restent.
        for (const [path, content] of Object.entries(resuming.files)) if (/^src\/(site|design-system|i18n)\//.test(path)) siteFiles[path] = content;
      } else if (!scaffoldMounted) {
        const scaffold = buildSiteScaffold(projectData, language);
        for (const [path, content] of Object.entries(scaffold.files)) emit(path, content);
      } else {
        // Monté par l'atelier : la marque n'en change que la source du logo, pas l'exécution.
        siteFiles['src/site/brand.tsx'] = renderBrandModule(projectData, facts.name);
      }

      // Opération A : architecture et design system, en parallèle (relus dans le projet à la reprise).
      if (!resuming) stream.note(fr ? "Je conçois l'architecture du site et son design system" : 'Designing the site structure and its design system');
      const [architecture, design, pattern] = resuming && saved
        ? [{ manifest: saved.manifest, providerDown: false }, savedDesignOutcome(resuming.files, saved), await resolveBrandPattern(projectData).catch(() => null)] as const
        : await Promise.all([
        designManifest({
          facts,
          factsText,
          request,
          language,
          caller,
          redesign: redesign
            ? {
                brief: redesignArchitect(redesign.content, fr, redesign.focus),
                outline: inventory ? inventoryOutline(inventory, fr) : '',
                coverage: { pageCount: inventory?.pages.length ?? 0, sectionIds: inventory?.pages.flatMap((p) => p.sections.map((s) => s.id)) ?? [] },
                pageTitles: inventory?.pages.map((p) => p.title) ?? [],
                pagePaths: inventory?.pages.map((p) => p.path) ?? [],
              }
            : undefined,
        }),
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
          caller.accountLimit
            ? accountLimitMessage(fr)
            : architecture.providerDown
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
      const check = createFactGuard(`${factsText}\n${request}${sourceText}`, language);
      let cleaned = 0;
      const clean = (text: string, fallback: string) => {
        const invented = [...check({ texts: [text] }), ...inventedNames([text], `${factsText}\n${request}${sourceText}`)];
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

      // Les langues du site : celles de l'ancien site (pages vraiment traduites ; celles d'un traducteur automatique
      // seulement si l'utilisateur les a choisies), et celles que la demande réclame. La principale en tête.
      const siteLanguages = resuming ? resuming.plan.languages : [
        language,
        ...(inventory?.languages ?? []).filter((l) => l.via !== 'widget').map((l) => l.code),
        ...(input.redesign?.resume?.languages ?? []),
        ...manifest.languages,
      ]
        .map((code) => code.slice(0, 2).toLowerCase())
        .filter((code, index, all) => /^[a-z]{2}$/.test(code) && all.indexOf(code) === index)
        .slice(0, MAX_LANGUAGES);
      if (!resuming) emit('src/i18n/config.json', renderI18nFiles(language, Object.fromEntries(siteLanguages.map((lang) => [lang, {}])))['src/i18n/config.json']);
      if (siteLanguages.length > 1 && !resuming)
        stream.note(
          fr
            ? `Le site sera en ${siteLanguages.map((lang) => languageLabel(lang, true)).join(', ')} : j'écris en ${languageLabel(language, true)}, puis je traduis`
            : `The site will be in ${siteLanguages.map((lang) => languageLabel(lang, false)).join(', ')}: writing in ${languageLabel(language, false)}, then translating`
        );

      // Refonte : ce que chaque section reprend de l'ancien site, et où mènent désormais ses liens internes. Une
      // section qui reprend des images d'origine en affiche (même si l'architecte n'en demandait pas).
      const sourcesBySection = new Map<string, InventorySection[]>();
      let mapLink = (href: string) => href;
      if (inventory) {
        const index = sectionIndex(inventory);
        for (const page of manifest.pages) {
          for (const section of page.sections) {
            const sources = (section.sources ?? []).map((id) => index.get(id)?.section).filter((x): x is InventorySection => !!x);
            if (!sources.length) continue;
            sourcesBySection.set(mediaKey(page, section), sources);
            if (section.visual === 'none' && sources.some((x) => x.images.length)) section.visual = 'photo';
          }
        }
        mapLink = linkMapper(inventory, (pageIndex) => (manifest.pages.find((p) => p.source === pageIndex) ?? manifest.pages.find((p) => originPagesOf(p).includes(pageIndex)))?.path);
        // Le menu de l'ancien site, repris tel quel : ses entrées, son ordre, ses libellés, vers les nouvelles pages.
        if (!manifest.menu?.length) {
          const menu: { label: string; href: string }[] = [];
          for (const item of inventory.navigation) {
            const href = mapLink(item.href);
            if (href.startsWith('/') && item.label.trim() && !menu.some((entry) => entry.href === href)) menu.push({ label: item.label.trim(), href });
          }
          if (menu.length >= 2) manifest.menu = menu;
        }
      }

      // Le plan complet : chaque composant à écrire, l'assemblage, la traduction. Le manifeste est gardé dans le
      // projet pour qu'une reprise n'ait rien à redemander aux modèles.
      tracker.plan.languages = siteLanguages;
      tracker.add([
        { id: 'src/components/site/SiteHeader.tsx', label: fr ? "L'en-tête" : 'The header', path: 'src/components/site/SiteHeader.tsx' },
        { id: 'src/components/site/SiteFooter.tsx', label: fr ? 'Le pied de page' : 'The footer', path: 'src/components/site/SiteFooter.tsx' },
        ...manifest.pages.flatMap((page) =>
          page.sections.map((section) => {
            const path = `src/sections/${page.key}/${section.component}.tsx`;
            return { id: path, label: `${page.label} · ${section.id}`, path };
          })
        ),
        { id: 'pages', label: fr ? 'Assemblage des pages' : 'Page assembly' },
        ...(siteLanguages.length > 1 ? [{ id: 'translate', label: fr ? `Traduction (${siteLanguages.slice(1).join(', ')})` : `Translation (${siteLanguages.slice(1).join(', ')})` }] : []),
      ]);
      if (!resuming) {
        stream.file(MANIFEST_PATH, `${JSON.stringify({ manifest, mediaStyle: design.mediaStyle, themeSummary: themeSummary(design.compiled.config) } satisfies SavedDesign, null, 2)}\n`);
      }
      tracker.mark('design', 'done');

      // Opération B : le design system compilé, puis les faits et les documents (déjà posés à la reprise).
      if (!resuming) for (const [path, content] of Object.entries(design.files)) emit(path, content);
      if (!resuming) stream.note(
        fr
          ? `Design system appliqué : ${design.compiled.config.tokens.typography.headingFont} et ${design.compiled.config.tokens.typography.bodyFont}, ${manifest.pages.length} page${manifest.pages.length > 1 ? 's' : ''} (${manifest.pages.map((page) => page.label).join(', ')})`
          : `Design system applied: ${design.compiled.config.tokens.typography.headingFont} and ${design.compiled.config.tokens.typography.bodyFont}, ${manifest.pages.length} page${manifest.pages.length > 1 ? 's' : ''} (${manifest.pages.map((page) => page.label).join(', ')})`
      );

      if (!resuming) {
        emit('src/site/data.ts', renderDataModule(facts, manifest, language));
        stream.file('src/site/seo.json', renderSeo(facts, manifest, language));
        emit('src/site/media.ts', renderMediaModule({}));
        if (pattern) stream.file('public/brand/pattern.svg', `${pattern.svg}\n`);
      }
      const shellOptions = {
        manifest,
        language,
        siteName: facts.name,
        description: facts.description.slice(0, 160),
        themeColor: design.compiled.config.tokens.colors.primary,
        // Refonte : le favicon, l'icône et l'image de partage de l'ancien site (recopiés chez nous).
        icons: inventory ? { favicon: inventory.assets.favicon, appleIcon: inventory.assets.appleIcon, ogImage: inventory.assets.ogImage } : undefined,
        languages: siteLanguages,
      };
      if (!resuming) for (const [path, content] of Object.entries(renderPageShells(shellOptions))) stream.file(path, content);

      // Les visuels : choisis par l'agent média, produits pendant que les composants s'écrivent.
      const mediaEnabled = (process.env.SITE_MEDIA ?? 'on').toLowerCase() !== 'off';
      const slots = mediaEnabled ? mediaSlotsOf(manifest) : [];
      const produced: Record<string, MediaAsset[]> = {};
      const mediaBySlot = new Map<string, Promise<MediaAsset[]>>();
      // Reprise : les visuels déjà produits restent ; un composant déjà écrit n'en demande pas d'autre.
      if (resuming) {
        const keys = manifest.pages.flatMap((page) => page.sections.map((section) => mediaKey(page, section)));
        Object.assign(produced, savedMedia(resuming.files, keys));
        for (const [key, assets] of Object.entries(produced)) mediaBySlot.set(key, Promise.resolve(assets));
        for (const page of manifest.pages)
          for (const section of page.sections)
            if (tracker.done(`src/sections/${page.key}/${section.component}.tsx`) && !mediaBySlot.has(mediaKey(page, section))) mediaBySlot.set(mediaKey(page, section), Promise.resolve([]));
      }

      // Refonte : chaque section reprend les images de SES sections d'origine (toutes, galeries comprises) ; seules
      // les sections sans image d'origine qui en demandent une passent par l'agent média (banque ou génération,
      // selon la direction artistique et la cible).
      if (redesign && inventory && !resuming) {
        let reused = 0;
        for (const page of manifest.pages) {
          for (const section of page.sections) {
            const images = (sourcesBySection.get(mediaKey(page, section)) ?? []).flatMap((s) => s.images).slice(0, 12);
            if (!images.length) continue;
            const assets: MediaAsset[] = images.map((image) => ({ kind: 'image', src: image.url, alt: image.alt || facts.name, origin: 'site' }));
            produced[mediaKey(page, section)] = assets;
            mediaBySlot.set(mediaKey(page, section), Promise.resolve(assets));
            reused += assets.length;
          }
        }
        if (reused) {
          emit('src/site/media.ts', renderMediaModule(produced));
          stream.note(fr ? `Je reprends ${reused} image${reused > 1 ? 's' : ''} de votre site, chacune à sa place` : `Reusing ${reused} image${reused > 1 ? 's' : ''} from your site, each in its place`);
        }
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
        languages: siteLanguages,
      };
      const system = authorSystemPrompt(ctx);
      const reference = `${factsText}\n${request}${sourceText}`;
      const review: ReviewContext = {
        policy: importPolicy(manifest.dependencies),
        check,
        reference,
        theme: themeColorsFromCss(design.compiled.css),
        siteFiles: () => siteFiles,
      };

      const issues: Issue[] = [];
      const valid = new Set<string>();
      // Le code accepté de chaque composant, ses textes enveloppés dans `t()` : la source du catalogue des langues.
      const written: Record<string, string> = {};
      const limit = createLimiter(CONCURRENCY);

      const write = async (
        path: string,
        label: string,
        display: string,
        prompt: string,
        props?: Record<string, unknown>
      ): Promise<boolean> => {
        if (abort.signal.aborted) return false;
        // Déjà écrit avant l'interruption : gardé tel quel.
        const kept = resuming?.files[path];
        if (tracker.done(path) && kept) {
          valid.add(path);
          written[path] = kept;
          return true;
        }
        const authored = await authorComponent({ caller, label, system, prompt, review, language, target: { path, props } });
        if (abort.signal.aborted) return false;
        if (authored.removed.length) ChatLogger.info('SITE_ENGINE', `${label} : phrases non vérifiées retirées`, { removed: authored.removed });
        // Chaque site sort prêt à être traduit : textes dans `t()`, liens internes dans `localePath()` (par le code).
        // Un site en plusieurs langues : la version enveloppée est d'abord montée en pseudo-langue ; si elle ne
        // s'affiche plus une fois traduite, le composant garde ses textes en clair (langue principale partout).
        let code = authored.code;
        if (authored.valid && authored.code) {
          const localized = localizeCode(authored.code, path);
          code = localized.code;
          if (localized.changed && siteLanguages.length > 1) {
            const pseudo = await renderCheck({ path, code, props, files: { ...siteFiles, ...pseudoLocaleFiles(localized.texts, templateFiles()['src/i18n/index.ts'] ?? '') } });
            if (pseudo.problems.length) {
              ChatLogger.warn('SITE_I18N', `${label} : textes laissés en clair (le composant casse une fois traduit)`, { problems: pseudo.problems.slice(0, 2) });
              code = authored.code;
            }
          }
        }
        if (code) {
          stream.file(path, code);
          written[path] = code;
        }
        if (!authored.valid) issues.push({ path, display, broken: true, unverified: [] });
        if (!authored.valid) {
          ChatLogger.warn('SITE_ENGINE', `${label} : conservé sans être affiché`, { problems: authored.problems });
          tracker.mark(path, 'failed');
          return false;
        }
        valid.add(path);
        tracker.mark(path, 'done');
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
                    // Les clés de `renderMediaModule` : la 1re garde la clé, les suivantes `clé-2`, `clé-3`…
                    ...(assets.length > 1 ? { mediaList: assets.map((asset, i) => ({ key: i ? `${key}-${i + 1}` : key, alt: asset.alt ?? '' })) } : {}),
                    ...(sourcesBySection.has(key) ? { source: sourceContent(sourcesBySection.get(key)!, mapLink, fr) } : {}),
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
      tracker.mark('pages', 'done');

      // Les dépendances fonctionnelles font partie du socle (et de son instantané) : rien à installer en plus. Un
      // socle parti dans le flux demande seulement sa mise en place, que l'atelier fait depuis son cache ou
      // l'instantané en quelques secondes (`npm install` n'y est qu'un nom de commande, voir `fastCommands`).
      if (!scaffoldMounted) stream.command('shell', 'npm install');
      stream.command('start', 'npm run dev');

      // Un en-tête écrit sans le choix de la langue : il y est posé (dans la barre, à côté du menu mobile) ; le pied
      // de page le reçoit seulement si l'en-tête n'offre pas de place reconnaissable. Un site traduit doit l'offrir,
      // et là où on le cherche.
      const headerCode = written['src/components/site/SiteHeader.tsx'] ?? '';
      const footerCode = written['src/components/site/SiteFooter.tsx'] ?? '';
      if (siteLanguages.length > 1 && hasHeader && !/LanguageSwitcher/.test(headerCode)) {
        const inHeader = withHeaderLanguageSwitcher(headerCode);
        const inFooter = !inHeader && hasFooter ? withLanguageSwitcher(footerCode) : null;
        if (inHeader) {
          stream.file('src/components/site/SiteHeader.tsx', inHeader);
          written['src/components/site/SiteHeader.tsx'] = inHeader;
        } else if (inFooter) {
          stream.file('src/components/site/SiteFooter.tsx', inFooter);
          written['src/components/site/SiteFooter.tsx'] = inFooter;
        }
      }

      // Les autres langues : chaque texte du site (sections, faits, titres des pages) traduit par l'agent traducteur,
      // une langue à la fois en parallèle ; puis les documents de chaque langue reprennent leurs titres traduits.
      if (siteLanguages.length > 1 && !tracker.done('translate')) {
        const others = siteLanguages.slice(1);
        stream.note(fr ? `Je traduis le site en ${others.map((lang) => languageLabel(lang, true)).join(', ')}` : `Translating the site into ${others.map((lang) => languageLabel(lang, false)).join(', ')}`);
        const texts = [...new Set([...collectMessages(written), ...dataMessages(siteDataOf(facts, manifest, language)), ...shellMessages(manifest, shellOptions.description)])];
        const context = [facts.description, manifest.businessType, manifest.keywords.join(', ')].filter(Boolean).join(' · ').slice(0, 600);
        const catalogs: Record<string, Record<string, string>> = Object.fromEntries(siteLanguages.map((lang) => [lang, {}]));
        await Promise.all(
          others.map(async (lang) => {
            catalogs[lang] = await translateCatalog({ caller, texts, from: language, to: lang, siteName: facts.name, context });
          })
        );
        if (abort.signal.aborted) return;
        for (const [path, content] of Object.entries(renderI18nFiles(language, catalogs))) emit(path, content);
        for (const [path, content] of Object.entries(renderPageShells({ ...shellOptions, translate: (lang, text) => catalogs[lang]?.[text] ?? text }))) stream.file(path, content);
        tracker.mark('translate', 'done');
        const missing = others.filter((lang) => Object.keys(catalogs[lang]).length < texts.length * 0.9);
        ChatLogger.info('SITE_I18N', 'Site traduit', { languages: siteLanguages, texts: texts.length, translated: Object.fromEntries(others.map((lang) => [lang, Object.keys(catalogs[lang]).length])) });
        if (missing.length)
          stream.note(
            fr
              ? `Une partie des textes en ${missing.map((lang) => languageLabel(lang, true)).join(', ')} reste à traduire : demandez « /translate » pour la compléter`
              : `Some ${missing.map((lang) => languageLabel(lang, false)).join(', ')} texts are still untranslated: ask “/translate” to finish them`
          );
      }

      // Identité visuelle pro : la charte, lancée avant le site, est attendue avant de conclure — un temps borné.
      // Attendue sans limite, une charte lente (ou un flux d'IDEM qui ne se ferme pas) retenait la réponse des
      // dizaines de minutes : rien n'était enregistré, l'aperçu n'était pas lancé, aucun message. Au-delà, elle
      // continue dans IDEM (la réponse close normalement n'interrompt pas sa génération) et on le dit.
      let charterProblem: string | null = null;
      if (redesign?.charter) {
        stream.note(fr ? 'Je termine votre charte graphique' : 'Finishing your brand guidelines');
        const late = Symbol('late');
        let timer: NodeJS.Timeout | undefined;
        const outcome = await Promise.race([redesign.charter, new Promise<typeof late>((resolve) => (timer = setTimeout(() => resolve(late), CHARTER_GRACE_MS)))]);
        clearTimeout(timer);
        if (abort.signal.aborted) return;
        if (outcome === late) {
          ChatLogger.warn('SITE_REDESIGN', 'Charte encore en cours à la fin du site', { projectId: projectData.id, graceMs: CHARTER_GRACE_MS });
          charterProblem = fr
            ? 'Votre charte graphique se termine dans votre projet IDEM : vous l’y trouverez dans quelques minutes.'
            : 'Your brand guidelines are still being finished in your IDEM project: you will find them there in a few minutes.';
        } else charterProblem = outcome;
      }
      // Tout ce qui pouvait être fait l'est : le plan est clos (un composant en échec reste à « Corriger »).
      tracker.finish();
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
      // Ce qui vient de se passer, pour l'atelier (le projet d'une refonte a été annoncé en tête de réponse) : le
      // geste à signaler à la boucle IDEM (qui proposera la suite : faire connaître le site, le mettre en ligne…).
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
