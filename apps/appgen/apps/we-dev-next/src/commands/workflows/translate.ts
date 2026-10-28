/**
 * /translate — une langue de plus pour un site du moteur de sites, sans réécrire une seule section.
 *
 * Chaque site sort déjà prêt (`siteEngine/i18n.ts`) : ses textes passent par `t()`, ses liens par `localePath()`.
 * Ajouter l'anglais, c'est donc seulement :
 *
 *   1. envelopper ce qui ne l'est pas encore (un site d'avant les langues, une section retouchée à la main) ;
 *   2. traduire le catalogue dans la nouvelle langue (l'agent traducteur, les traductions existantes gardées) ;
 *   3. ajouter la langue à la liste des pages (`src/site/pages.json` ; un site d’avant reçoit ses documents `en/…/index.html`) et le choix de la langue s’il manque.
 *
 * Sans langue nommée, la question est posée (la plus utile en tête, marquée « Recommandé »). Facturé comme une
 * retouche, au moment où la traduction part.
 */
import type { Response } from 'express';
import { consumeGeneration } from '../../services/billingService.js';
import { ModelCaller } from '../../siteEngine/modelCaller.js';
import { SiteStream } from '../../siteEngine/stream.js';
import { isEditableSite } from '../../siteEngine/edit.js';
import { catalogOf, languageLabel, localizeCode, localizeDataModule, parseLanguages, renderI18nFiles, siteLanguagesOf, syncCatalogs, withLanguageSwitcher } from '../../siteEngine/i18n.js';
import { shellsFromFiles } from '../../siteEngine/project.js';
import { templateFiles } from '../../siteEngine/template.js';
import { ChatLogger } from '../../utils/logger.js';
import { ChatChoices, ChoicesAnswer, createTextStream } from '../choices.js';
import { CommandContext, refusal, Responder } from '../types.js';

export interface TranslateContext extends CommandContext {
  /** Les fichiers du site ouvert dans l'atelier (ceux d'une retouche). */
  siteFiles?: Record<string, string>;
}

/** La langue principale d'un site d'avant les langues : celle de son document d'accueil. */
function mainLanguageOf(files: Record<string, string>): string {
  return siteLanguagesOf(files)?.main ?? (files['index.html']?.match(/<html lang="([a-z]{2})/)?.[1] || 'fr');
}

export function startTranslate(ctx: TranslateContext, args: string): Responder {
  const { fr } = ctx;
  if (!isEditableSite(ctx.siteFiles)) {
    return createTextStream(
      fr
        ? 'La traduction s’applique à un site créé ici. Créez votre site (`/site`) ou refaites le vôtre (`/redesign`), puis demandez la langue voulue.'
        : 'Translation applies to a site built here. Create your site (`/site`) or redesign yours (`/redesign`), then ask for the language you want.'
    );
  }
  const main = mainLanguageOf(ctx.siteFiles);
  const current = siteLanguagesOf(ctx.siteFiles)?.languages ?? [main];
  const asked = parseLanguages(args).filter((lang) => !current.includes(lang));
  if (asked.length) return translateSite(ctx, ctx.siteFiles, asked);
  if (parseLanguages(args).length) {
    return createTextStream(fr ? `Votre site est déjà en ${current.map((lang) => languageLabel(lang, true)).join(', ')}.` : `Your site is already in ${current.map((lang) => languageLabel(lang, false)).join(', ')}.`);
  }

  const proposals = [main === 'en' ? 'fr' : 'en', 'es', 'pt', 'ar'].filter((lang) => !current.includes(lang)).slice(0, 3);
  const choices: ChatChoices = {
    purpose: 'translate',
    questions: [
      {
        id: 'languages',
        question: fr ? 'Dans quelle langue traduire votre site ?' : 'Which language should your site be translated into?',
        help: fr ? 'Une vraie traduction, une page par langue, et le choix de la langue dans l’en-tête.' : 'A real translation, one page per language, and a language switch in the header.',
        options: proposals.map((lang, index) => ({
          value: lang,
          recommended: index === 0,
          label: fr ? `En ${languageLabel(lang, true)}` : `Into ${languageLabel(lang, false)}`,
        })),
        allowOther: true,
        placeholder: fr ? 'Ou une autre langue (ex. swahili)' : 'Or another language (e.g. Swahili)',
      },
    ],
  };
  return createTextStream(
    fr
      ? `Votre site est en ${current.map((lang) => languageLabel(lang, true)).join(', ')}. Ajoutons une langue : vos sections ne sont pas réécrites, seuls leurs textes sont traduits.`
      : `Your site is in ${current.map((lang) => languageLabel(lang, false)).join(', ')}. Let’s add a language: your sections are not rewritten, only their copy is translated.`,
    choices
  );
}

export function runTranslate(ctx: TranslateContext, answer: ChoicesAnswer): Responder {
  return startTranslate(ctx, String(answer.values.languages ?? ''));
}

function translateSite(ctx: TranslateContext, siteFiles: Record<string, string>, add: string[]): Responder {
  const { fr } = ctx;
  return {
    async pipeDataStreamToResponse(res: Response): Promise<void> {
      const billing = await consumeGeneration({ credentials: ctx.credentials, action: 'build', projectId: ctx.projectData?.id });
      if (!billing.allowed) return refusal(billing.refusal as Record<string, unknown> | undefined).pipeDataStreamToResponse(res);

      const abort = new AbortController();
      res.on('close', () => {
        if (!res.writableEnded) abort.abort();
      });
      const caller = new ModelCaller(ctx.model, ctx.userId, abort.signal);
      const stream = new SiteStream(res);
      stream.open(ctx.model);
      const names = add.map((lang) => languageLabel(lang, fr)).join(fr ? ' et ' : ' and ');
      stream.text(fr ? `Je traduis votre site en ${names}.\n\n` : `Translating your site into ${names}.\n\n`);
      stream.text(`<boltArtifact id="idem-translate-${Date.now().toString(36)}" title="${fr ? 'Traduction' : 'Translation'}">\n`);

      const main = mainLanguageOf(siteFiles);
      const files: Record<string, string> = { ...siteFiles };
      const writes: Record<string, string> = {};
      const write = (path: string, content: string) => {
        if (files[path] === content) return;
        files[path] = content;
        writes[path] = content;
      };

      // 1. Un site d'avant les langues reçoit le système du template ; ses textes passent par `t()`.
      if (!siteLanguagesOf(files)) {
        for (const [path, content] of Object.entries(templateFiles())) if (path.startsWith('src/i18n/') || path === 'src/components/site/language-switcher.tsx') write(path, content);
        write('src/i18n/config.json', renderI18nFiles(main, { [main]: {} })['src/i18n/config.json']);
      }
      if (files['src/site/data.ts']) write('src/site/data.ts', localizeDataModule(files['src/site/data.ts']));
      for (const path of Object.keys(files).filter((p) => /^src\/(sections\/[^/]+|components\/site)\/\w+\.tsx$/.test(p))) write(path, localizeCode(files[path], path).code);
      const header = files['src/components/site/SiteHeader.tsx'] ?? '';
      if (!/LanguageSwitcher/.test(header) && files['src/components/site/SiteFooter.tsx']) {
        const footer = withLanguageSwitcher(files['src/components/site/SiteFooter.tsx']);
        if (footer) write('src/components/site/SiteFooter.tsx', footer);
      }
      stream.note(fr ? 'Les textes de chaque section sont relevés' : 'Every section’s copy is collected');

      // 2. Le catalogue, traduit (les titres des pages compris).
      const languages = [...new Set([...(siteLanguagesOf(files)?.languages ?? [main]), ...add])];
      const titles = shellsFromFiles(files, languages, (_lang, text) => text).texts;
      const projectContext = [ctx.projectData?.description, ctx.projectData?.name].filter(Boolean).join(' · ').slice(0, 600);
      stream.note(fr ? `L’agent traducteur écrit la version ${names}` : `The translator writes the ${names} version`);
      const synced = await syncCatalogs({ caller, files, add, siteName: ctx.projectData?.name ?? '', context: projectContext, extraTexts: titles });
      if (abort.signal.aborted) return;
      for (const [path, content] of Object.entries(synced.files)) write(path, content);

      // 3. Les documents de chaque langue, titres traduits.
      const shells = shellsFromFiles(files, languages, (lang, text) => catalogOf(files, lang)[text] ?? text);
      for (const [path, content] of Object.entries(shells.files)) write(path, content);

      for (const [path, content] of Object.entries(writes)) stream.file(path, content);
      stream.text('</boltArtifact>\n');
      const untranslated = add.filter((lang) => Object.keys(catalogOf(files, lang)).length === 0);
      ChatLogger.info('SITE_I18N', 'Langues ajoutées', { add, languages, translated: synced.translated, files: Object.keys(writes).length });
      if (untranslated.length) {
        stream.text(
          fr
            ? `La traduction en ${untranslated.map((lang) => languageLabel(lang, true)).join(', ')} n’a pas abouti : le fournisseur IA n’a pas répondu. Relancez \`/translate\` dans un instant.`
            : `The ${untranslated.map((lang) => languageLabel(lang, false)).join(', ')} translation did not complete: the AI provider did not answer. Run \`/translate\` again shortly.`
        );
      } else {
        const first = add[0];
        stream.text(
          fr
            ? `Votre site est maintenant en ${languages.map((lang) => languageLabel(lang, true)).join(', ')}. Chaque langue a ses pages (par exemple \`/${first}/\`) et le choix de la langue est dans l’en-tête. Vos prochaines retouches seront traduites aussi.`
            : `Your site is now in ${languages.map((lang) => languageLabel(lang, false)).join(', ')}. Each language has its own pages (for example \`/${first}/\`) and the language switch is in the header. Your next edits will be translated too.`
        );
      }
      stream.close({ promptTokens: caller.promptTokens, completionTokens: caller.completionTokens });
    },
  };
}
