/**
 * LA MODIFICATION D'UN SITE VITRINE DÉJÀ GÉNÉRÉ — ciblée, économe, fidèle à la demande.
 *
 * Avant : une retouche (« diminue la taille des titres ») renvoyait au modèle TOUT le site et le laissait
 * réécrire ce qu'il voulait — beaucoup de jetons, et des changements non demandés (la police remplacée).
 * Ici :
 *
 *   aiguillage   le code décide de la cible (`routeEdit`) ; sinon un appel minuscule (liste des sections) ;
 *   apparence    une demande générale change UN réglage du design system (sans modèle pour les cas
 *                courants), recompilé par le compilateur du template : aucune section n'est réécrite ;
 *   section      le modèle reçoit SEULEMENT le fichier visé et rend des blocs RECHERCHER / REMPLACER ;
 *                les garde-fous refusent une police, une couleur ou une structure changées sans demande,
 *                le composant est monté avec les données du site (comme à la génération) ; un échec =
 *                rien n'est modifié, et la réponse le dit ;
 *   nouvelle     une section neuve écrite par l'auteur habituel, posée dans la page sans toucher au reste.
 *
 * La réponse est une phrase (ce qui a changé), jamais un récapitulatif technique.
 */

import type { Response } from 'express';
import { ProjectModel } from '../types/project.js';
import { getFallbackModelKeys } from '../config/modelConfig.js';
import { ChatLogger } from '../utils/logger.js';
import { ResilientStream } from '../utils/resilientStream.js';
import { authorComponent, authorSystemPrompt, ReviewContext, reviewComponent } from './authoring.js';
import { createFactGuard } from './factGuard.js';
import { localizeCode, siteLanguagesOf, syncCatalogs } from './i18n.js';
import { ModelCaller, Verdict } from './modelCaller.js';
import { contextFrom, displayOf, importPolicy, siteFilesOf, targetOf, themeOf } from './repair.js';
import { detectSiteLanguage, readSiteFacts, renderFacts } from './siteFacts.js';
import { SiteStream } from './stream.js';
import { DESIGN_SYSTEM_PATHS, designSystemFiles } from './template.js';
import {
  applyPatches,
  applyTheme,
  fold,
  guardEdit,
  guardTheme,
  parsePatches,
  quickTheme,
  routeEdit,
  siteComponents,
  THEME_PATHS,
  themeChanges,
} from './editPlan.js';
import { pagesFileOf } from './project.js';
import { buildSiteMap, DataField, mapIds, readSiteData, renderSiteMap, SiteMap, writeSiteData } from './siteMap.js';

export interface SiteEditInput {
  projectData: ProjectModel;
  language: string;
  /** La demande telle que l'utilisateur l'a écrite. */
  request: string;
  /** Les derniers échanges, en clair : « tu as dupliqué le menu » renvoie à ce qui vient d'être fait. */
  recent?: string;
  /** L'état actuel du site, envoyé par l'atelier (sections, pages, design system, données). */
  files: Record<string, string>;
  model: string;
  userId: string | null;
}

/** Un site du moteur de sites (pages assemblées et design system compilé) : il se retouche ici. */
export function isEditableSite(files: Record<string, string> | undefined): files is Record<string, string> {
  return !!files && typeof pagesFileOf(files) === 'string' && typeof files[DESIGN_SYSTEM_PATHS.source] === 'string' && siteComponents(files).length > 0;
}

const MAX_FILES = 3;

export function createSiteEditStream(input: SiteEditInput): ResilientStream {
  return {
    async pipeDataStreamToResponse(res: Response): Promise<void> {
      const { projectData, files, model, userId, request } = input;
      // Un site en plusieurs langues s'écrit dans sa langue principale (les autres suivent par traduction).
      const language = siteLanguagesOf(files)?.main ?? detectSiteLanguage(projectData.description ?? '', input.language);
      const fr = language === 'fr';
      const abort = new AbortController();
      res.on('close', () => {
        if (!res.writableEnded) abort.abort();
      });

      const facts = readSiteFacts(projectData, language);
      const factsText = renderFacts(facts, language);
      // Ce que l'utilisateur écrit dans sa demande est un fait : un texte qu'il fournit n'est pas « inventé ».
      const reference = `${factsText}\n${projectData.description ?? ''}\n${request}`;
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
      const writer = process.env.SITE_WRITER_MODEL?.trim();
      const caller = new ModelCaller(writer && getFallbackModelKeys(writer).includes(writer) ? writer : model, userId, abort.signal);

      const stream = new SiteStream(res);
      stream.open(model);
      const writes: Record<string, string> = {};
      const said: string[] = [];
      let failure = '';

      try {
        // 1. Où faire la retouche : la carte du site (calculée par le code) lue par l'agent d'aiguillage. Seul un
        //    texte cité, présent dans une seule section, est aiguillé sans lui.
        stream.note(fr ? 'Je repère ce qu’il faut modifier' : 'Finding what to change');
        const map = buildSiteMap(files);
        const quoted = routeEdit(request, files);
        const plan: EditPlan | null = quoted?.scope === 'files'
          ? { targets: quoted.paths.map((path) => ({ id: idOfPath(map, path), change: request })) }
          : await planEdit(caller, request, input.recent ?? '', map, fr);
        ChatLogger.info('SITE_EDIT', 'Retouche aiguillée', { plan, by: quoted ? 'code' : 'agent' });
        if (!plan) throw new Error('aiguillage impossible');
        const { components } = mapIds(map);

        // 2. Chaque partie visée, en parallèle : l'apparence, les données du site, les sections, une section neuve.
        const jobs: Array<Promise<void>> = [];
        if (plan.theme) {
          stream.note(fr ? 'Je règle l’apparence du site' : 'Adjusting the site’s look');
          jobs.push(
            editTheme(caller, `${request}\n${plan.theme}`, files, fr).then((outcome) => {
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
        for (const target of plan.targets.filter((t) => components.has(t.id)).slice(0, MAX_FILES)) {
          const path = components.get(target.id)!.path;
          stream.note(fr ? `Je modifie ${displayOf(path, true)}` : `Editing ${displayOf(path, false)}`);
          jobs.push(
            editFile(caller, request, target.change, path, files, review, fr).then((r) => {
              if (r.code && r.code !== files[path]) {
                writes[path] = r.code;
                if (r.reply) said.push(r.reply);
              } else if (r.failure) failure = r.failure;
            })
          );
        }
        await Promise.all(jobs);
        if (plan.newSection) {
          stream.note(fr ? 'J’ajoute la section' : 'Adding the section');
          const outcome = await addSection(caller, `${request}\n${plan.newSection.change}`, plan.newSection.page, { ...files, ...writes }, projectData, facts, factsText, language, review, plan.newSection.after);
          if (outcome.files) {
            Object.assign(writes, outcome.files);
            said.push(outcome.reply!);
          } else failure = outcome.failure || failure;
        }
      } catch (error) {
        ChatLogger.error('SITE_EDIT', 'Retouche en échec', error);
        failure = fr ? 'La modification n’a pas pu être faite. Votre site n’a pas changé : réessayez dans un instant.' : 'The change could not be made. Your site is unchanged: try again in a moment.';
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
        : failure || (fr ? 'Rien n’avait besoin de changer pour cette demande.' : 'Nothing needed to change for this request.');
      stream.text(`\n${reply.slice(0, 500)}\n`);

      ChatLogger.success('SITE_EDIT', 'Retouche terminée', { files: paths, promptTokens: caller.promptTokens, completionTokens: caller.completionTokens });
      stream.close({ promptTokens: caller.promptTokens, completionTokens: caller.completionTokens });
    },
  };
}

// ── L'aiguillage : la carte du site lue par un agent ───────────────────────

export interface EditPlan {
  /** Les parties à modifier (identifiants de la carte : `home/Hero`, `SiteHeader`, `data.navigation`) et quoi y changer. */
  targets: Array<{ id: string; change: string }>;
  /** Un changement de l'apparence de tout le site (design system). */
  theme?: string;
  /** Une section à ajouter. */
  newSection?: { page: string; after?: string; change: string };
}

/** L'identifiant de la carte d'un fichier de section, d'en-tête ou de pied de page. */
function idOfPath(map: SiteMap, path: string): string {
  return [...mapIds(map).components.values()].find((component) => component.path === path)?.id ?? path;
}

/**
 * L'agent d'aiguillage : il lit la carte du site, la demande et les derniers échanges, et dit OÙ la retouche se fait
 * et QUOI y changer, partie par partie. Il ne renvoie jamais la question à l'utilisateur : la personne ne connaît
 * pas les sections de son site, c'est à l'agent de les trouver.
 */
async function planEdit(caller: ModelCaller, request: string, recent: string, map: SiteMap, fr: boolean): Promise<EditPlan | null> {
  const { components, data, pages } = mapIds(map);
  const outcome = await caller.json<EditPlan>(
    'edit:plan',
    'You decide WHERE a change requested on a live website must be made, using the map of the site. You answer with JSON only.',
    [
      renderSiteMap(map),
      recent ? `\n# Recent conversation (what was just done)\n${recent.slice(0, 2500)}` : '',
      `\n# The request\n${request.slice(0, 1500)}`,
      `\n# Your answer
{"targets":[{"id":"<an id from the map in square brackets: a section like home/Hero, SiteHeader, SiteFooter, or data.navigation, data.primaryAction, data.contact, data.name, data.description>","change":"<precise instruction for that part, in ${fr ? 'French' : 'English'}: what to change, and what to keep>"}],"theme":"<only for a change of the whole site's look (fonts, sizes of all headings, colours, corners, spacing), else omit>","newSection":{"page":"<page key>","after":"<section name it follows, optional>","change":"<what the new section contains>"}}
Rules:
- The person does not know how the site is built: find the right part yourself from the map (their words, the texts shown, what each part reads). Never ask them.
- Data shared by several parts lives in data.* : the menu items are data.navigation (the header and footer only display them), the contact details are data.contact. A duplicated, missing or wrong menu item is fixed in data.navigation, not in the header.
- Choose the FEWEST parts that satisfy the request (at most ${MAX_FILES} sections). A request about one element touches one part.
- "newSection" only to ADD a section that does not exist yet.`,
    ].join('\n'),
    (raw): Verdict<EditPlan> => {
      const o = (raw ?? {}) as { targets?: unknown; theme?: unknown; newSection?: { page?: unknown; after?: unknown; change?: unknown } };
      const targets = (Array.isArray(o.targets) ? o.targets : [])
        .map((t) => ({ id: String((t as { id?: unknown })?.id ?? '').replace(/^\[|\]$/g, '').trim(), change: String((t as { change?: unknown })?.change ?? '').trim() }))
        .filter((t) => t.id);
      const unknown = targets.filter((t) => !components.has(t.id) && !(t.id.startsWith('data.') && data.includes(t.id.slice(5) as DataField)));
      if (unknown.length) return { problem: `Unknown ids: ${unknown.map((t) => t.id).join(', ')}. Use only ids written in square brackets in the map.` };
      const newSection =
        o.newSection && typeof o.newSection.page === 'string' && pages.includes(o.newSection.page)
          ? { page: o.newSection.page, after: typeof o.newSection.after === 'string' ? o.newSection.after.split('/').pop() : undefined, change: String(o.newSection.change ?? request) }
          : undefined;
      const theme = typeof o.theme === 'string' && o.theme.trim() ? o.theme.trim() : undefined;
      if (!targets.length && !theme && !newSection) return { problem: 'Choose at least one part of the site: the most likely one given the request and the map. Never answer with nothing.' };
      return { value: { targets: targets.map((t) => ({ id: t.id, change: t.change || request })), theme, newSection } };
    },
    600
  );
  return outcome.value ?? null;
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

async function editTheme(caller: ModelCaller, request: string, files: Record<string, string>, fr: boolean): Promise<{ files?: Record<string, string>; reply?: string; failure?: string }> {
  let config: Record<string, any>;
  try {
    config = JSON.parse(files[DESIGN_SYSTEM_PATHS.source]);
  } catch {
    return { failure: fr ? 'Le réglage du design de ce site est illisible : je ne peux pas le modifier sans risque.' : 'This site’s design settings are unreadable: I cannot change them safely.' };
  }

  // Les cas courants, sans modèle.
  let set: Record<string, unknown> | null = null;
  let reply = '';
  const quick = quickTheme(request, config);
  if (quick) {
    set = quick.set;
    reply = fr ? `${quick.fr}.` : `${quick.en}.`;
  } else {
    const current = { appearance: config.appearance, tokens: config.tokens, components: config.components, motion: config.motion };
    const outcome = await caller.json<{ set: Record<string, unknown>; reply: string }>(
      'edit:theme',
      'You adjust the design system of a live website. Change ONLY the settings the request is about; keep every other setting as it is. Answer with JSON only.',
      `Request: ${request.slice(0, 600)}\n\nCurrent settings:\n${JSON.stringify(current)}\n\nSettings you may change (dotted paths): ${THEME_PATHS.join(', ')}.\nNever change fonts unless the request asks for a font; never change colours unless it asks for a colour.\nAnswer {"set":{"path":value},"reply":"one short sentence for the user, in ${fr ? 'French' : 'English'}, saying what changed"}. Use {"set":{}} if no setting matches the request.`,
      (raw): Verdict<{ set: Record<string, unknown>; reply: string }> => {
        const o = (raw ?? {}) as { set?: Record<string, unknown>; reply?: unknown };
        const proposed = o.set && typeof o.set === 'object' ? o.set : {};
        const { allowed, refused } = guardTheme(request, proposed);
        if (!Object.keys(allowed).length && refused.length) return { problem: `Refused: ${refused.join('; ')}. Change only what the request asks.` };
        return { value: { set: allowed, reply: typeof o.reply === 'string' ? o.reply : '' } };
      },
      400
    );
    if (!outcome.value) return { failure: fr ? 'Je n’ai pas pu régler l’apparence demandée. Votre site n’a pas changé.' : 'I could not make that change to the look. Your site is unchanged.' };
    set = outcome.value.set;
    reply = outcome.value.reply;
  }

  const { allowed } = guardTheme(request, set);
  const changed = themeChanges(config, allowed);
  if (!changed.length) return { failure: fr ? 'Ce réglage est déjà à sa limite : rien n’a changé.' : 'That setting is already at its limit: nothing changed.' };

  const compiled = designSystemFiles(applyTheme(config, allowed));
  const out: Record<string, string> = {};
  for (const [path, content] of Object.entries(compiled.files)) if (files[path] !== content && path !== DESIGN_SYSTEM_PATHS.version) out[path] = content;
  ChatLogger.info('SITE_EDIT', 'Design system retouché', { changed, by: quick ? 'code' : 'model' });
  return { files: out, reply: plain(reply) || (fr ? 'C’est fait.' : 'Done.') };
}

// ── Une section : des blocs RECHERCHER / REMPLACER ──────────────────────────

const EDIT_SYSTEM = (fr: boolean) =>
  [
    'You edit ONE React component (TSX, Tailwind CSS) of a live showcase website.',
    'Golden rule: change ONLY what the request is about. Keep everything else byte for byte: fonts, colours, layout, structure, imports, other texts, the component name.',
    'Sizes and radii follow the design system classes (text-display, text-h1, text-h2, text-h3, text-h4, text-lead, text-body, text-small, rounded-card, rounded-button).',
    'Displayed texts are written t("…") (the site translates them) and internal links localePath("…"): to change a text, change the words inside t("…"); new texts may be written plainly, in the site\'s main language. Never translate a text yourself.',
    'Answer ONLY with one or more blocks, each copying a SHORT passage EXACTLY as it is in the file (unique in the file), then its replacement:',
    '<<<<<<< SEARCH',
    '(exact passage)',
    '=======',
    '(replacement)',
    '>>>>>>> REPLACE',
    `After the blocks, one last line: REPLY: <one short sentence for the user, in ${fr ? 'French' : 'English'}, saying what changed, no file names>.`,
  ].join('\n');

async function editFile(
  caller: ModelCaller,
  request: string,
  change: string,
  path: string,
  files: Record<string, string>,
  review: ReviewContext,
  fr: boolean
): Promise<{ code?: string; reply?: string; failure?: string }> {
  const before = files[path];
  const target = targetOf(path, pagesFileOf(files) ?? '{}');
  const prompt = `# Request\n${request.slice(0, 1500)}${change && change !== request ? `\n\n# What to change in this file\n${change.slice(0, 1000)}` : ''}\n\n# The file: ${displayOf(path, false)}\n\`\`\`tsx\n${before}\n\`\`\``;
  const outcome = await caller.call<{ code: string; reply: string }>(
    `edit:${path}`,
    EDIT_SYSTEM(fr),
    prompt,
    async (text): Promise<Verdict<{ code: string; reply: string }>> => {
      const patches = parsePatches(text);
      if (!patches.length) return { problem: 'Answer with SEARCH/REPLACE blocks only, then the REPLY line.' };
      const applied = applyPatches(before, patches);
      if (!applied.applied) return { problem: `None of your SEARCH passages is in the file (copy them exactly): ${applied.missed.join(' | ')}` };
      const guard = guardEdit(before, applied.code, request);
      if (guard.length) return { problem: guard.join('\n') };
      const checked = await reviewComponent(applied.code, review, target);
      if (checked.problems.length) return { problem: `Your edit breaks the component:\n${checked.problems.map((p) => `- ${p}`).join('\n')}\nFix it with SEARCH/REPLACE blocks on the ORIGINAL file.` };
      if (checked.invented.length) return { problem: `Do not add facts that are not in the request or the project: ${checked.invented.join(', ')}.` };
      const reply = text.match(/^\s*REPLY:\s*(.+)$/m)?.[1] ?? '';
      return { value: { code: checked.code, reply } };
    },
    3000,
    0.2,
    3
  );
  if (!outcome.value) {
    return {
      failure: fr
        ? `Je n’ai pas réussi à modifier ${displayOf(path, true)} sans abîmer le reste : je l’ai laissé tel quel.`
        : `I could not change ${displayOf(path, false)} without breaking the rest, so I left it as it was.`,
    };
  }
  return { code: outcome.value.code, reply: plain(outcome.value.reply) };
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
  after?: string
): Promise<{ files?: Record<string, string>; reply?: string; failure?: string }> {
  const fr = language === 'fr';
  const pagePath = `src/pages/${page}.tsx`;
  const pageCode = files[pagePath];
  if (typeof pageCode !== 'string' || !pageCode.includes('</main>')) return { failure: fr ? 'Je ne retrouve pas la page où ajouter la section.' : 'I cannot find the page to add the section to.' };
  const taken = new Set(siteComponents(files).map((c) => c.name));
  const base = nameFor(request);
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

/** Un nom de composant tiré de la demande (« ajoute une section témoignages » → Testimonials). */
function nameFor(request: string): string {
  const t = fold(request);
  const known: Array<[RegExp, string]> = [
    [/temoign|avis|review|testimonial/, 'Testimonials'],
    [/faq|question/, 'Faq'],
    [/tarif|prix|pricing|forfait/, 'Pricing'],
    [/galerie|photo|gallery|portfolio|realisation/, 'Gallery'],
    [/equipe|team/, 'Team'],
    [/contact|formulaire/, 'ContactBlock'],
    [/chiffre|stat/, 'Stats'],
    [/partenaire|partner|client/, 'Partners'],
    [/service|offre/, 'MoreServices'],
    [/newsletter|inscri/, 'Newsletter'],
  ];
  return known.find(([re]) => re.test(t))?.[1] ?? 'ExtraSection';
}

/** Pose une section dans une page assemblée : son import, et sa place (après `after`, sinon avant `</main>`). */
export function insertSection(page: string, name: string, importPath: string, after?: string): string {
  const importLine = `import ${name} from '${importPath}';`;
  const lines = page.split('\n');
  const lastImport = lines.reduce((at, line, i) => (/^(\/\/ idem:skipped )?import /.test(line) ? i : at), -1);
  lines.splice(lastImport + 1, 0, importLine);
  let out = lines.join('\n');
  const block = (indent: string) => `${indent}<SectionBoundary name="${name}">\n${indent}  <${name} />\n${indent}</SectionBoundary>`;
  if (after) {
    const re = new RegExp(`(^([ \\t]*)<SectionBoundary name="${after}">[\\s\\S]*?^[ \\t]*</SectionBoundary>)`, 'm');
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
