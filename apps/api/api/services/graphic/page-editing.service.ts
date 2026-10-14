/**
 * RETOUCHER ET REMETTRE EN PAGE SANS RÉÉCRIRE — les pages du business plan et du pitch deck gardent leur contenu et
 * leur code (`SectionModel.composition`). On en tire deux opérations économes :
 *
 *   la RETOUCHE d'une page (« remplace 2025 par 2026 », « le titre plus court », « le graphique plus grand ») : un
 *   modèle d'écriture lit les textes de la page PAR CLÉ et rend seulement les textes modifiés, et/ou une consigne de
 *   forme ; le code applique les mots et REJOUE la page (aucun auteur) — l'auteur n'intervient que pour la forme ;
 *
 *   la NOUVELLE MISE EN PAGE d'un document : chaque page est réécrite par l'auteur à partir de son contenu gardé —
 *   aucun texte n'est réécrit, aucun média recherché, aucun chiffre recopié.
 *
 * Une page sans contenu gardé (section d'avant, ou modifiée à la main) est retouchée comme avant (réécriture du
 * HTML), puis sa feuille Tailwind est recompilée ; elle ne se remet pas en page (il faudrait réécrire son contenu).
 */
import { applyTextEdits, buildContentMap, buildTokens, ContentError, GraphicRenderError, restyleFragment, SectionContent, sectionHtml } from '@idem/graphic-engine';
import logger from '../../config/logger';
import { AI_CONFIG } from '../../config/ai.config';
import { normalizeCreativity } from '../../models/creativity.model';
import type { ProjectModel } from '../../models/project.model';
import type { SectionModel } from '../../models/section.model';
import { withAiUsage } from '../../utils/ai-usage-context.util';
import { getRequestLanguage, SupportedLanguage } from '../../utils/request-language';
import { promptService } from '../prompt.service';
import { openGraphicDocument, pageComposition, projectBrand, speakerNotesHtml, withProjectArtDirection } from './graphic.service';
import { cacheService } from '../cache.service';
import { deliverableDocumentStore } from '../common/deliverable-document.store';
import type { PromptService } from '../prompt.service';

export type ComposedKind = 'businessPlan' | 'pitchDeck';

const CANVAS: Record<ComposedKind, { documentType: 'business-plan' | 'pitch-deck'; format: 'a4-portrait' | 'slide-16x9'; label: string }> = {
  businessPlan: { documentType: 'business-plan', format: 'a4-portrait', label: 'Business plan' },
  pitchDeck: { documentType: 'pitch-deck', format: 'slide-16x9', label: 'Pitch deck' },
};

/** Le fragment stocké d'une page : la page, puis (deck) les notes de l'orateur. */
const stored = (kind: ComposedKind, html: string, content: SectionContent): string => (kind === 'pitchDeck' && content.notes ? `${html}\n${speakerNotesHtml(content.notes)}` : html);

function parseJson(raw: string): Record<string, unknown> | null {
  const m = String(raw || '').replace(/```[a-z]*\n?/gi, '').match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const v = JSON.parse(m[0]);
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export interface ComposedEditResult {
  section: SectionModel;
  /** `words` : mots seuls, page rejouée ; `design` : l'auteur a réécrit la forme ; `both`. */
  mode: 'words' | 'design' | 'both' | 'none';
  applied: string[];
  refused: string[];
}

/**
 * Retouche une page dont le contenu est gardé. `null` : la consigne ne s'applique pas ainsi (contenu à ajouter,
 * page sans contenu gardé) — l'appelant retombe sur la réécriture du HTML.
 */
export async function editComposedSection(o: { userId: string; projectId: string; project: ProjectModel; kind: ComposedKind; section: SectionModel; instruction: string; language?: SupportedLanguage }): Promise<ComposedEditResult | null> {
  const composition = o.section.composition;
  if (!composition?.content || !composition.spec) return null;
  const content = composition.content;
  const listing = buildContentMap(content).listing;
  const lang = (o.language ?? getRequestLanguage()) === 'fr' ? 'French' : 'English';
  const system = [
    `You retouch ONE page of a ${CANVAS[o.kind].label}. The client wants THIS page changed, not a new one: change only what is asked.`,
    'You get the page texts by KEY (exact data blocks are not editable and are not listed as editable).',
    'Answer with ONE JSON object:',
    '{"set": {"<key>": "<new text>", …} — only the texts that change (an empty string removes that text),',
    ' "design": "the change of FORM asked (size, position, emphasis, colour, layout…), in English, precise — or null",',
    ' "needsNewContent": true only if the request asks for content that does not exist yet (a new paragraph, a new table, new figures)}',
    `Write new texts in ${lang}. Never invent a figure, a date or a name the client did not give.`,
  ].join('\n');
  const user = `PAGE TEXTS (key = text):\n${listing.slice(0, 12000)}\n\nCLIENT: ${o.instruction.slice(0, 1200)}`;
  const raw = await withAiUsage({ userId: o.userId, projectId: o.projectId, feature: o.kind, element: o.section.id ?? o.section.name, operation: 'edit' }, () =>
    promptService.runPrompt({ provider: AI_CONFIG.default.provider, modelName: AI_CONFIG.default.modelName, userId: o.userId, promptType: `${o.kind}-page-retouch` }, [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ])
  );
  const json = parseJson(promptService.getCleanAIText(raw));
  if (!json || json.needsNewContent === true) return null;
  const edits = json.set && typeof json.set === 'object' ? (json.set as Record<string, string>) : {};
  const design = typeof json.design === 'string' && json.design.trim() && json.design.trim().toLowerCase() !== 'null' ? json.design.trim().slice(0, 800) : '';
  const words = applyTextEdits(content, edits);
  if (!words.applied.length && !design) return { section: o.section, mode: 'none', applied: [], refused: words.refused };

  const canvas = CANVAS[o.kind];
  const graphic = await openGraphicDocument({ project: o.project, documentType: canvas.documentType, format: canvas.format, seed: `retouch:${o.projectId}:${content.id}`, creativity: normalizeCreativity(composition.level), sections: [{ id: content.id }], documentLabel: canvas.label, userId: o.userId });
  let out;
  try {
    out = await graphic.composeSection(words.section, design ? { revise: { spec: composition.spec, instruction: design } } : { replay: composition.spec });
  } catch (error) {
    // Des mots qui rendent le contenu invalide (une liste vidée sous son minimum) : la retouche est refusée, dite.
    if (error instanceof ContentError) {
      logger.warn('graphic.retouch_refused', { event: 'graphic.retouch_refused', section: content.id, issues: error.issues.map((i) => i.code) });
      return { section: o.section, mode: 'none', applied: [], refused: Object.keys(edits) };
    }
    throw error;
  }
  const next = pageComposition(graphic, o.section.name, content.id);
  const html = stored(o.kind, sectionHtml(out), words.section);
  return {
    section: { ...o.section, data: html, ...(next ? { composition: next } : {}), updatedAt: new Date() },
    mode: words.applied.length && design ? 'both' : design ? 'design' : 'words',
    applied: [...words.applied, ...(design ? [design] : [])],
    refused: words.refused,
  };
}

/** Recompile la feuille Tailwind d'une page du moteur modifiée ailleurs (éditeur, réécriture du HTML). */
export async function restyleSection(kind: ComposedKind, project: ProjectModel, html: string, o: { force?: boolean } = {}): Promise<string> {
  const { brand, direction } = projectBrand(project);
  return restyleFragment(html, buildTokens({ brand, direction, format: CANVAS[kind].format }), o);
}

export interface RelayoutReport {
  sections: SectionModel[];
  relaid: string[];
  /** Sections gardées telles quelles : sans contenu gardé (d'avant, ou modifiées à la main). */
  kept: string[];
  failed: string[];
}

/**
 * NOUVELLE MISE EN PAGE d'un document : chaque page dont le contenu est gardé est réécrite par l'auteur, au cran
 * choisi, en suivant le souhait du client s'il en donne un. Aucun texte n'est réécrit. Trois pages à la fois.
 */
export async function relayoutDocument(o: { userId: string; projectId: string; project: ProjectModel; kind: ComposedKind; documentId: string; sections: SectionModel[]; creativity?: unknown; note?: string }): Promise<RelayoutReport> {
  const canvas = CANVAS[o.kind];
  const composed = o.sections.filter((s) => s.composition?.content);
  const graphic = await openGraphicDocument({
    project: o.project,
    documentType: canvas.documentType,
    format: canvas.format,
    seed: `relayout:${o.documentId}:${Date.now().toString(36)}`,
    creativity: normalizeCreativity(o.creativity),
    sections: composed.map((s) => ({ id: (s.composition as NonNullable<SectionModel['composition']>).content.id, role: s.composition?.content.role })),
    documentLabel: canvas.label,
    userId: o.userId,
    ...(o.note?.trim() ? { layoutNote: o.note.trim().slice(0, 600) } : {}),
  });
  const report: RelayoutReport = { sections: [...o.sections], relaid: [], kept: o.sections.filter((s) => !s.composition?.content).map((s) => s.name), failed: [] };
  const total = composed.length;
  let next = 0;
  const worker = async () => {
    while (next < composed.length) {
      const i = next++;
      const section = composed[i];
      const content = (section.composition as NonNullable<SectionModel['composition']>).content;
      try {
        const out = await graphic.composeSection(content, { index: i + 1, total });
        const composition = pageComposition(graphic, section.name, content.id);
        const at = report.sections.findIndex((s) => s.name === section.name);
        report.sections[at] = { ...section, data: stored(o.kind, sectionHtml(out), content), ...(composition ? { composition } : {}), updatedAt: new Date() };
        report.relaid.push(section.name);
      } catch (error) {
        // Une page qui ne s'affiche pas garde son ancienne mise en page, et c'est dit.
        logger.warn('graphic.relayout_page_failed', { event: 'graphic.relayout_page_failed', section: section.name, error: error instanceof GraphicRenderError ? error.reason : (error as Error)?.message });
        report.failed.push(section.name);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(3, composed.length) }, worker));
  await graphic.remember();
  logger.info('graphic.relayout', { event: 'graphic.relayout', deliverable: o.kind, documentId: o.documentId, relaid: report.relaid.length, kept: report.kept.length, failed: report.failed.length, creativity: graphic.policy.level });
  return report;
}

const PDF_CACHE: Record<ComposedKind, string> = { businessPlan: 'business-plan-pdf', pitchDeck: 'pitch-deck-pdf' };

/**
 * La nouvelle mise en page d'un document ENREGISTRÉ : lu, remis en page, réenregistré, son PDF oublié. `null` :
 * document introuvable. Le cran retenu est enregistré avec le document (comme à la génération).
 */
export async function relayoutStoredDocument(o: { promptService: PromptService; userId: string; projectId: string; kind: ComposedKind; documentId?: string; creativity?: unknown; note?: string }): Promise<(RelayoutReport & { documentId: string }) | null> {
  const loaded = await deliverableDocumentStore.loadProject(o.userId, o.projectId);
  const document = loaded ? await deliverableDocumentStore.find(o.userId, o.projectId, o.kind, o.documentId) : null;
  if (!loaded || !document) return null;
  const project = await withProjectArtDirection(o.promptService, o.userId, o.projectId, loaded);
  const report = await relayoutDocument({ userId: o.userId, projectId: o.projectId, project, kind: o.kind, documentId: document.id, sections: document.sections ?? [], creativity: o.creativity, note: o.note });
  if (report.relaid.length) {
    const level = normalizeCreativity(o.creativity);
    await deliverableDocumentStore.update(o.userId, o.projectId, o.kind, document.id, (current) => ({
      ...current,
      // Les sections remises en page remplacent les leurs ; une section modifiée entre-temps garde sa version.
      sections: (current.sections ?? []).map((s) => (report.relaid.includes(s.name) ? report.sections.find((r) => r.name === s.name) ?? s : s)),
      design: { ...((current as { design?: object }).design ?? {}), level },
    }) as typeof current);
    await cacheService.delete(cacheService.generateAIKey(PDF_CACHE[o.kind], o.userId, o.projectId, document.id), { prefix: 'pdf' });
  }
  return { ...report, documentId: document.id };
}
