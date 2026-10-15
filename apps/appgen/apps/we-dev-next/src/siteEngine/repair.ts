/**
 * Ce qui reste à corriger après une génération, et sa correction à la demande.
 *
 * La génération corrige déjà tout ce qu'elle peut (correcteur, essais ciblés,
 * retrait des affirmations non vérifiées). S'il reste quelque chose, la fin du
 * message le dit en clair et porte une marque invisible (`idem:repair`) : le
 * chat en fait un bouton « Corriger automatiquement ». Un clic renvoie ici les
 * fichiers concernés, qui repassent par le même circuit, puis la page les
 * affiche de nouveau à leur place.
 */

import type { Response } from 'express';
import { ProjectModel } from '../types/project.js';
import { getFallbackModelKeys } from '../config/modelConfig.js';
import { ChatLogger } from '../utils/logger.js';
import { ResilientStream } from '../utils/resilientStream.js';
import { ThemeColors, themeColorsFromCss } from './autocorrect.js';
import {
  AuthoringContext,
  authorComponent,
  authorSystemPrompt,
  ImportPolicy,
  repairReminder,
  ReviewContext,
  reviewComponent,
} from './authoring.js';
import { OPTIONAL_MODULES } from './catalog.js';
import { createFactGuard } from './factGuard.js';
import { SiteManifest } from './manifest.js';
import { ModelCaller } from './modelCaller.js';
import { restoreInPage } from './project.js';
import { detectSiteLanguage, readSiteFacts, renderFacts } from './siteFacts.js';
import { SiteStream } from './stream.js';
import { compiler, DESIGN_SYSTEM_PATHS, FUNCTIONAL_DEPENDENCIES } from './template.js';

/** Les modules du projet qu'un composant peut importer, et leurs exports. */
export function importPolicy(dependencies: string[] = []): ImportPolicy {
  return {
    local: {
      '@/site/data': { names: ['site'] },
      '@/site/media': { names: ['media'] },
      '@/site/brand': { default: true, names: ['BRAND_NAME'] },
      '@/design-system': { names: ['motionTokens', 'componentConfig'] },
      '@/lib/utils': { names: ['cn'] },
      '@/lib/contact': { names: ['messageLink', 'contactChannel'] },
    },
    packages: dependencies.filter((name) => name in FUNCTIONAL_DEPENDENCIES),
  };
}

export interface Issue {
  path: string;
  /** Ce que l'utilisateur lit (« le pied de page », « la section « formulaire » (Contact) »). */
  display: string;
  /** Le fichier n'a pas pu être affiché. */
  broken: boolean;
  /** Affirmations encore présentes, absentes des faits. */
  unverified: string[];
}

/** La marque lue par le chat : la liste des fichiers à corriger. */
export const REPAIR_MARK = 'idem:repair';

/** La fin du message : ce qui reste, en clair, et la marque du bouton. */
export function renderRemarks(issues: Issue[], language: string): string {
  const fr = language === 'fr';
  const broken = issues.filter((issue) => issue.broken);
  const unverified = Array.from(new Set(issues.flatMap((issue) => issue.unverified)));
  if (!broken.length && !unverified.length) return '';

  const lines: string[] = [];
  if (broken.length) {
    const names = broken.map((issue) => issue.display).join(', ');
    lines.push(
      fr
        ? `${broken.length === 1 ? 'Un élément n’a' : `${broken.length} éléments n’ont`} pas pu être finalisé${broken.length === 1 ? '' : 's'} : ${names}. ${broken.length === 1 ? 'Il est conservé' : 'Ils sont conservés'} dans le projet sans être affiché${broken.length === 1 ? '' : 's'}.`
        : `${broken.length === 1 ? 'One element' : `${broken.length} elements`} could not be finalised: ${names}. ${broken.length === 1 ? 'It is' : 'They are'} kept in the project but not displayed.`
    );
  }
  if (unverified.length) {
    lines.push(
      fr
        ? `À vérifier, absent des informations du projet : ${unverified.slice(0, 8).map((item) => `« ${item} »`).join(', ')}.`
        : `Please check, not found in the project information: ${unverified.slice(0, 8).map((item) => `"${item}"`).join(', ')}.`
    );
  }
  const paths = Array.from(new Set(issues.filter((issue) => issue.broken || issue.unverified.length).map((issue) => issue.path)));
  return `\n${lines.join('\n\n')}\n\n<!-- ${REPAIR_MARK} ${JSON.stringify(paths)} -->\n`;
}

/** Le nom d'un fichier, tel qu'on le dit. */
function displayOf(path: string, fr: boolean): string {
  if (path.endsWith('/SiteHeader.tsx')) return fr ? "l'en-tête" : 'the header';
  if (path.endsWith('/SiteFooter.tsx')) return fr ? 'le pied de page' : 'the footer';
  const [, page, name] = path.match(/^src\/sections\/([^/]+)\/(\w+)\.tsx$/) ?? [];
  return name ? (fr ? `la section « ${name} » (${page})` : `the "${name}" section (${page})`) : path;
}

/** Le contexte d'écriture reconstruit depuis le projet (il n'y a plus de manifeste à ce stade). */
function contextFrom(files: Record<string, string>, facts: ReturnType<typeof readSiteFacts>, factsText: string, language: string): AuthoringContext {
  let pages: Array<{ path: string; module: string }> = [];
  try {
    pages = JSON.parse(files['idem.pages.json'] ?? '{}').pages ?? [];
  } catch {
    pages = [];
  }
  const manifest: SiteManifest = {
    pages: (pages.length ? pages : [{ path: '/', module: 'src/pages/home.tsx' }]).map((page) => {
      const key = page.module.replace(/^src\/pages\//, '').replace(/\.tsx$/, '');
      return { key, path: page.path, label: key, purpose: '', seoTitle: '', seoDescription: '', sections: [] };
    }),
    header: '',
    footer: '',
    components: OPTIONAL_MODULES,
    dependencies: [],
    keywords: [],
    businessType: '',
  };
  return { facts, factsText, manifest, language, components: OPTIONAL_MODULES, themeSummary: '' };
}

function themeOf(files: Record<string, string>): ThemeColors {
  const css = files[DESIGN_SYSTEM_PATHS.css];
  if (css) return themeColorsFromCss(css);
  try {
    return themeColorsFromCss(compiler.compileDesignSystem(JSON.parse(files[DESIGN_SYSTEM_PATHS.source] ?? '{}')).css);
  } catch {
    return {};
  }
}

export interface SiteRepairInput {
  projectData: ProjectModel;
  language: string;
  /** Les fichiers à corriger, plus les pages et le thème du projet. */
  files: Record<string, string>;
  /** Les fichiers à corriger (ceux de la marque `idem:repair`). */
  paths: string[];
  model: string;
  userId: string | null;
}

export function createSiteRepairStream(input: SiteRepairInput): ResilientStream {
  return {
    async pipeDataStreamToResponse(res: Response): Promise<void> {
      const { projectData, files, model, userId } = input;
      const language = detectSiteLanguage(projectData.description ?? '', input.language);
      const fr = language === 'fr';
      const abort = new AbortController();
      res.on('close', () => {
        if (!res.writableEnded) abort.abort();
      });

      const facts = readSiteFacts(projectData, language);
      const factsText = renderFacts(facts, language);
      const reference = `${factsText}\n${projectData.description ?? ''}`;
      const ctx = contextFrom(files, facts, factsText, language);
      const review: ReviewContext = {
        policy: importPolicy(),
        check: createFactGuard(reference, language),
        reference,
        theme: themeOf(files),
      };
      const writer = process.env.SITE_WRITER_MODEL?.trim();
      const caller = new ModelCaller(writer && getFallbackModelKeys(writer).includes(writer) ? writer : model, userId, abort.signal);
      const system = authorSystemPrompt(ctx);

      const targets = input.paths.filter((path) => typeof files[path] === 'string' && /^src\/(sections|components\/site)\/.+\.tsx$/.test(path));
      const stream = new SiteStream(res);
      stream.open(model);
      stream.text(fr ? 'Je corrige les éléments signalés.\n\n' : 'Fixing the flagged elements.\n\n');
      stream.text(`<boltArtifact id="idem-site-repair" title="${fr ? 'Corrections' : 'Fixes'}">\n`);

      const issues: Issue[] = [];
      const fixed: string[] = [];

      await Promise.all(
        targets.map(async (path) => {
          const display = displayOf(path, fr);
          const current = await reviewComponent(files[path], review);
          let code = current.code;
          let valid = !current.problems.length;
          let unverified = current.invented;

          if (current.problems.length || current.invented.length) {
            stream.note(fr ? `Je corrige ${display}` : `Fixing ${display}`);
            const prompt = `# Le projet\n${factsText}\n\n# Ta tâche\nCorrige le fichier ${path} de ce site.\n\n${repairReminder(
              current.code,
              current.problems.length ? current.problems : current.invented,
              current.problems.length ? 'form' : 'facts'
            )}`;
            const authored = await authorComponent({ caller, label: `repair:${path}`, system, prompt, review, language });
            if (authored.valid || authored.code) code = authored.valid ? authored.code : code;
            valid = authored.valid || valid;
            unverified = authored.valid ? authored.unverified : unverified;
          }

          if (abort.signal.aborted) return;
          if (code !== files[path]) stream.file(path, code);
          if (valid) fixed.push(path);
          if (!valid || unverified.length) issues.push({ path, display, broken: !valid, unverified });
        })
      );
      if (abort.signal.aborted) return;

      // Les composants corrigés reprennent leur place dans les pages.
      const names = fixed.map((path) => path.match(/(\w+)\.tsx$/)![1]);
      for (const [path, content] of Object.entries(files)) {
        if (!/^src\/pages\/[^/]+\.tsx$/.test(path)) continue;
        const restored = restoreInPage(content, names);
        if (restored !== content) stream.file(path, restored);
      }

      stream.text('</boltArtifact>\n');
      const remarks = renderRemarks(issues, language);
      stream.text(remarks || (fr ? '\nTout est corrigé : les éléments sont de nouveau affichés.\n' : '\nAll fixed: the elements are displayed again.\n'));

      ChatLogger.success('SITE_REPAIR', 'Correction demandée', {
        targets: targets.length,
        fixed: fixed.length,
        remaining: issues.length,
        promptTokens: caller.promptTokens,
        completionTokens: caller.completionTokens,
      });
      stream.close({ promptTokens: caller.promptTokens, completionTokens: caller.completionTokens });
    },
  };
}
