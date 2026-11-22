/**
 * LA MODIFICATION D'UN SITE VITRINE DÉJÀ GÉNÉRÉ — ciblée, économe, fidèle à la demande.
 *
 * Avant : une retouche (« diminue la taille des titres ») renvoyait au modèle TOUT le site et le laissait
 * réécrire ce qu'il voulait — beaucoup de jetons, et des changements non demandés (la police remplacée).
 * Ici :
 *
 *   aiguillage   un agent lit la carte du site (`siteMap.ts`) et comprend la demande : où la faire, quoi y changer,
 *                ce qu'elle autorise (couleurs, police, retrait) — jamais une liste de mots-clés ;
 *   apparence    une demande générale change UN réglage du design system (sans modèle pour les cas
 *                courants), recompilé par le compilateur du template : aucune section n'est réécrite ;
 *   section      le modèle reçoit SEULEMENT le fichier visé et rend des blocs RECHERCHER / REMPLACER ;
 *                les garde-fous refusent une police, une couleur ou une structure changées sans demande,
 *                le composant est monté avec les données du site (comme à la génération) ; un échec =
 *                rien n'est modifié, et la réponse le dit ;
 *   nouvelle     une section neuve écrite par l'auteur habituel, posée dans la page sans toucher au reste.
 *   mise en forme  une section passée dans une autre composition du catalogue (idem-templates), ses textes gardés ;
 *   pages        sections retirées ou réordonnées par le code (aucun modèle) ;
 *   code         tout autre fichier du site, quand la demande ne tient dans aucune case : le code est modifié
 *                directement. Une retouche que les blocs RECHERCHER / REMPLACER n'arrivent pas à poser est réécrite
 *                en fichier entier, avec les mêmes vérifications : la demande est faite, pas abandonnée.
 *
 * Les garde-fous (police, couleurs, retrait) ne refusent plus une retouche de leur propre chef : quand ils voient un
 * tel changement, un agent relit la demande et dit si elle l'appelle. La personne obtient ce qu'elle a demandé.
 *
 * La réponse est une phrase (ce qui a changé), jamais un récapitulatif technique.
 */

import type { Response } from 'express';
import { transform } from 'esbuild';
import { ProjectModel } from '../types/project.js';
import { ChatLogger } from '../utils/logger.js';
import { ResilientStream } from '../utils/resilientStream.js';
import { authorComponent, authorSystemPrompt, ReviewContext, reviewComponent } from './authoring.js';
import { createFactGuard } from './factGuard.js';
import { localizeCode, siteLanguagesOf, syncCatalogs } from './i18n.js';
import { accountLimitMessage, ModelCaller, Verdict } from './modelCaller.js';
import { contextFrom, displayOf, importPolicy, siteFilesOf, targetOf, themeOf } from './repair.js';
import { detectSiteLanguage, readSiteFacts, renderFacts } from './siteFacts.js';
import { SiteStream } from './stream.js';
import { DESIGN_SYSTEM_PATHS, designSystemFiles, templateFiles } from './template.js';
import {
  applyPatches,
  applyTheme,
  fold,
  guardEdit,
  guardTheme,
  parsePatches,
  EditAllows,
  NOTHING_ALLOWED,
  quotedOwners,
  siteComponents,
  THEME_PATHS,
  themeChanges,
} from './editPlan.js';
import { pagesFileOf } from './project.js';
import { buildSiteMap, DataField, MapComponent, mapIds, readSiteData, renderSiteMap, SiteMap, writeSiteData } from './siteMap.js';
import { elementSnippet, locateElement, Pointed, PointedElement, touchesElement } from './pointed.js';
import { layoutMenuOf, loadCatalog, restyleSection, sectionPlanOf } from './editRestyle.js';
import type { LoadedSectionCatalog } from './sectionCatalog/types.js';
import { estimateTokens } from '../utils/tokens.js';
import { resolveSiteFont } from './redesign/idemClient.js';

export interface SiteEditInput {
  /** Le projet IDEM ; absent pour un site créé depuis l'accueil ou par refonte : il est alors relu dans le site. */
  projectData?: ProjectModel;
  language: string;
  /** La demande telle que l'utilisateur l'a écrite. */
  request: string;
  /** Les derniers échanges, en clair : « tu as dupliqué le menu » renvoie à ce qui vient d'être fait. */
  recent?: string;
  /** Ce que la personne a désigné dans l'aperçu (outil Dessin) : la retouche s'y tient. */
  pointed?: Pointed;
  /** L'état actuel du site, envoyé par l'atelier (sections, pages, design system, données). */
  files: Record<string, string>;
  model: string;
  userId: string | null;
  /** La session de la personne, relayée à l'API IDEM (polices hébergées). */
  credentials?: Record<string, string>;
}

/** Un site du moteur de sites (pages assemblées et design system compilé) : il se retouche ici. */
export function isEditableSite(files: Record<string, string> | undefined): files is Record<string, string> {
  return !!files && typeof pagesFileOf(files) === 'string' && typeof files[DESIGN_SYSTEM_PATHS.source] === 'string' && siteComponents(files).length > 0;
}

const MAX_FILES = 4;

/**
 * Le projet d'un site sans projet IDEM (créé depuis l'accueil, ou refait depuis une adresse) : son nom, sa
 * description et ses coordonnées sont relus dans `src/site/data.ts`. Avant, ce cas sautait le moteur de retouche et
 * partait chez le builder général, qui renvoyait tout le site au modèle — et la retouche ne se faisait pas.
 */
export function projectFromSite(files: Record<string, string>): ProjectModel {
  const data = (readSiteData(files['src/site/data.ts']) ?? {}) as {
    name?: string;
    description?: string;
    location?: { city?: string; country?: string; address?: string };
    contact?: { phone?: string; email?: string };
  };
  return {
    name: String(data.name ?? 'Site'),
    description: String(data.description ?? ''),
    type: 'web',
    additionalInfos: {
      city: data.location?.city ?? '',
      country: data.location?.country ?? '',
      address: data.location?.address ?? '',
      phone: data.contact?.phone ?? '',
      email: data.contact?.email ?? '',
    },
  } as unknown as ProjectModel;
}

/** Tout ce que le site affiche déjà : une retouche ne l'« invente » pas (un chiffre repris d'un ancien site, par exemple). */
function siteTexts(map: SiteMap): string {
  const components = [map.header, map.footer, ...map.pages.flatMap((page) => page.sections)].filter((c): c is MapComponent => !!c);
  return [...components.flatMap((c) => c.texts), JSON.stringify(map.data)].join('\n');
}

export function createSiteEditStream(input: SiteEditInput): ResilientStream {
  return {
    async pipeDataStreamToResponse(res: Response): Promise<void> {
      const { files, model, userId, request } = input;
      const projectData = input.projectData ?? projectFromSite(files);
      // Un site en plusieurs langues s'écrit dans sa langue principale (les autres suivent par traduction).
      const language = siteLanguagesOf(files)?.main ?? detectSiteLanguage(projectData.description ?? '', input.language);
      // Les réponses suivent la langue de la personne (celle de sa demande), pas celle du site : un site en anglais
      // retouché par quelqu'un qui écrit en français lui répond en français. Les textes du site, eux, restent dans
      // sa langue (`language`).
      const fr = detectSiteLanguage(request, input.language) === 'fr';
      const abort = new AbortController();
      res.on('close', () => {
        if (!res.writableEnded) abort.abort();
      });

      const facts = readSiteFacts(projectData, language);
      const factsText = renderFacts(facts, language);
      const map = buildSiteMap(files);
      // Ce que l'utilisateur écrit dans sa demande est un fait : un texte qu'il fournit n'est pas « inventé ». Ce que
      // le site affiche déjà non plus : sans cela, une section qui montrait un chiffre ne se retouchait jamais.
      const reference = `${factsText}\n${projectData.description ?? ''}\n${request}\n${input.recent ?? ''}\n${siteTexts(map)}`;
      const review: ReviewContext = {
        policy: importPolicy(),
        check: createFactGuard(reference, language),
        reference,
        theme: themeOf(files),
        siteFiles: (() => {
          const site = siteFilesOf(files, projectData, facts, language);
          return () => site;
        })(),
      };
      const caller = new ModelCaller(model, userId, abort.signal);

      const stream = new SiteStream(res);
      stream.open(model);
      const writes: Record<string, string> = {};
      const said: string[] = [];
      let failure = '';

      try {
        // 1. Où faire la retouche : la carte du site (calculée par le code) lue par l'agent d'aiguillage. Seul un
        //    texte cité, présent dans une seule section, est aiguillé sans lui.
        stream.note(fr ? 'Je repère ce qu’il faut modifier' : 'Finding what to change');
        // Une demande dessinée sur l'aperçu : les parties désignées, et elles seules (avec les données qu'elles affichent).
        const scope = pointedScope(map, input.pointed);
        const catalog = await loadCatalog();
        const quoted = quotedOwners(request, files);
        let plan = await planEdit(caller, request, input.recent ?? '', map, quoted, scope, fr, files, catalog);
        // Sans réponse de l'agent, une demande dessinée se fait quand même là où elle a été dessinée, et un texte cité
        // là où il se trouve.
        if (!plan && scope) plan = { targets: [...new Set(scope.parts.map((part) => part.id))].map((id) => ({ id, change: request })), allows: { ...NOTHING_ALLOWED, colors: true, fonts: true } };
        if (!plan && quoted.length) {
          const { components } = mapIds(map);
          const ids = [...components.values()].filter((c) => quoted.some((q) => q.paths.includes(c.path))).map((c) => c.id);
          if (ids.length) plan = { targets: ids.slice(0, MAX_FILES).map((id) => ({ id, change: request })), allows: { ...NOTHING_ALLOWED } };
        }
        ChatLogger.info('SITE_EDIT', 'Retouche aiguillée', { plan, pointed: scope?.parts.map((part) => `${part.id} <${part.element.tag}>`) });
        if (!plan) throw new Error('aiguillage impossible');
        const { components } = mapIds(map);
        const judge = createAllowJudge(caller, request, input.recent ?? '', plan.allows);

        // 2. Chaque partie visée, en parallèle : l'apparence, les données du site, les sections, une section neuve.
        const jobs: Array<Promise<void>> = [];
        if (plan.theme && !scope) {
          stream.note(fr ? 'Je règle l’apparence du site' : 'Adjusting the site’s look');
          jobs.push(
            editTheme(caller, `${request}\n${plan.theme}`, files, plan.allows, fr, (family) => findFont(family, input.credentials, abort.signal)).then((outcome) => {
              if (outcome.files) Object.assign(writes, outcome.files);
              if (outcome.reply) said.push(outcome.reply);
              else failure = outcome.failure || failure;
            })
          );
        }
        const dataTargets = plan.targets.filter((target) => target.id.startsWith('data.'));
        if (dataTargets.length) {
          stream.note(fr ? 'Je modifie les informations du site (menu, coordonnées)' : 'Editing the site’s information (menu, contact)');
          jobs.push(
            editData(caller, request, dataTargets.map((target) => ({ field: target.id.slice(5) as DataField, change: target.change })), files, map, fr).then((outcome) => {
              if (outcome.files) Object.assign(writes, outcome.files);
              if (outcome.reply) said.push(outcome.reply);
              else failure = outcome.failure || failure;
            })
          );
        }
        // Une section remise en forme avec le catalogue ; si aucune variante ne convient, son code est retouché
        // directement — la demande est faite dans tous les cas.
        const restyled = new Set<string>();
        for (const target of (plan.restyle ?? []).filter((t) => components.has(t.id) && components.get(t.id)!.page).slice(0, MAX_FILES)) {
          const component = components.get(target.id)!;
          restyled.add(target.id);
          stream.note(fr ? `Je change la mise en page de ${displayOf(component.path, true)}` : `Changing the layout of ${displayOf(component.path, false)}`);
          jobs.push(
            (async () => {
              const outcome = catalog
                ? await restyleSection({ caller, catalog, request, change: target.change, layout: target.layout, component, map, files, review, language, fr })
                : null;
              if (outcome) {
                writes[component.path] = outcome.code;
                said.push(plain(outcome.reply) || (fr ? `J’ai changé la mise en page de ${displayOf(component.path, true)}.` : `I changed the layout of ${displayOf(component.path, false)}.`));
                return;
              }
              const r = await editFile(caller, request, `${target.change}\n(Change the layout of this section itself: restructure its JSX as needed.)`, component.path, files, review, { ...plan!.allows, removal: true }, fr, [], judge);
              if (r.code && r.code !== files[component.path]) {
                writes[component.path] = r.code;
                if (r.reply) said.push(r.reply);
              } else if (r.failure) failure = r.failure;
            })()
          );
        }
        for (const target of plan.targets.filter((t) => components.has(t.id) && !restyled.has(t.id)).slice(0, MAX_FILES)) {
          const path = components.get(target.id)!.path;
          stream.note(fr ? `Je modifie ${displayOf(path, true)}` : `Editing ${displayOf(path, false)}`);
          jobs.push(
            editFile(caller, request, target.change, path, files, review, plan.allows, fr, scope?.parts.filter((part) => part.id === target.id).map((part) => part.element), judge).then((r) => {
              if (r.code && r.code !== files[path]) {
                writes[path] = r.code;
                if (r.reply) said.push(r.reply);
              } else if (r.failure) failure = r.failure;
            })
          );
        }
        // Tout autre fichier du site : la demande ne tient dans aucune case, le code est modifié directement.
        const claimed = new Set([...plan.targets, ...(plan.restyle ?? [])].map((t) => components.get(t.id)?.path).filter(Boolean));
        for (const target of (plan.code ?? []).filter((t) => editableFile(files, t.path) && !claimed.has(t.path)).slice(0, MAX_FILES)) {
          stream.note(fr ? 'Je modifie le code du site' : 'Editing the site’s code');
          jobs.push(
            editFile(caller, request, target.change, target.path, files, review, { ...plan.allows }, fr, [], judge).then((r) => {
              if (r.code && r.code !== files[target.path]) {
                writes[target.path] = r.code;
                if (r.reply) said.push(r.reply);
              } else if (r.failure) failure = r.failure;
            })
          );
        }
        await Promise.all(jobs);

        // Les pages : sections retirées ou réordonnées par le code (aucun modèle, rien d'autre ne bouge).
        const pageOps = pageOperations(plan, map, { ...files, ...writes });
        for (const [path, code] of Object.entries(pageOps.files)) writes[path] = code;
        if (pageOps.reply) said.push(pageOps.reply(fr));
        if (plan.newSection) {
          stream.note(fr ? 'J’ajoute la section' : 'Adding the section');
          const outcome = await addSection(caller, `${request}\n${plan.newSection.change}`, plan.newSection.page, { ...files, ...writes }, projectData, facts, factsText, language, review, plan.newSection.name, plan.newSection.after);
          if (outcome.files) {
            Object.assign(writes, outcome.files);
            said.push(outcome.reply!);
          } else failure = outcome.failure || failure;
        }
      } catch (error) {
        ChatLogger.error('SITE_EDIT', 'Retouche en échec', error);
        failure = caller.accountLimit
          ? accountLimitMessage(fr)
          : fr
            ? 'La modification n’a pas pu être faite. Votre site n’a pas changé : réessayez dans un instant.'
            : 'The change could not be made. Your site is unchanged: try again in a moment.';
      }
      // Le compte bloqué en cours de route (une section, les données) : c'est la seule chose à dire.
      if (caller.accountLimit && !Object.keys(writes).length) failure = accountLimitMessage(fr);

      // Un module du design system abîmé par une retouche passée (un paquet importé que le site n'a pas) : réparé.
      const restored = restoreDesignSystemModules(files);
      if (Object.keys(restored).length) {
        ChatLogger.info('SITE_EDIT', 'Modules du design system remis d’origine', { paths: Object.keys(restored) });
        for (const [path, code] of Object.entries(restored)) if (!(path in writes)) writes[path] = code;
        if (!Object.keys(writes).some((path) => !(path in restored))) failure = '';
      }
      if (abort.signal.aborted) return;
      // Le texte retouché reste traduisible (`t()`, `localePath()`), et un site en plusieurs langues reçoit la
      // traduction des phrases nouvelles dans chacune.
      for (const path of Object.keys(writes)) if (/\.tsx$/.test(path)) writes[path] = localizeCode(writes[path], path).code;
      const languages = siteLanguagesOf(files)?.languages ?? [];
      if (Object.keys(writes).length && languages.length > 1) {
        stream.note(fr ? 'Je traduis les textes modifiés' : 'Translating the changed copy');
        const synced = await syncCatalogs({ caller, files: { ...files, ...writes }, siteName: facts.name, context: facts.description.slice(0, 600) });
        if (abort.signal.aborted) return;
        for (const [path, content] of Object.entries(synced.files)) if (content !== files[path]) writes[path] = content;
      }
      const paths = Object.keys(writes);
      if (paths.length) {
        stream.text(`<boltArtifact id="idem-site-edit-${Date.now().toString(36)}" title="${fr ? 'Modification' : 'Edit'}">\n`);
        for (const path of paths) stream.file(path, writes[path]);
        stream.text('</boltArtifact>\n');
      }
      const reply = paths.length
        ? `${said.filter(Boolean).join(' ') || (fr ? 'C’est fait.' : 'Done.')} ${fr ? 'Le reste du site n’a pas changé.' : 'The rest of the site is unchanged.'}`
        : failure ||
          (fr
            ? 'Je n’ai pas trouvé de modification à faire pour cette demande : votre site n’a pas changé. Dites-moi ce que vous voulez voir à l’écran (par exemple « le bouton du haut en vert »).'
            : 'I found nothing to change for this request: your site is unchanged. Tell me what you want to see on screen (for example “the top button in green”).');
      stream.text(`\n${reply.slice(0, 500)}\n`);

      ChatLogger.success('SITE_EDIT', 'Retouche terminée', { files: paths, promptTokens: caller.promptTokens, completionTokens: caller.completionTokens });
      stream.close({ promptTokens: caller.promptTokens, completionTokens: caller.completionTokens });
    },
  };
}

// ── Ce que la personne a désigné dans l'aperçu ─────────────────────────────

interface PointedScope {
  /** Chaque élément désigné, rattaché à la partie de la carte qui le porte. */
  parts: Array<{ id: string; element: PointedElement }>;
  /** Les parties qui peuvent changer : celles désignées, et les données qu'elles affichent. */
  ids: Set<string>;
}

const DATA_READS: Record<string, DataField> = {
  'site.navigation': 'navigation',
  'site.primaryAction': 'primaryAction',
  'site.contact': 'contact',
  'site.name': 'name',
  'site.description': 'description',
};

export function pointedScope(map: SiteMap, pointed: Pointed | undefined): PointedScope | null {
  if (!pointed?.elements.length) return null;
  const { components, data } = mapIds(map);
  const byPath = new Map([...components.values()].map((component) => [component.path, component]));
  const parts: PointedScope['parts'] = [];
  for (const element of pointed.elements) {
    const component = byPath.get(element.owner) ?? byPath.get(element.filePath);
    if (component) parts.push({ id: component.id, element });
  }
  if (!parts.length) return null;
  const ids = new Set(parts.map((part) => part.id));
  for (const part of parts) {
    for (const read of components.get(part.id)?.reads ?? []) {
      const field = DATA_READS[read];
      if (field && data.includes(field)) ids.add(`data.${field}`);
    }
  }
  return { parts, ids };
}

// ── L'aiguillage : la carte du site lue par un agent ───────────────────────

export interface EditPlan {
  /** Les parties à modifier (identifiants de la carte : `home/Hero`, `SiteHeader`, `data.navigation`) et quoi y changer. */
  targets: Array<{ id: string; change: string }>;
  /** Un changement de l'apparence de tout le site (design system). */
  theme?: string;
  /** Une section à ajouter : sa page, son nom de composant, la section qu'elle suit. */
  newSection?: { page: string; name: string; after?: string; change: string };
  /** Une section à remettre en forme avec une composition du catalogue (la même dans une autre variante, ou une autre). */
  restyle?: Array<{ id: string; layout?: string; change: string }>;
  /** Des sections à retirer de leur page. */
  remove?: string[];
  /** Le nouvel ordre des sections d'une page (identifiants de la carte). */
  order?: Array<{ page: string; sections: string[] }>;
  /** Tout autre fichier du site, modifié directement (la demande ne tient dans aucune autre case). */
  code?: Array<{ path: string; change: string }>;
  /** Ce que la demande autorise, tel que l'agent l'a compris. */
  allows: EditAllows;
}

/** Les fichiers qu'une retouche « code » peut toucher : le site lui-même, jamais les notes du moteur ni le compilé. */
export function editableFile(files: Record<string, string>, path: string): boolean {
  if (typeof files[path] !== 'string') return false;
  if (path.startsWith('.idem/') || /^idem\.(plan|manifest)\.json$/.test(path)) return false;
  // Le design system (polices, couleurs, réglages) ne se retouche que par ses réglages, recompilés : jamais à la main.
  if (path.startsWith('src/design-system/') || (Object.values(DESIGN_SYSTEM_PATHS) as string[]).includes(path)) return false;
  return /^src\/.+\.(tsx|ts|json|css)$/.test(path) || /^(?:[\w-]+\/){0,2}index\.html$/.test(path);
}

/** Les fichiers du site absents de la carte (pages, données, textes traduits…) : une ligne chacun. */
function otherFiles(files: Record<string, string>, map: SiteMap): string[] {
  const mapped = new Set([map.header?.path, map.footer?.path, ...map.pages.flatMap((page) => page.sections.map((s) => s.path))]);
  return Object.keys(files)
    .filter((path) => editableFile(files, path) && !mapped.has(path) && path !== 'src/site/data.ts')
    .sort()
    .slice(0, 60);
}

/**
 * L'agent d'aiguillage : il lit la carte du site, la demande et les derniers échanges, et dit OÙ la retouche se fait
 * et QUOI y changer, partie par partie. Il ne renvoie jamais la question à l'utilisateur : la personne ne connaît
 * pas les sections de son site, c'est à l'agent de les trouver.
 */
async function planEdit(
  caller: ModelCaller,
  request: string,
  recent: string,
  map: SiteMap,
  quoted: Array<{ quote: string; paths: string[] }>,
  scope: PointedScope | null,
  fr: boolean,
  files: Record<string, string>,
  catalog: LoadedSectionCatalog | null
): Promise<EditPlan | null> {
  const { components, data, pages } = mapIds(map);
  const idOf = (path: string) => [...components.values()].find((component) => component.path === path)?.id ?? path;
  const layoutOf = (component: MapComponent) => (component.page ? sectionPlanOf(files, component).layout : undefined);
  const layouts = new Set(catalog?.kinds.keys() ?? []);
  const others = otherFiles(files, map);
  const sectionLayouts = map.pages
    .flatMap((page) => page.sections)
    .map((section) => [section.id, layoutOf(section)])
    .filter(([, layout]) => layout)
    .map(([id, layout]) => `- [${id}] : ${layout}`);
  const outcome = await caller.json<EditPlan>(
    'edit:plan',
    'You decide WHERE and HOW a change requested on a live website must be made, using the map of the site. The change WILL be made: your job is to route it so that the person sees exactly what they asked for. You answer with JSON only.',
    [
      renderSiteMap(map),
      sectionLayouts.length ? `\n# Current layout of each section (catalog composition)\n${sectionLayouts.join('\n')}` : '',
      catalog ? `\n# Catalog compositions available (for "restyle")\n${layoutMenuOf(catalog, fr)}` : '',
      others.length ? `\n# Other files of the site (for "code")\n${others.map((path) => `- ${path}`).join('\n')}` : '',
      recent ? `\n# Recent conversation (what was just done)\n${recent.slice(0, 2500)}` : '',
      quoted.length ? `\n# Texts quoted in the request, found word for word in\n${quoted.map((q) => `- « ${q.quote} » : ${q.paths.map(idOf).join(', ')}`).join('\n')}` : '',
      scope
        ? `\n# What the person POINTED AT in the preview (binding)\n${scope.parts.map((part) => `- [${part.id}] the ${part.element.kind || part.element.tag} <${part.element.tag}>${part.element.text ? ` « ${part.element.text.slice(0, 100)} »` : ''}`).join('\n')}\nThe change applies to what was pointed at: use ONLY these ids: ${[...scope.ids].join(', ')}. "This", "here", "it" mean the pointed element. No theme change, no other section.`
        : '',
      `\n# The request\n${request.slice(0, 1500)}`,
      `\n# Your answer
{"targets":[{"id":"<an id from the map in square brackets: a section like home/Hero, SiteHeader, SiteFooter, or data.navigation, data.primaryAction, data.contact, data.name, data.description>","change":"<precise instruction for that part, in ${fr ? 'French' : 'English'}: what to change, and what to keep>"}],
"theme":"<only for a change of the whole site's look (fonts, sizes of all headings, colours, corners, spacing, buttons everywhere), else omit>",
"restyle":[{"id":"<section id>","layout":"<a catalog composition id, or omit to keep the same composition in another variant>","change":"<what the new layout must show>"}],
"remove":["<section ids to delete from their page>"],
"order":[{"page":"<page key>","sections":["<every section id of that page, in the new order>"]}],
"newSection":{"page":"<page key>","name":"<PascalCase component name in English, e.g. Testimonials>","after":"<section name it follows, optional>","change":"<what the new section contains>"},
"code":[{"path":"<a file from 'Other files of the site'>","change":"<what to change in it>"}],
"allows":{"fonts":<true if the request, as you understand it, calls for changing a typeface>,"colors":<true if it calls for changing colours, including implicitly: "more lively", "warmer", "match my logo", "make the button stand out">,"removal":<true if it calls for removing content>,"dark":<true if it calls for a dark look>}}
Omit the keys you do not use.
Rules:
- Understand what the person means, whatever their words: "the bar at the top", "the menu", "where the links are" all mean the header and its menu. Interpret; never look for keywords.
- The person does not know how the site is built: find the right part yourself from the map (their words, the texts shown, what each part reads, the recent conversation). Never ask them.
- Data shared by several parts lives in data.* : the menu items are data.navigation (the header and footer only display them), the contact details are data.contact. A duplicated, missing or wrong menu item is fixed in data.navigation, not in the header.
- A change of texts, sizes, colours, spacing, an added or removed element (button, image, list item, icon, badge) INSIDE a section goes to "targets": its code is edited directly, whatever the change.
- A different arrangement of a whole section ("in cards", "in two columns", "as a carousel", "another style for this section", "make the top of the page look different") goes to "restyle", with the catalog composition that matches; if no composition matches, put the section in "targets" with a precise instruction and its code is rewritten.
- Deleting a whole section goes to "remove"; moving sections goes to "order"; a new section goes to "newSection".
- A change of typeface (font), for headings, text or the whole site, ALWAYS goes to "theme" (IDEM then loads it from its font catalog), never to "code" or a section.
- Anything else (page titles, translations, a file not in the map) goes to "code" with a file from the list.
- Choose the FEWEST parts that satisfy the request (at most ${MAX_FILES} per kind). A request about one element touches one part.
- Never answer with nothing: pick the most likely part. The person expects a visible change.`,
    ].join('\n'),
    (raw): Verdict<EditPlan> => {
      const o = (raw ?? {}) as {
        targets?: unknown;
        theme?: unknown;
        newSection?: { page?: unknown; name?: unknown; after?: unknown; change?: unknown };
        restyle?: unknown;
        remove?: unknown;
        order?: unknown;
        code?: unknown;
        allows?: Record<string, unknown>;
      };
      const cleanId = (value: unknown) => String(value ?? '').replace(/^\[|\]$/g, '').trim();
      const list = (value: unknown) => (Array.isArray(value) ? value : []) as Array<Record<string, unknown>>;
      const targets = list(o.targets)
        .map((t) => ({ id: cleanId(t?.id), change: String(t?.change ?? '').trim() }))
        .filter((t) => t.id);
      const restyle = list(o.restyle)
        .map((t) => ({ id: cleanId(t?.id), layout: typeof t?.layout === 'string' && layouts.has(t.layout) ? t.layout : undefined, change: String(t?.change ?? '').trim() || request }))
        .filter((t) => t.id);
      const remove = (Array.isArray(o.remove) ? o.remove : []).map(cleanId).filter(Boolean);
      const order = list(o.order)
        .map((t) => ({ page: String(t?.page ?? ''), sections: (Array.isArray(t?.sections) ? (t.sections as unknown[]) : []).map(cleanId).filter(Boolean) }))
        .filter((t) => t.page && t.sections.length);
      const code = list(o.code)
        .map((t) => ({ path: String(t?.path ?? '').trim(), change: String(t?.change ?? '').trim() || request }))
        .filter((t) => t.path);
      const sectionIds = new Set(map.pages.flatMap((page) => page.sections.map((s) => s.id)));
      const unknown = [
        ...targets.filter((t) => !components.has(t.id) && !(t.id.startsWith('data.') && data.includes(t.id.slice(5) as DataField))).map((t) => t.id),
        ...restyle.filter((t) => !sectionIds.has(t.id)).map((t) => t.id),
        ...remove.filter((id) => !sectionIds.has(id)),
        ...order.filter((t) => !pages.includes(t.page) || t.sections.some((id) => !sectionIds.has(id))).map((t) => `order:${t.page}`),
        ...code.filter((t) => !editableFile(files, t.path)).map((t) => t.path),
      ];
      if (unknown.length) return { problem: `Unknown ids or files: ${unknown.join(', ')}. Use only ids written in square brackets in the map, and files from the list.` };
      const newSection =
        o.newSection && typeof o.newSection.page === 'string' && pages.includes(o.newSection.page)
          ? {
              page: o.newSection.page,
              name: typeof o.newSection.name === 'string' && /^[A-Z][A-Za-z0-9]{2,40}$/.test(o.newSection.name) ? o.newSection.name : 'ExtraSection',
              after: typeof o.newSection.after === 'string' ? o.newSection.after.split('/').pop() : undefined,
              change: String(o.newSection.change ?? request),
            }
          : undefined;
      const allows: EditAllows = { ...NOTHING_ALLOWED, ...Object.fromEntries(Object.keys(NOTHING_ALLOWED).map((key) => [key, o.allows?.[key] === true])) };
      if (remove.length) allows.removal = true;
      const theme = typeof o.theme === 'string' && o.theme.trim() ? o.theme.trim() : undefined;
      if (!targets.length && !theme && !newSection && !restyle.length && !remove.length && !order.length && !code.length)
        return { problem: 'Choose at least one part of the site: the most likely one given the request and the map. Never answer with nothing.' };
      if (scope) {
        const outside = [...targets.map((t) => t.id), ...restyle.map((t) => t.id), ...remove].filter((id) => !scope.ids.has(id));
        if (outside.length || theme || code.length) return { problem: `The person pointed at ${[...scope.ids].join(', ')}: change only there (${[...outside, ...(theme ? ['theme'] : []), ...code.map((t) => t.path)].join(', ')} not allowed).` };
        const pointedPages = new Set(scope.parts.map((part) => components.get(part.id)?.page).filter(Boolean));
        if (newSection && !pointedPages.has(newSection.page)) return { problem: `A new section goes on the page that was pointed at (${[...pointedPages].join(', ') || 'none'}).` };
      }
      return {
        value: {
          targets: targets.map((t) => ({ id: t.id, change: t.change || request })),
          theme,
          newSection,
          ...(restyle.length ? { restyle } : {}),
          ...(remove.length ? { remove } : {}),
          ...(order.length ? { order } : {}),
          ...(code.length ? { code } : {}),
          allows,
        },
      };
    },
    1200
  );
  return outcome.value ?? null;
}

// ── Les pages : retirer ou réordonner des sections, par le code ─────────────

/** Le bloc `<SectionBoundary name="X">…</SectionBoundary>` d'une section dans sa page (avec sa ligne entière). */
function boundaryBlock(page: string, name: string): RegExp {
  return new RegExp(`^[ \\t]*<SectionBoundary name="${name}"(?: defer)?>[\\s\\S]*?^[ \\t]*</SectionBoundary>[ \\t]*\\n?`, 'm');
}

/** La page sans la section : son bloc et son import. */
export function removeSectionFromPage(page: string, name: string): string {
  return page.replace(boundaryBlock(page, name), '').replace(new RegExp(`^import ${name} from '[^']+';\\n`, 'm'), '');
}

/** La page avec ses sections dans l'ordre donné (les autres gardent leur place après elles). */
export function reorderSections(page: string, names: string[]): string {
  const blocks = Array.from(page.matchAll(/^[ \t]*<SectionBoundary name="(\w+)"(?: defer)?>[\s\S]*?^[ \t]*<\/SectionBoundary>[ \t]*$/gm));
  if (blocks.length < 2) return page;
  const start = blocks[0].index!;
  const last = blocks[blocks.length - 1];
  const end = last.index! + last[0].length;
  const byName = new Map(blocks.map((m) => [m[1], m[0]]));
  const wanted = [...names.filter((n) => byName.has(n)), ...blocks.map((m) => m[1]).filter((n) => !names.includes(n))];
  // La première section n'est jamais différée (elle ouvre la page) ; les suivantes le sont si la page l'était.
  const deferred = blocks.some((m) => /\sdefer>/.test(m[0]));
  const ordered = wanted.map((name, index) => {
    const block = byName.get(name)!;
    if (!deferred) return block;
    return index === 0 ? block.replace(/ defer>/, '>') : /\sdefer>/.test(block) ? block : block.replace(/(<SectionBoundary name="\w+")>/, '$1 defer>');
  });
  return page.slice(0, start) + ordered.join('\n') + page.slice(end);
}

function pageOperations(plan: EditPlan, map: SiteMap, files: Record<string, string>): { files: Record<string, string>; reply?: (fr: boolean) => string } {
  const out: Record<string, string> = {};
  const sectionsById = new Map(map.pages.flatMap((page) => page.sections.map((s) => [s.id, s] as const)));
  let removed = 0;
  let moved = 0;
  for (const id of plan.remove ?? []) {
    const section = sectionsById.get(id);
    if (!section?.page) continue;
    const path = `src/pages/${section.page}.tsx`;
    const page = out[path] ?? files[path];
    if (typeof page !== 'string') continue;
    const next = removeSectionFromPage(page, section.name);
    if (next !== page) {
      out[path] = next;
      removed++;
    }
  }
  for (const { page: key, sections } of plan.order ?? []) {
    const path = `src/pages/${key}.tsx`;
    const page = out[path] ?? files[path];
    if (typeof page !== 'string') continue;
    const next = reorderSections(page, sections.map((id) => sectionsById.get(id)?.name).filter((n): n is string => !!n));
    if (next !== page) {
      out[path] = next;
      moved++;
    }
  }
  if (!removed && !moved) return { files: out };
  return {
    files: out,
    reply: (fr) =>
      [
        removed ? (fr ? (removed > 1 ? `J’ai retiré ${removed} sections.` : 'J’ai retiré la section.') : removed > 1 ? `I removed ${removed} sections.` : 'I removed the section.') : '',
        moved ? (fr ? 'J’ai changé l’ordre des sections.' : 'I changed the order of the sections.') : '',
      ]
        .filter(Boolean)
        .join(' '),
  };
}

// ── Les données du site : le menu, l'action principale, les coordonnées ─────

const DATA_PATH = 'src/site/data.ts';

/** Une valeur proposée pour un champ des données, vérifiée (forme, liens, rien d'inventé). */
export function checkDataValue(field: DataField, value: unknown, allowed: string): { value: unknown } | { problem: string } {
  const link = (href: unknown) => typeof href === 'string' && /^(\/|#|https?:\/\/|mailto:|tel:)/.test(href);
  if (field === 'navigation') {
    if (!Array.isArray(value) || !value.length) return { problem: 'navigation must be a non-empty array of {"label","href"}.' };
    const items: Array<{ label: string; href: string }> = [];
    for (const item of value as Array<{ label?: unknown; href?: unknown }>) {
      const label = String(item?.label ?? '').trim();
      if (!label || label.length > 40 || !link(item?.href)) return { problem: `Each menu item needs a short label (40 characters at most) and a link: ${JSON.stringify(item)}.` };
      // Un menu ne montre jamais deux fois la même page.
      if (!items.some((existing) => existing.href === item.href)) items.push({ label, href: String(item.href) });
    }
    return items.length > 9 ? { problem: 'A main menu has 9 items at most: keep the main pages.' } : { value: items };
  }
  if (field === 'primaryAction') {
    if (value === null) return { value: null };
    const action = value as { label?: unknown; href?: unknown };
    return typeof action?.label === 'string' && action.label.trim() && link(action.href)
      ? { value: { label: action.label.trim(), href: String(action.href) } }
      : { problem: 'primaryAction is null or {"label","href"}.' };
  }
  if (field === 'contact') {
    const contact = (value ?? {}) as { phone?: unknown; email?: unknown; channels?: unknown };
    const digits = (text: string) => text.replace(/\D/g, '');
    const known = digits(allowed);
    const channels = Array.isArray(contact.channels) ? contact.channels : [];
    const texts = [String(contact.phone ?? ''), String(contact.email ?? ''), ...channels.map((c) => String((c as { value?: unknown })?.value ?? ''))];
    // Un numéro ou une adresse qui ne vient ni de la demande ni du site serait inventé.
    const invented = texts.filter((text) => text && (digits(text).length >= 6 ? !known.includes(digits(text)) : text.includes('@') && !allowed.includes(text)));
    if (invented.length) return { problem: `Do not invent contact details: ${invented.join(', ')} appear neither in the request nor on the site.` };
    return { value: { phone: String(contact.phone ?? ''), email: String(contact.email ?? ''), channels } };
  }
  return typeof value === 'string' && value.trim() ? { value: value.trim().slice(0, field === 'name' ? 80 : 300) } : { problem: `${field} must be a non-empty text.` };
}

/** Modifie des champs de `src/site/data.ts` : le modèle propose les nouvelles valeurs, le code les vérifie et les écrit. */
async function editData(
  caller: ModelCaller,
  request: string,
  targets: Array<{ field: DataField; change: string }>,
  files: Record<string, string>,
  map: SiteMap,
  fr: boolean
): Promise<{ files?: Record<string, string>; reply?: string; failure?: string }> {
  const code = files[DATA_PATH];
  const data = readSiteData(code);
  if (!code || !data) return { failure: fr ? 'Je ne retrouve pas les informations du site : rien n’a changé.' : 'I cannot find the site’s information: nothing changed.' };
  const current = Object.fromEntries(targets.map((t) => [t.field, data[t.field]]));
  const allowed = `${request}\n${JSON.stringify(data)}`;
  const pages = map.pages.map((page) => `${page.label} → ${page.path}`).join(' · ');
  const outcome = await caller.json<{ values: Record<string, unknown>; reply: string }>(
    'edit:data',
    'You edit the shared data of a live website (menu, main action, contact details). Change ONLY what is asked; keep every other value as it is. Answer with JSON only.',
    `# Request\n${request.slice(0, 1500)}\n\n# What to change\n${targets.map((t) => `- ${t.field}: ${t.change}`).join('\n')}\n\n# Current values\n${JSON.stringify(current, null, 2)}\n\n# Pages of the site (for links)\n${pages}\n\nAnswer {"values":{${targets.map((t) => `"${t.field}": <the complete new value, same shape>`).join(', ')}},"reply":"one short sentence for the user, in ${fr ? 'French' : 'English'}, saying what changed"}.`,
    (raw): Verdict<{ values: Record<string, unknown>; reply: string }> => {
      const o = (raw ?? {}) as { values?: Record<string, unknown>; reply?: unknown };
      const values: Record<string, unknown> = {};
      for (const { field } of targets) {
        if (!o.values || !(field in o.values)) return { problem: `Give the complete new value of "${field}".` };
        const checked = checkDataValue(field, o.values[field], allowed);
        if ('problem' in checked) return { problem: checked.problem };
        values[field] = checked.value;
      }
      return { value: { values, reply: typeof o.reply === 'string' ? o.reply : '' } };
    },
    1200
  );
  if (!outcome.value) return { failure: fr ? 'Je n’ai pas réussi à modifier ces informations sans erreur : rien n’a changé.' : 'I could not change this information without errors: nothing changed.' };
  const next = { ...data, ...outcome.value.values };
  if (JSON.stringify(next) === JSON.stringify(data)) return { failure: fr ? 'Ces informations étaient déjà comme demandé.' : 'This information was already as requested.' };
  return { files: { [DATA_PATH]: writeSiteData(code, next) }, reply: plain(outcome.value.reply) || (fr ? 'C’est fait.' : 'Done.') };
}

// ── L'apparence : un réglage du design system ───────────────────────────────

type FontLookup = (family: string) => Promise<{ family: string; cssUrl?: string } | null>;

/** La police retrouvée par l'API IDEM dans les catalogues, avec l'adresse de sa feuille (rien n'est téléchargé) ; sans
 * session, la famille seule (le compilateur la charge depuis Google Fonts). `null` : aucune police de ce nom. */
async function findFont(family: string, credentials: Record<string, string> | undefined, signal: AbortSignal): Promise<{ family: string; cssUrl?: string } | null> {
  if (!credentials || !Object.keys(credentials).length) return { family };
  try {
    const font = await resolveSiteFont(family, credentials, signal);
    return font ? { family: font.family, cssUrl: font.cssUrl } : null;
  } catch (error) {
    ChatLogger.warn('SITE_EDIT', 'Police non vérifiée (API injoignable) : famille seule', { family, message: (error as Error).message });
    return { family };
  }
}

/**
 * Une police changée : la famille retrouvée dans un catalogue, l'adresse de sa feuille écrite telle quelle dans le
 * design system (aucun fichier téléchargé, le bucket n'est pas chargé). L'adresse de l'ancienne police est retirée :
 * sans cela, le compilateur chargeait toujours l'ancienne. Les adresses proposées par le modèle ne sont jamais reprises.
 */
async function applyFonts(set: Record<string, unknown>, config: Record<string, any>, find: FontLookup): Promise<{ set: Record<string, unknown>; missing: string[] }> {
  const out: Record<string, unknown> = Object.fromEntries(Object.entries(set).filter(([path]) => !/FontUrl$/.test(path)));
  const missing: string[] = [];
  for (const role of ['heading', 'body'] as const) {
    const path = `tokens.typography.${role}Font`;
    const wanted = typeof out[path] === 'string' ? String(out[path]).trim() : '';
    if (!wanted || wanted === config.tokens?.typography?.[`${role}Font`]) continue;
    const font = await find(wanted);
    if (!font) {
      delete out[path];
      missing.push(wanted);
      continue;
    }
    out[path] = font.family;
    out[`tokens.typography.${role}FontUrl`] = font.cssUrl ?? null;
  }
  return { set: out, missing };
}

async function editTheme(caller: ModelCaller, request: string, files: Record<string, string>, allows: EditAllows, fr: boolean, find: FontLookup): Promise<{ files?: Record<string, string>; reply?: string; failure?: string }> {
  let config: Record<string, any>;
  try {
    config = JSON.parse(files[DESIGN_SYSTEM_PATHS.source]);
  } catch {
    return { failure: fr ? 'Le réglage du design de ce site est illisible : je ne peux pas le modifier sans risque.' : 'This site’s design settings are unreadable: I cannot change them safely.' };
  }

  // Le modèle comprend la demande et choisit les réglages (une réponse de quelques lignes) ; le code refuse ce que
  // la demande, telle que l'agent d'aiguillage l'a comprise, n'autorise pas.
  const current = { appearance: config.appearance, tokens: config.tokens, components: config.components, motion: config.motion };
  const outcome = await caller.json<{ set: Record<string, unknown>; reply: string }>(
    'edit:theme',
    'You adjust the design system of a live website. Understand what the person wants, then change ONLY the settings that serve it; keep every other setting as it is. Answer with JSON only.',
    `Request: ${request.slice(0, 600)}\n\nCurrent settings:\n${JSON.stringify(current)}\n\nSettings you may change (dotted paths): ${THEME_PATHS.join(', ')}.\n${allows.fonts ? '' : 'Do not change fonts. '}${allows.colors ? '' : 'Do not change colours. '}${allows.dark ? '' : 'Do not switch to a dark colour mode.'}\nAnswer {"set":{"path":value},"reply":"one short sentence for the user, in ${fr ? 'French' : 'English'}, saying what changed"}. Use {"set":{}} if no setting serves the request.`,
    (raw): Verdict<{ set: Record<string, unknown>; reply: string }> => {
      const o = (raw ?? {}) as { set?: Record<string, unknown>; reply?: unknown };
      const proposed = o.set && typeof o.set === 'object' ? o.set : {};
      const { allowed, refused } = guardTheme(allows, proposed);
      if (!Object.keys(allowed).length && refused.length) return { problem: `Refused: ${refused.join('; ')}. Change only what the request asks.` };
      return { value: { set: allowed, reply: typeof o.reply === 'string' ? o.reply : '' } };
    },
    400
  );
  if (!outcome.value) return { failure: fr ? 'Je n’ai pas pu régler l’apparence demandée. Votre site n’a pas changé.' : 'I could not make that change to the look. Your site is unchanged.' };
  const set = outcome.value.set;
  const reply = outcome.value.reply;

  const guarded = guardTheme(allows, set).allowed;
  const { set: allowed, missing } = await applyFonts(guarded, config, find);
  const changed = themeChanges(config, allowed);
  if (!changed.length)
    return {
      failure: missing.length
        ? fr
          ? `Je ne trouve pas la police « ${missing[0]} » dans les catalogues de polices : rien n’a changé. Donnez-moi le nom d’une police de Google Fonts, Fontshare ou Fontsource, ou importez la vôtre dans IDEM.`
          : `I cannot find the “${missing[0]}” typeface in the font catalogs: nothing changed. Give me the name of a Google Fonts, Fontshare or Fontsource typeface, or import yours in IDEM.`
        : fr
          ? 'Ce réglage est déjà à sa limite : rien n’a changé.'
          : 'That setting is already at its limit: nothing changed.',
    };

  // Une adresse de police à `null` : retirée de la configuration (le compilateur charge alors la famille du catalogue).
  const next = applyTheme(config, allowed);
  for (const role of ['heading', 'body']) if (next.tokens?.typography?.[`${role}FontUrl`] === null) delete next.tokens.typography[`${role}FontUrl`];
  const compiled = designSystemFiles(next);
  const out: Record<string, string> = {};
  for (const [path, content] of Object.entries(compiled.files)) if (files[path] !== content && path !== DESIGN_SYSTEM_PATHS.version) out[path] = content;
  ChatLogger.info('SITE_EDIT', 'Design system retouché', { changed });
  return { files: out, reply: plain(reply) || (fr ? 'C’est fait.' : 'Done.') };
}

// ── Un fichier : des blocs RECHERCHER / REMPLACER, sinon le fichier entier ─

const EDIT_RULES = (fr: boolean) => [
  'Do what the request asks, fully and visibly: the person must SEE the change in the preview. Add, remove or restructure JSX, classes, icons (lucide-react) or elements as needed. A timid or partial edit is a failure.',
  'Change ONLY what the request is about. Keep everything else as it is: fonts, colours, layout, imports, other texts, the component name — unless the request asks to change them.',
  'Sizes and radii follow the design system classes (text-display, text-h1, text-h2, text-h3, text-h4, text-lead, text-body, text-small, rounded-card, rounded-button); colours use the theme classes (bg-primary, text-primary-foreground, bg-secondary, bg-accent, bg-muted, text-muted-foreground, border-border) or, when the person names a precise colour, an arbitrary value like bg-[#1f7a4d].',
  'Displayed texts are written t("…") (the site translates them) and internal links localePath("…"): to change a text, change the words inside t("…"); new texts may be written plainly, in the site\'s main language. Never translate a text yourself.',
  'Imports allowed: react, motion/react, lucide-react, @/components/ui, @/design-system, @/site/*, @/i18n, and the files already imported. NEVER import another package (no @fontsource/…, no npm package): it is not installed and the site breaks. Typefaces are changed in the design system, never in code.',
  `REPLY: one short sentence for the user, in ${fr ? 'French' : 'English'}, saying what changed, no file names.`,
];

const EDIT_SYSTEM = (fr: boolean, kind: string) =>
  [
    `You edit ONE file (${kind}) of a live showcase website (React, TSX, Tailwind CSS).`,
    ...EDIT_RULES(fr),
    'Answer ONLY with one or more blocks, each copying a SHORT passage EXACTLY as it is in the file (unique in the file), then its replacement:',
    '<<<<<<< SEARCH',
    '(exact passage)',
    '=======',
    '(replacement)',
    '>>>>>>> REPLACE',
    'After the blocks, one last line: REPLY: <the sentence>.',
  ].join('\n');

const REWRITE_SYSTEM = (fr: boolean, kind: string) =>
  [
    `You rewrite ONE file (${kind}) of a live showcase website (React, TSX, Tailwind CSS) so that it does what the person asks.`,
    ...EDIT_RULES(fr),
    'Answer with the COMPLETE new file in a single fenced code block, then one last line: REPLY: <the sentence>.',
  ].join('\n');

/** Ce que le fichier est, pour le modèle et pour les vérifications. */
function fileKind(path: string): { label: string; component: boolean; lang: 'tsx' | 'ts' | 'json' | 'css' | 'html' } {
  if (/^src\/sections\/[^/]+\/\w+\.tsx$/.test(path) || /^src\/components\/site\/(SiteHeader|SiteFooter)\.tsx$/.test(path)) return { label: 'a React component', component: true, lang: 'tsx' };
  const ext = (path.match(/\.(\w+)$/)?.[1] ?? 'ts') as 'tsx' | 'ts' | 'json' | 'css' | 'html';
  if (/^src\/pages\//.test(path)) return { label: 'a page that assembles the sections', component: false, lang: 'tsx' };
  return { label: `a ${ext.toUpperCase()} file`, component: false, lang: ext };
}

/** Un fichier qui n'est pas une section : il doit au moins se lire (syntaxe), sans être monté. */
async function checkPlainFile(code: string, lang: string): Promise<string[]> {
  if (lang === 'json') {
    try {
      JSON.parse(code);
      return [];
    } catch (error) {
      return [`invalid JSON: ${(error as Error).message}`];
    }
  }
  if (lang === 'css' || lang === 'html') return code.trim() ? (foreignImports(code).length ? [`imports of packages the site does not have: ${foreignImports(code).join(', ')}`] : []) : ['the file is empty'];
  const foreign = foreignImports(code);
  if (foreign.length) return [`imports of packages the site does not have: ${foreign.join(', ')}. Use only react, motion/react, lucide-react, clsx, tailwind-merge and the project's own files (@/…).`];
  try {
    await transform(code, { loader: lang === 'tsx' ? 'tsx' : 'ts', jsx: 'automatic', format: 'esm', logLevel: 'silent' });
    return [];
  } catch (error) {
    const first = (error as { errors?: Array<{ text: string; location?: { line: number } }> }).errors?.[0];
    return [first ? `syntax error line ${first.location?.line ?? '?'}: ${first.text}` : 'the file does not compile'];
  }
}


/** Les paquets installés dans un site du moteur ; tout autre import (`@fontsource/…`) casse l'aperçu. */
const SITE_PACKAGES = /^(react|react-dom|react\/jsx-runtime|react-dom\/client|motion|motion\/react|lucide-react|clsx|tailwind-merge)(\/|$)/;

/** Les imports d'un fichier qui ne sont ni du projet (`@/`, chemins relatifs) ni un paquet installé. */
export function foreignImports(code: string): string[] {
  const sources = [
    ...Array.from(String(code).matchAll(/^\s*import\s+(?:[^'";]+?\s+from\s+)?['"]([^'"]+)['"]/gm)).map((m) => m[1]),
    ...Array.from(String(code).matchAll(/@import\s+(?:url\()?['"]([^'"]+)['"]/g)).map((m) => m[1]),
  ];
  return [...new Set(sources.filter((src) => !src.startsWith('@/') && !src.startsWith('.') && !src.startsWith('/') && !/^https?:/.test(src) && !SITE_PACKAGES.test(src)))];
}

/**
 * Les fichiers du design system posés par IDEM (`config.ts`, `index.ts`, `motion.ts`) qui importent un paquet que le
 * site n'a pas — une retouche d'avant le 22/11/2026 y avait mis `@fontsource/…`, et l'aperçu ne s'affichait plus :
 * remis dans leur version du template.
 */
export function restoreDesignSystemModules(files: Record<string, string>): Record<string, string> {
  const template = templateFiles();
  const out: Record<string, string> = {};
  for (const [path, code] of Object.entries(files)) {
    if (!path.startsWith('src/design-system/') || !/\.tsx?$/.test(path) || typeof template[path] !== 'string') continue;
    if (code !== template[path] && foreignImports(code).length) out[path] = template[path];
  }
  return out;
}

/**
 * Le juge des garde-fous : la retouche change une police, des couleurs ou retire du contenu sans que l'aiguillage
 * l'ait vu venir. Plutôt que de refuser (la personne n'obtenait rien), un agent relit la demande et dit si elle
 * l'appelle. Un seul appel par sorte de changement et par retouche.
 */
export type AllowJudge = (kind: keyof EditAllows, evidence: string) => Promise<boolean>;

function createAllowJudge(caller: ModelCaller, request: string, recent: string, allows: EditAllows): AllowJudge {
  const asked = new Map<keyof EditAllows, Promise<boolean>>();
  const what: Record<keyof EditAllows, string> = {
    fonts: 'changing a typeface (font family)',
    colors: 'changing colours (text, background, button, border colours)',
    removal: 'removing a notable part of the content',
    dark: 'switching to a dark look',
  };
  return (kind, evidence) => {
    if (allows[kind]) return Promise.resolve(true);
    if (!asked.has(kind)) {
      asked.set(
        kind,
        caller
          .json<boolean>(
            `edit:allow:${kind}`,
            'You check whether a change made to a website is what the person asked for. Answer with JSON only.',
            `# The request\n${request.slice(0, 1200)}${recent ? `\n\n# Recent conversation\n${recent.slice(0, 1200)}` : ''}\n\n# The edit\nIt implies ${what[kind]}: ${evidence.slice(0, 300)}\n\nDoes the request, as the person means it (explicitly or implicitly: "make it stand out", "more lively", "simplify", "in green"), call for ${what[kind]}? Answer {"asked": true|false}.`,
            (raw) => ({ value: (raw as { asked?: unknown } | null)?.asked === true }),
            60
          )
          .then((outcome) => outcome.value === true)
          .catch(() => false)
      );
    }
    return asked.get(kind)!;
  };
}

/** Les garde-fous, chacun soumis au juge : ne reste que ce que la demande n'appelle vraiment pas. */
async function judgedProblems(before: string, after: string, allows: EditAllows, judge?: AllowJudge): Promise<{ problems: string[]; granted: Set<keyof EditAllows> }> {
  const granted = new Set<keyof EditAllows>((Object.keys(allows) as Array<keyof EditAllows>).filter((key) => allows[key]));
  const problems = guardEdit(before, after, allows);
  if (!problems.length || !judge) return { problems, granted };
  const kept: string[] = [];
  for (const problem of problems) {
    const kind: keyof EditAllows | null = /police/.test(problem) ? 'fonts' : /couleurs/.test(problem) ? 'colors' : /retire une grande partie/.test(problem) ? 'removal' : null;
    if (kind && (await judge(kind, problem))) {
      granted.add(kind);
      continue;
    }
    kept.push(problem);
  }
  return { problems: kept, granted };
}

const sameCode = (a: string, b: string) => a.replace(/\s+/g, ' ').trim() === b.replace(/\s+/g, ' ').trim();

async function editFile(
  caller: ModelCaller,
  request: string,
  change: string,
  path: string,
  files: Record<string, string>,
  review: ReviewContext,
  allows: EditAllows,
  fr: boolean,
  focus: PointedElement[] = [],
  judge?: AllowJudge
): Promise<{ code?: string; reply?: string; failure?: string }> {
  const before = files[path];
  const kind = fileKind(path);
  // Les éléments désignés dans ce fichier : leur code exact, et l'étendue que la retouche doit toucher.
  const spans = focus.map((element) => ({ element, span: locateElement(before, path, element) })).filter((f): f is { element: PointedElement; span: { start: number; end: number; tag: string } } => !!f.span);
  const pointedText = spans.length
    ? `\n\n# The element the person POINTED AT in the preview — the change applies to it (and what it contains)\n${spans
        .map(({ element, span }) => {
          const snippet = elementSnippet(before, span);
          return `<${span.tag}>${element.text ? ` « ${element.text.slice(0, 100)} »` : ''}, line ${snippet.line}:\n\`\`\`tsx\n${snippet.code}\n\`\`\``;
        })
        .join('\n')}\nDo not modify other elements of the file unless the request cannot be done otherwise.`
    : '';
  const target = targetOf(path, pagesFileOf(files) ?? '{}');
  const prompt = `# Request\n${request.slice(0, 1500)}${change && change !== request ? `\n\n# What to change in this file\n${change.slice(0, 1000)}` : ''}${pointedText}\n\n# The file: ${kind.component ? displayOf(path, false) : path}\n\`\`\`${kind.lang}\n${before}\n\`\`\``;

  /** Le code proposé, vérifié comme à la génération : `problem` le renvoie au modèle, `value` l'accepte. */
  const accept = async (code: string, text: string): Promise<Verdict<{ code: string; reply: string }>> => {
    const verdict = await acceptRaw(code, text);
    if ('problem' in verdict && verdict.problem) ChatLogger.debug('SITE_EDIT', 'Retouche refusée, renvoyée au modèle', { path, problem: verdict.problem.slice(0, 900).replace(/\n/g, ' | ') });
    return verdict;
  };
  const acceptRaw = async (code: string, text: string): Promise<Verdict<{ code: string; reply: string }>> => {
    if (sameCode(code, before)) return { problem: 'Your answer changes nothing visible. Make the change the person asked for.' };
    let keepColors = allows.colors;
    if (kind.component) {
      const guard = await judgedProblems(before, code, allows, judge);
      if (guard.problems.length) return { problem: guard.problems.join('\n') };
      keepColors = guard.granted.has('colors');
    }
    // Une demande dessinée : la retouche doit toucher l'élément désigné, pas un autre endroit du fichier.
    if (spans.length && !spans.some(({ span }) => touchesElement(before, code, span)))
      return { problem: `Your change does not touch the element the person pointed at (${spans.map(({ span }) => `<${span.tag}> line ${elementSnippet(before, span).line}`).join(', ')}). Make the change on that element.` };
    const reply = text.match(/^\s*REPLY:\s*(.+)$/m)?.[1] ?? '';
    if (!kind.component) {
      const problems = await checkPlainFile(code, kind.lang);
      return problems.length ? { problem: `Your edit breaks the file:\n${problems.map((p) => `- ${p}`).join('\n')}` } : { value: { code, reply } };
    }
    const checked = await reviewComponent(code, keepColors ? { ...review, keepColors: true } : review, target);
    if (checked.problems.length) return { problem: `Your edit breaks the component:\n${checked.problems.map((p) => `- ${p}`).join('\n')}\nFix it.` };
    if (checked.invented.length) return { problem: `Do not add facts that are not in the request or the project: ${checked.invented.join(', ')}.` };
    return { value: { code: checked.code, reply } };
  };

  // 1. Des blocs RECHERCHER / REMPLACER : seuls les passages changés voyagent.
  const patched = await caller.call<{ code: string; reply: string }>(
    `edit:${path}`,
    EDIT_SYSTEM(fr, kind.label),
    prompt,
    async (text) => {
      const patches = parsePatches(text);
      if (!patches.length) return { problem: 'Answer with SEARCH/REPLACE blocks only, then the REPLY line.' };
      const applied = applyPatches(before, patches);
      if (!applied.applied) return { problem: `None of your SEARCH passages is in the file (copy them exactly): ${applied.missed.join(' | ')}` };
      return accept(applied.code, text);
    },
    4000,
    0.2,
    2
  );
  if (patched.value) return { code: patched.value.code, reply: plain(patched.value.reply) };
  if (caller.accountLimit) return { failure: accountLimitMessage(fr) };

  // 2. Les blocs n'ont pas pu être posés : le fichier est réécrit en entier, avec les mêmes vérifications.
  ChatLogger.info('SITE_EDIT', 'Retouche par blocs impossible : fichier réécrit', { path });
  const budget = Math.min(16000, Math.max(2500, Math.round(estimateTokens(before) * 1.6) + 800));
  const rewritten = await caller.call<{ code: string; reply: string }>(
    `rewrite:${path}`,
    REWRITE_SYSTEM(fr, kind.label),
    prompt,
    async (text) => {
      const code = fencedCode(text);
      if (!code) return { problem: 'Answer with the complete file in ONE fenced code block, then the REPLY line.' };
      if (kind.component && !/export\s+default\s+function/.test(code)) return { problem: 'The file must keep its `export default function`.' };
      return accept(code, text);
    },
    budget,
    0.3,
    2
  );
  if (rewritten.value) return { code: rewritten.value.code, reply: plain(rewritten.value.reply) };
  return {
    failure: caller.accountLimit
      ? accountLimitMessage(fr)
      : fr
        ? `Je n’ai pas réussi à modifier ${kind.component ? displayOf(path, true) : 'ce fichier'} sans casser l’affichage : je l’ai laissé tel quel. Reformulez en décrivant ce que vous voulez voir.`
        : `I could not change ${kind.component ? displayOf(path, false) : 'this file'} without breaking the display, so I left it as it was. Rephrase by describing what you want to see.`,
  };
}

/** Le contenu du (plus long) bloc de code d'une réponse. */
function fencedCode(text: string): string | null {
  const blocks = Array.from(String(text || '').matchAll(/```[\w-]*\n([\s\S]*?)```/g)).map((m) => m[1]);
  if (!blocks.length) return null;
  return blocks.sort((a, b) => b.length - a.length)[0].trim() + '\n';
}

// ── Une nouvelle section ────────────────────────────────────────────────────

async function addSection(
  caller: ModelCaller,
  request: string,
  page: string,
  files: Record<string, string>,
  projectData: ProjectModel,
  facts: ReturnType<typeof readSiteFacts>,
  factsText: string,
  language: string,
  review: ReviewContext,
  base: string,
  after?: string
): Promise<{ files?: Record<string, string>; reply?: string; failure?: string }> {
  const fr = language === 'fr';
  const pagePath = `src/pages/${page}.tsx`;
  const pageCode = files[pagePath];
  if (typeof pageCode !== 'string' || !pageCode.includes('</main>')) return { failure: fr ? 'Je ne retrouve pas la page où ajouter la section.' : 'I cannot find the page to add the section to.' };
  const taken = new Set(siteComponents(files).map((c) => c.name));
  let name = base;
  for (let i = 2; taken.has(name); i++) name = `${base}${i}`;
  const path = `src/sections/${page}/${name}.tsx`;

  const ctx = contextFrom(files, facts, factsText, language);
  const authored = await authorComponent({
    caller,
    label: `add:${path}`,
    system: authorSystemPrompt(ctx),
    prompt: `# Le projet\n${factsText}\n\n# Ta tâche\nÉcris UNE nouvelle section pour la page « ${page} » de ce site, d'après cette demande de l'utilisateur :\n${request.slice(0, 1500)}\n\nLe composant s'appelle ${name} (export default function ${name}). Il suit le design system du site (mêmes classes que les autres sections).`,
    review,
    language,
    target: { path },
  });
  if (!authored.valid || !authored.code) return { failure: fr ? 'Je n’ai pas réussi à écrire cette section sans erreur : le site n’a pas changé. Réessayez en décrivant son contenu.' : 'I could not write this section without errors: the site is unchanged. Try again describing its content.' };

  // Sa place : après la section nommée dans la demande, sinon à la fin du contenu.
  // Sa place : après la section choisie par l'aiguillage, sinon à la fin du contenu.
  const anchor = siteComponents(files).find((c) => c.page === page && after && fold(c.name) === fold(after));
  const placed = insertSection(pageCode, name, `@/sections/${page}/${name}.tsx`, anchor?.name);
  void projectData;
  return { files: { [path]: authored.code, [pagePath]: placed }, reply: fr ? `J’ai ajouté la section demandée à la page « ${page} ».` : `I added the requested section to the “${page}” page.` };
}

/** Pose une section dans une page assemblée : son import, et sa place (après `after`, sinon avant `</main>`). */
export function insertSection(page: string, name: string, importPath: string, after?: string): string {
  const importLine = `import ${name} from '${importPath}';`;
  const lines = page.split('\n');
  const lastImport = lines.reduce((at, line, i) => (/^(\/\/ idem:skipped )?import /.test(line) ? i : at), -1);
  lines.splice(lastImport + 1, 0, importLine);
  let out = lines.join('\n');
  // Une section ajoutée n'est jamais la première : différée comme ses voisines, si la page l'est (template ≥ 1.4).
  const defer = /<SectionBoundary name="\w+" defer>/.test(page) ? ' defer' : '';
  const block = (indent: string) => `${indent}<SectionBoundary name="${name}"${defer}>\n${indent}  <${name} />\n${indent}</SectionBoundary>`;
  if (after) {
    const re = new RegExp(`(^([ \\t]*)<SectionBoundary name="${after}"(?: defer)?>[\\s\\S]*?^[ \\t]*</SectionBoundary>)`, 'm');
    if (re.test(out)) return out.replace(re, (whole: string, _all: string, indent: string) => `${whole}\n${block(indent)}`);
  }
  return out.replace(/^([ \t]*)<\/main>/m, (_m, indent: string) => `${block(`${indent}  `)}\n${indent}</main>`);
}

/** Une phrase pour le chat : sans balise, sans chemin, bornée. */
function plain(text: string): string {
  return String(text || '')
    .replace(/<[^>]+>/g, '')
    .replace(/`[^`]*`/g, '')
    .replace(/\b(src|public)\/[\w./-]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300);
}
