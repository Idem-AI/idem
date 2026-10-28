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
  EditRoute,
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

export interface SiteEditInput {
  projectData: ProjectModel;
  language: string;
  /** La demande telle que l'utilisateur l'a écrite. */
  request: string;
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
        // 1. La cible : le code d'abord, sinon un appel minuscule.
        const route: EditRoute = routeEdit(request, files) ?? (await askRoute(caller, request, files, fr));
        ChatLogger.info('SITE_EDIT', 'Retouche aiguillée', { route, by: routeEdit(request, files) ? 'code' : 'model' });

        if (route?.scope === 'theme') {
          stream.note(fr ? 'Je règle l’apparence du site' : 'Adjusting the site’s look');
          const outcome = await editTheme(caller, request, files, fr);
          if (outcome.files) Object.assign(writes, outcome.files);
          if (outcome.reply) said.push(outcome.reply);
          else failure = outcome.failure || '';
        } else if (route?.scope === 'files') {
          const paths = route.paths.filter((p) => typeof files[p] === 'string').slice(0, MAX_FILES);
          const results = await Promise.all(
            paths.map(async (path) => {
              stream.note(fr ? `Je modifie ${displayOf(path, true)}` : `Editing ${displayOf(path, false)}`);
              return { path, ...(await editFile(caller, request, path, files, review, fr)) };
            })
          );
          for (const r of results) {
            if (r.code && r.code !== files[r.path]) {
              writes[r.path] = r.code;
              if (r.reply) said.push(r.reply);
            } else if (r.failure) failure = r.failure;
          }
        } else if (route?.scope === 'new-section') {
          stream.note(fr ? 'J’ajoute la section' : 'Adding the section');
          const outcome = await addSection(caller, request, route.page, files, projectData, facts, factsText, language, review);
          if (outcome.files) {
            Object.assign(writes, outcome.files);
            said.push(outcome.reply!);
          } else failure = outcome.failure || '';
        } else {
          failure = fr
            ? 'Je n’ai pas compris quelle partie du site modifier. Précisez la section (par exemple « le titre du haut de page » ou « le pied de page ») ou l’élément à changer.'
            : 'I could not tell which part of the site to change. Name the section (for example “the top banner title” or “the footer”) or the element to change.';
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

// ── Aiguillage par le modèle (quand le code ne tranche pas) ─────────────────

async function askRoute(caller: ModelCaller, request: string, files: Record<string, string>, fr: boolean): Promise<EditRoute> {
  const components = siteComponents(files);
  const list = components
    .map((c) => {
      const heading = files[c.path].match(/>([^<>{}\n]{6,80})</)?.[1]?.trim() ?? '';
      return `- ${c.name}${c.page ? ` (page ${c.page})` : ''}${heading ? ` : « ${heading} »` : ''}`;
    })
    .join('\n');
  const outcome = await caller.json<EditRoute>(
    'edit:route',
    'You route an edit request on a website. Answer with JSON only.',
    `Sections of the site:\n${list}\n\nRequest: ${request.slice(0, 600)}\n\nAnswer {"scope":"theme"} for a change of the whole site's look (fonts, sizes, colours, corners, spacing), {"scope":"files","files":["Name"]} for at most ${MAX_FILES} sections to edit, {"scope":"new-section","page":"key"} to add a new section, or {"scope":"none"} if unclear.`,
    (raw): Verdict<EditRoute> => {
      const o = (raw ?? {}) as { scope?: string; files?: unknown; page?: unknown };
      if (o.scope === 'theme') return { value: { scope: 'theme' } };
      if (o.scope === 'new-section' && typeof o.page === 'string') {
        const page = components.find((c) => c.page === o.page)?.page ?? components.find((c) => c.page)?.page;
        return page ? { value: { scope: 'new-section', page } } : { value: null };
      }
      if (o.scope === 'files' && Array.isArray(o.files)) {
        const paths = o.files
          .map((n) => components.find((c) => fold(c.name) === fold(String(n)))?.path)
          .filter((p): p is string => !!p)
          .slice(0, MAX_FILES);
        return paths.length ? { value: { scope: 'files', paths } } : { problem: 'Use the exact section names from the list.' };
      }
      return { value: null };
    },
    200
  );
  void fr;
  return outcome.value ?? null;
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
  if (!changed.length) return { failure: fr ? 'Ce réglage est déjà à sa limite, ou la demande ne concerne pas l’apparence générale. Précisez la section à modifier.' : 'That setting is already at its limit, or the request is not about the overall look. Name the section to change.' };

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
  path: string,
  files: Record<string, string>,
  review: ReviewContext,
  fr: boolean
): Promise<{ code?: string; reply?: string; failure?: string }> {
  const before = files[path];
  const target = targetOf(path, pagesFileOf(files) ?? '{}');
  const prompt = `# Request\n${request.slice(0, 1500)}\n\n# The file: ${displayOf(path, false)}\n\`\`\`tsx\n${before}\n\`\`\``;
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
        ? `Je n’ai pas réussi à modifier ${displayOf(path, true)} sans abîmer le reste : je l’ai laissé tel quel. Reformulez en précisant l’élément (un titre, un bouton, un texte).`
        : `I could not change ${displayOf(path, false)} without breaking the rest, so I left it as it was. Try again naming the element (a heading, a button, a text).`,
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
  review: ReviewContext
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
  const anchor = siteComponents(files).find((c) => c.page === page && fold(request).includes(fold(c.name)));
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
