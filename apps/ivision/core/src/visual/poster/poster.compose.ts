/**
 * LE COMPOSITEUR DE VISUELS — partagé par IDEM et iVision.
 *
 * Les mots (rédacteur, tous crans, contrôlés) et la photo (celle de l'utilisateur, celles de la
 * marque classées par la vision, sinon banque ou génération VÉRIFIÉES) sont communs. Puis la
 * MÉTHODE change avec le cran — plus on monte, plus l'IA porte la conception, et plus on vérifie :
 *
 *   Low     les RÈGLES : le meilleur gabarit dessiné par le code pour l'intention
 *   Medium  les règles, avec un tirage parmi les trois meilleurs (variété)
 *   High    la DIRECTION ARTISTIQUE : l'IA choisit la composition, REGARDE le rendu (critique
 *           visuelle) et en choisit une autre qui corrige ce qu'elle a vu (2 révisions)
 *   Max     la MISE EN PAGE PAR L'IA (poster.layout.ts) : deux designers posent eux-mêmes chaque
 *           élément, boucle rendu → mesure → critique → correction (3 tours), la critique compare
 *   Ultra   le VISUEL D'AUTEUR (poster.author.ts) : un directeur de création invente deux concepts,
 *           un designer par concept code le HTML/CSS complet dans le contrat de la charte, même
 *           boucle, la critique compare
 *
 * Partout : rendu MESURÉ (ajustage, débordement, chevauchement, marges, contraste lu sur les
 * pixels) — un défaut mesuré écarte une composition. Si la méthode d'un cran n'aboutit pas, ou
 * reste sous la qualité visée, la direction artistique sur les gabarits sert de filet (la critique
 * compare), et le résultat le dit (`method`, `fellBack`).
 */
import crypto from 'crypto';
import { atLeast, CreativityLevel } from '../../creativity/levels';
import { CreativeOrchestrator, type AgentTask } from '../../creativity/orchestrator';
import { agentLines, menuLines, LETTERS } from '../../creativity/agent-io';
import logger from '../../runtime/logger';
import type { VisualAuditReport } from '../../design/visualAudit';
import { imageSourcingService, ImageSourcingPreferences, SourcedImage } from '../image.sourcing';
import type { FlyerFormat, VisualBrandContext, VisualContent, VisualMeta } from '../visual.model';
import { copyTask, inferPosterIntent, type PosterBrief } from './poster.copy';
import { classifyImage, posterImage, rankByRelevance } from './poster.images';
import { posterFonts, renderPoster, type PosterRender } from './poster.render';
import { compareRenders, reviewPoster, type Critique, type CritiqueContext } from './poster.critic';
import { colorTokens, type DesignBrief } from './poster.canvas';
import { designLoop, type LoopOutcome } from './poster.loop';
import { buildLayout, layoutAngles, writeLayout, type LayoutDesign } from './poster.layout';
import { buildAuthored, conceptCopy, inventConcepts, writeAuthored, type AuthoredDesign } from './poster.author';
import { schemesOf, specFor, type SpecInput } from './poster.spec';
import { POSTER_TEMPLATES, TEMPLATE_BY_ID } from './poster.templates';
import type { PosterChoice, PosterCopy, PosterImage, PosterIntent, PosterScheme, PosterTreatment } from './poster.types';

export interface PosterPorts {
  agentCall?: import('../../creativity/orchestrator').AgentCall;
}

export interface PosterRequest {
  userId: string;
  brandId: string;
  content: VisualContent;
  context: VisualBrandContext;
  format: FlyerFormat;
  tag: string;
  seedKey: string;
  creativity: CreativityLevel;
  /** Gabarits des derniers visuels de la marque (variété). */
  recentLayouts?: string[];
  /** La photo de l'utilisateur. */
  photoUrl?: string;
  /** Les images de la marque (site scanné, projet, imports) : seules les PHOTOS sont gardées. */
  brandPhotos?: string[];
  /** Pas de photo (demandé). */
  skipImage?: boolean;
  sourcing?: ImageSourcingPreferences;
  /** Fond sombre admis (demande explicite, ou les propres visuels de la marque sont sombres). */
  allowDark?: boolean;
  /** Retour sur la version précédente (« pas assez pro, autre chose ») et ce qu'elle était. */
  feedback?: string;
  avoid?: { template?: string; scheme?: string }[];
  /** L'avancement réel (« copy », « media », « concept », « design », « critique »…), pour l'interface. */
  onStage?: (stage: string, state: 'running' | 'done') => void;
  /** Image modèle analysée : sa structure guide le choix (photo, typographie, citation…). */
  reference?: { layout?: string; structure?: string; hasPhoto?: boolean; description?: string };
}

export interface PosterResult {
  html: string;
  png: Buffer;
  parsed: Partial<VisualMeta> & { layout: string; scheme: string; copy: PosterCopy };
  sourced: SourcedImage | null;
  audit: VisualAuditReport;
  candidates: { choice: PosterChoice; score: number; blocking: boolean }[];
}

// ─── Direction artistique → affinités des gabarits ───────────────────────────

const STYLE_BOOSTS: Record<string, Partial<Record<string, number>>> = {
  minimalism: { editorial: 1.2, typographic: 0.8, split: 0.6, quote: 0.6 },
  swiss: { typographic: 1.2, split: 1, editorial: 0.8, offer: 0.6 },
  editorial: { editorial: 1.4, quote: 0.8, split: 0.6 },
  'pop-art': { band: 1, typographic: 1, offer: 0.8, card: 0.8, event: 0.6 },
  maximalism: { band: 1, mosaic: 1, typographic: 0.8 },
  'collage-art': { mosaic: 1.2, card: 0.8 },
  'corporate-modern': { split: 1, editorial: 0.8, card: 0.6 },
  brutalism: { typographic: 1.4, offer: 0.8 },
  glassmorphism: { card: 1, fullbleed: 0.8 },
};

const hash = (s: string) => parseInt(crypto.createHash('sha1').update(s).digest('hex').slice(0, 8), 16);

/** Le brief d'image (banque ou génération), sans texte dans l'image. */
function imageBriefFor(copy: PosterCopy, ctx: VisualBrandContext, format: FlyerFormat, subject: string) {
  const orientation = format === 'story' || format === 'post' || format === 'a4' ? ('portrait' as const) : format === 'banner' ? ('landscape' as const) : ('square' as const);
  const what = `${subject} — ${ctx.businessType}`.slice(0, 160);
  return {
    searchQuery: `${copy.headline} ${ctx.businessType}`.replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter((w) => w.length > 3).slice(0, 5).join(' ') || ctx.businessType,
    generationPrompt: `Authentic editorial photograph for ${ctx.brandName} (${ctx.businessType}): ${what}. Natural light, real people and places, African context when people appear, shallow depth of field, generous empty space for a headline. ${ctx.artDirection?.imagePromptModifier || ''}`.slice(0, 900),
    negativePrompt: 'text, letters, captions, watermark, logo, signage, distorted faces, extra fingers, oversaturated HDR, collage, frame, border',
    orientation,
  };
}

// ─── Les candidats ───────────────────────────────────────────────────────────

interface Candidate extends PosterChoice {
  weight: number;
}

function candidatesFor(input: SpecInput, intent: PosterIntent, req: PosterRequest, schemes: PosterScheme[]): Candidate[] {
  const style = String(req.context.artDirection?.styleId || '').toLowerCase();
  const boosts = STYLE_BOOSTS[style] || {};
  const recent = (req.recentLayouts || []).slice(-4);
  const avoid = req.avoid || [];
  const darkWanted = !!req.allowDark;
  const seed = hash(req.seedKey);
  const out: Candidate[] = [];
  for (const t of POSTER_TEMPLATES) {
    if (t.needsImage && !input.image) continue;
    const probe = { copy: input.copy, image: input.image, extraImages: input.extraImages || [] };
    if (t.needs && !t.needs(probe)) continue;
    // Une promo dont le titre ne porte pas le chiffre : seule l'affiche « offre » le met en grand.
    if (input.copy.offer && t.id !== 'offer' && !input.copy.headline.includes((input.copy.offer.match(/\d+/) || [''])[0])) continue;
    // Un modèle d'image : sa structure d'abord (photo / typographique / citation).
    let refBonus = 0;
    if (req.reference?.structure) {
      const s = req.reference.structure;
      refBonus = (s === 'photo' && t.needsImage) || (s === 'type' && t.id === 'typographic') || (s === 'quote' && t.id === 'quote') || (s === 'fact' && (t.id === 'offer' || t.id === 'event')) ? 1.5 : -0.6;
    }
    const order = [...t.schemes, ...(darkWanted && !t.schemes.includes('ink') && t.id !== 'fullbleed' ? (['ink'] as const) : [])];
    order.forEach((sid, rank) => {
      if (!schemes.some((s) => s.id === sid)) return;
      // Un retour (« autre chose ») écarte la composition précédente, toutes palettes confondues.
      if (avoid.some((a) => a.template === t.id)) return;
      let w = (t.intents[intent] ?? 0.5) + (boosts[t.id] || 0) + refBonus + Math.max(0, 0.45 - rank * 0.2);
      if (sid === 'ink' && darkWanted) w += 0.5;
      w -= recent.filter((r) => r === t.id).length * 0.7 + (recent[recent.length - 1] === t.id ? 0.8 : 0);
      // Une photo pertinente (surtout celle de la marque) mérite d'être vue.
      if (input.image && t.needsImage) w += input.image.origin === 'brand' || input.image.origin === 'user' ? 0.9 : 0.4;
      w += ((hash(`${seed}:${t.id}:${sid}`) % 1000) / 1000) * 0.3;
      out.push({ template: t.id, scheme: sid, mirror: hash(`${seed}:${t.id}:m`) % 3 === 0, treatment: 'natural', weight: w });
    });
  }
  return out.sort((a, b) => b.weight - a.weight);
}

/** Le directeur artistique : il choisit 1, 3 ou 4 compositions dans le menu du code. */
/** Ce que la direction artistique a vu de son choix précédent. */
interface DirectorReview {
  picked: string;
  score: number;
  fixes: string[];
}

function artDirectorTask(menu: Candidate[], copy: PosterCopy, req: PosterRequest, schemes: PosterScheme[], count: number, treatments: boolean, hasPhoto: boolean, review?: DirectorReview): AgentTask<{ picks: Candidate[]; emphasis?: number }> {
  const describe = (c: Candidate) => `${TEMPLATE_BY_ID.get(c.template)!.summary}; colours: ${schemes.find((s) => s.id === c.scheme)!.label}`;
  const ad = req.context.artDirection;
  const words = copy.headline.split(/\s+/);
  return {
    role: 'posterArtDirector',
    minLevel: 'high',
    prompt: () =>
      menu.length < 2 && !review
        ? null
        : {
            system: [
              `You are the senior art director of ${req.context.brandName}. Pick the ${count > 1 ? `${count} most professional, on-brand and DIFFERENT compositions` : 'single most professional, on-brand composition'} for this visual from the menu. Output ONLY:`,
              count > 1 ? `choices: ${count} letters, best first` : 'choice: one letter',
              treatments ? 'treatment: natural | duotone | mono (photo treatment, natural unless the brand style calls for it)' : '',
              'emphasis: the one word of the headline to set in the brand colour',
            ]
              .filter(Boolean)
              .join('\n'),
            user: [
              `BRAND: ${req.context.brandName} — ${req.context.businessType}; tone: ${req.context.tone}`,
              ad ? `ART DIRECTION: ${ad.styleName || ad.styleId} — ${ad.tagline || ''}. DO: ${(ad.dos || []).slice(0, 3).join('; ')}. DON'T: ${(ad.donts || []).slice(0, 3).join('; ')}` : '',
              `HEADLINE: "${copy.headline}"${copy.sub ? ` / ${copy.sub}` : ''}${copy.offer ? ` · OFFER ${copy.offer}` : ''}${copy.facts.length ? ` · FACTS: ${copy.facts.map((f) => f.text).join(', ')}` : ''}`,
              req.feedback ? `THE USER REJECTED THE PREVIOUS VERSION: "${req.feedback.slice(0, 160)}"` : '',
              review ? `YOU PICKED ${review.picked}; IT WAS RENDERED AND REVIEWED ${review.score}/10. The creative director says: ${review.fixes.join(' / ')}. Pick ANOTHER composition (or the same layout with other colours or photo treatment) that solves this.` : '',
              hasPhoto ? 'A relevant photo of the brand itself is available: real people sell better than type alone — show it unless the message is purely typographic.' : '',
              'MENU:',
              ...menuLines(menu.map((c) => `${c.template}/${c.scheme}`), (id) => describe(menu.find((c) => `${c.template}/${c.scheme}` === id)!)),
            ]
              .filter(Boolean)
              .join('\n'),
          },
    parse: (raw) => {
      const l = agentLines(raw);
      const letters = (l.choices || l.choice || raw).toLowerCase().match(/\b[a-p]\b/g) || [];
      const picks: Candidate[] = [];
      for (const letter of letters) {
        const c = menu[LETTERS.indexOf(letter)];
        if (c && !picks.includes(c)) picks.push(c);
        if (picks.length >= count) break;
      }
      if (!picks.length) return undefined;
      const treatment = (['duotone', 'mono'] as const).find((t) => (l.treatment || '').toLowerCase().includes(t));
      const w = (l.emphasis || '').toLowerCase().replace(/[^\p{L}\p{N}%'-]/gu, '');
      const at = w ? words.findIndex((x) => x.toLowerCase().replace(/[^\p{L}\p{N}%'-]/gu, '') === w) : -1;
      return { picks: treatments && treatment ? picks.map((p, i) => (i === 1 ? { ...p, treatment } : p)) : picks, ...(at >= 0 ? { emphasis: at } : {}) };
    },
    fallback: () => ({ picks: menu.slice(0, count) }),
  };
}

// ─── La composition ─────────────────────────────────────────────────────────

export async function composePoster(ports: PosterPorts, req: PosterRequest): Promise<PosterResult> {
  const started = Date.now();
  const ctx = req.context;
  const level = req.creativity;
  // Le texte et les choix sont courts mais les modèles ont des pointes de lenteur : 45 s.
  const orch = new CreativeOrchestrator({ level, call: ports.agentCall, timeoutMs: { agents: 45_000, critic: 60_000 } });
  const message = [req.content.title, req.content.hook].filter(Boolean).join(' — ');
  const brief: PosterBrief = { message, details: req.content.description, brandName: ctx.brandName, businessType: ctx.businessType, valueProposition: ctx.valueProposition, tone: ctx.tone, language: ctx.language || 'fr' };
  const intent = inferPosterIntent(`${message} ${req.content.description || ''}`);

  const stage = (name: string, state: 'running' | 'done') => {
    try {
      req.onStage?.(name, state);
    } catch {
      /* l'interface ne bloque jamais la composition */
    }
  };
  // 1. Les mots.
  stage('copy', 'running');
  let copyRun = await orch.run(copyTask(brief, intent, req.feedback));
  // Les mots font le visuel : un modèle muet (délai, panne) a droit à un second essai.
  if (copyRun.source === 'graph' && orch.traces[orch.traces.length - 1]?.reason === 'failed') copyRun = await orch.run({ ...copyTask(brief, intent, req.feedback), key: 'posterCopywriter:retry' });
  const copy = copyRun.value;
  stage('copy', 'done');

  // 2. La photo.
  stage('photo', 'running');
  const subject = `${copy.headline}. ${message}`.slice(0, 260);
  let image: PosterImage | undefined;
  let extraImages: PosterImage[] = [];
  let sourced: SourcedImage | null = null;
  if (!req.skipImage) {
    if (req.photoUrl) image = (await posterImage(req.photoUrl, 'user')) || undefined;
    if (!image && req.brandPhotos?.length) {
      const kinds = await Promise.all(req.brandPhotos.slice(0, 12).map((u) => classifyImage(u)));
      const photos = kinds.filter((k) => k.kind === 'photo').map((k) => k.url);
      if (photos.length) {
        const ranked = await rankByRelevance(photos, subject, { name: ctx.brandName, business: ctx.businessType });
        const good = ranked.filter((r) => r.score >= 6);
        if (good.length) {
          const described = async (url: string): Promise<PosterImage | null> => {
            const im = await posterImage(url, 'brand');
            return im ? { ...im, subject: kinds.find((k) => k.url === url)?.subject } : null;
          };
          image = (await described(good[0].url)) || undefined;
          extraImages = (await Promise.all(good.slice(1, 3).map((g) => described(g.url)))).filter((x): x is PosterImage => !!x);
        }
        logger.info('poster.brand_photos', { event: 'poster.brand_photos', candidates: photos.length, kept: good.length, best: ranked[0]?.score });
      }
    }
    if (!image) {
      // Banque ou génération, VÉRIFIÉE : une photo hors sujet est pire que pas de photo.
      for (const preferGenerated of [false, true]) {
        try {
          const found = await imageSourcingService.sourceImage({ ...imageBriefFor(copy, ctx, req.format, subject), preferGenerated }, { userId: req.userId, projectId: req.brandId, tag: req.tag, ...req.sourcing, ...(preferGenerated ? { preferStock: false } : {}) });
          const [check] = await rankByRelevance([found.url], subject, { name: ctx.brandName, business: ctx.businessType });
          if (check.score >= 5) {
            image = (await posterImage(found.url, found.source === 'generated' ? 'generated' : 'stock')) || undefined;
            sourced = found;
            break;
          }
          logger.info('poster.image_rejected', { event: 'poster.image_rejected', source: found.source, score: check.score, reason: check.reason });
        } catch (error) {
          logger.warn('poster.sourcing_failed', { event: 'poster.sourcing_failed', error });
        }
      }
    }
  }
  if (image && !sourced) sourced = { url: image.url, source: 'upload', attribution: { provider: 'other', author: ctx.brandName }, analysis: { subject: '', mood: '', dominantColors: [], luminance: 'mixed' } };

  stage('photo', 'done');
  // 3. Les candidats.
  const logos = ctx.branding.logoUrls;
  const { analyzeLogo } = await import('./poster.images');
  const logo = await analyzeLogo(logos?.withText?.light || logos?.primary || undefined);
  const input: SpecInput = {
    format: req.format,
    copy,
    palette: { primary: ctx.branding.primary, secondary: ctx.branding.secondary, accent: ctx.branding.accent, background: ctx.branding.background, text: ctx.branding.text },
    image,
    extraImages,
    logo,
    brandName: ctx.brandName,
    language: brief.language,
    allowDark: req.allowDark,
  };
  const schemes = schemesOf(input);
  const all = candidatesFor(input, intent, req, schemes);
  const fonts = posterFonts({ primaryFont: ctx.branding.primaryFont, secondaryFont: ctx.branding.secondaryFont, url: ctx.branding.fontUrl });

  const critiqueCtx: CritiqueContext = { context: ctx, request: `${message}${req.content.description ? ` — ${req.content.description}` : ''}`, copy, feedback: req.feedback };
  const images = [image, ...extraImages].filter((x): x is PosterImage => !!x);
  const hasBrandPhoto = !!image && (image.origin === 'brand' || image.origin === 'user');

  // 4. La méthode du cran : plus on monte, plus l'IA porte la conception — et plus on vérifie.
  let final: Final | null = null;
  let fellBack: string | undefined;
  if (atLeast(level, 'max')) {
    const carrier = specFor(input, { template: 'free', scheme: 'paper', mirror: false, treatment: 'natural' }, schemes)!;
    const dbrief: DesignBrief = {
      spec: carrier,
      tokens: colorTokens(carrier, schemes),
      images,
      context: ctx,
      request: critiqueCtx.request,
      intent,
      feedback: req.feedback,
      reference: req.reference?.description || req.reference?.structure,
      recent: req.recentLayouts?.filter((l) => l !== 'layout' && l !== 'author'),
    };
    const deadline = started + (level === 'ultra' ? 330_000 : 240_000);
    final = level === 'ultra' ? await authorPath(orch, dbrief, brief, critiqueCtx, fonts, deadline, hasBrandPhoto, stage) : await layoutPath(orch, dbrief, critiqueCtx, fonts, deadline, hasBrandPhoto, stage);
    if (!final) fellBack = level === 'ultra' ? 'author→direction' : 'layout→direction';
  }
  if (!final || (final.critique && final.critique.score < 6)) {
    // Le filet : la direction artistique sur les compositions éprouvées. Si la conception libre a
    // abouti mais reste moyenne, la critique compare les deux.
    stage('layout', 'running');
    const safety = await templatePath(orch, req, level, all, input, schemes, copy, fonts, critiqueCtx, hasBrandPhoto);
    stage('layout', 'done');
    if (final && safety) {
      const verdict = await compareRenders([final.render.png, safety.render.png], critiqueCtx);
      if (verdict?.best === 1) {
        fellBack = `${final.method}→direction (critic)`;
        final = safety;
      }
    } else final = safety || final;
  }
  if (!final) throw new Error('poster_render_failed');

  logger.info('poster.composed', {
    event: 'poster.composed',
    brandId: req.brandId,
    level,
    method: final.method,
    fellBack,
    intent,
    layout: final.layout,
    image: image?.origin || 'none',
    critic: final.critique?.score,
    score: final.render.measure.score,
    ms: Date.now() - started,
  });
  const m = final.render.measure;
  const findings = [
    ...m.overflow.map((o) => ({ rule: 'debordement', severity: 'error' as const, message: `Texte trop long pour sa zone (${o})`, count: 1, repaired: false })),
    ...(m.dropped || []).map((d) => ({ rule: 'texte-retire', severity: 'info' as const, message: `Texte retiré faute de place (${d})`, count: 1, repaired: true })),
    ...(m.lowContrast || []).map((c) => ({ rule: 'contraste', severity: 'warning' as const, message: `Contraste faible (${c.name}, ${c.ratio}:1)`, count: 1, repaired: false })),
  ];
  return {
    html: final.render.html,
    png: final.render.png,
    parsed: {
      layout: final.layout,
      scheme: final.scheme,
      copy: final.copy,
      concept: final.concept,
      layoutNotes: final.notes,
      marketingText: { headline: final.copy.headline, subheadline: final.copy.sub, body: final.copy.facts.map((f) => f.text).join(' · ') },
      creativity: level,
      method: final.method,
      ...(fellBack ? { fellBack } : {}),
      ...(final.critique ? { critique: final.critique } : {}),
      agents: orch.traces,
    } as PosterResult['parsed'],
    sourced,
    audit: { findings: findings as VisualAuditReport['findings'], repaired: (m.dropped || []).map((d) => `retrait:${d}`), score: m.score, blocking: m.blocking },
    candidates: final.tried,
  };
}

// ─── Les méthodes ───────────────────────────────────────────────────────────

/** Le résultat d'une méthode. */
interface Final {
  method: 'rules' | 'direction' | 'layout' | 'author';
  render: PosterRender;
  layout: string;
  scheme: string;
  concept: string;
  notes?: string;
  copy: PosterCopy;
  critique: Critique | null;
  tried: PosterResult['candidates'];
}

/**
 * Low, Medium : les RÈGLES composent (le meilleur candidat, ou un tirage parmi les trois meilleurs).
 * High : la DIRECTION ARTISTIQUE — l'IA choisit la composition, REGARDE le rendu (critique
 * visuelle) et, sous la qualité agence, en choisit une autre qui corrige ce qu'elle a vu (deux
 * révisions au plus). Aussi le filet des crans Max et Ultra.
 */
async function templatePath(orch: CreativeOrchestrator, req: PosterRequest, level: CreativityLevel, all: Candidate[], input: SpecInput, schemes: PosterScheme[], copy: PosterCopy, fonts: ReturnType<typeof posterFonts>, critiqueCtx: CritiqueContext, hasPhoto: boolean): Promise<Final | null> {
  const tried: PosterResult['candidates'] = [];
  const renderChoice = async (c: Candidate, emphasis?: number): Promise<PosterRender | null> => {
    const spec = specFor(input, { ...c, emphasis: emphasis ?? c.emphasis }, schemes);
    const template = TEMPLATE_BY_ID.get(c.template);
    if (!spec || !template) return null;
    try {
      const render = await renderPoster(spec, template.render(spec), fonts);
      tried.push({ choice: c, score: render.measure.score, blocking: render.measure.blocking });
      return render.measure.blocking ? null : render;
    } catch (error) {
      logger.warn('poster.render_failed', { event: 'poster.render_failed', template: c.template, error });
      return null;
    }
  };
  const finalOf = (c: Candidate, render: PosterRender, critique: Critique | null, method: Final['method']): Final => ({
    method,
    render,
    layout: c.template,
    scheme: c.scheme,
    concept: `${c.template} · ${c.scheme}`,
    notes: TEMPLATE_BY_ID.get(c.template)?.summary,
    copy,
    critique,
    tried,
  });

  if (!atLeast(level, 'high')) {
    let queue = all;
    if (level === 'medium') {
      const top = all.slice(0, 3);
      const first = top[hash(req.seedKey + ':pick') % Math.max(1, top.length)];
      queue = first ? [first, ...all.filter((c) => c !== first)] : all;
    }
    for (const c of queue.slice(0, 6)) {
      const render = await renderChoice(c);
      if (render) return finalOf(c, render, null, 'rules');
    }
    return null;
  }

  // La direction artistique, qui regarde ce qu'elle a choisi.
  const menu = all.slice(0, 9);
  let best: { c: Candidate; render: PosterRender; critique: Critique | null } | null = null;
  let review: DirectorReview | undefined;
  const seen = new Set<Candidate>();
  for (let round = 0; round < 3; round++) {
    const decided = (await orch.run({ ...artDirectorTask(menu, copy, req, schemes, 1, true, hasPhoto, review), key: `posterArtDirector${round ? `:r${round}` : ''}` })).value;
    // Un choix déjà rendu ne se rejoue pas : le suivant du menu.
    const pick = decided.picks.find((p) => !seen.has(p)) || menu.find((p) => !seen.has(p));
    if (!pick) break;
    seen.add(pick);
    let render = await renderChoice(pick, decided.emphasis);
    let chosen = pick;
    if (!render) {
      // Écarté par la mesure : le meilleur suivant du code, sans relancer l'IA.
      for (const c of all.filter((x) => !seen.has(x)).slice(0, 4)) {
        seen.add(c);
        render = await renderChoice(c);
        if (render) {
          chosen = c;
          break;
        }
      }
      if (!render) continue;
    }
    const critique = await reviewPoster(render.png, critiqueCtx);
    if (!best || (critique?.score ?? 6) > (best.critique?.score ?? 6)) best = { c: chosen, render, critique };
    if (!critique || critique.verdict === 'ok' || critique.score >= 8) break;
    review = { picked: `${chosen.template}/${chosen.scheme}`, score: critique.score, fixes: critique.fixes };
  }
  return best ? finalOf(best.c, best.render, best.critique, 'direction') : null;
}

/**
 * Max : la MISE EN PAGE PAR L'IA. Deux designers, deux angles (la photo en héros, la typographie
 * en architecture), chacun dans la boucle de conception ; la critique compare les deux.
 */
async function layoutPath(orch: CreativeOrchestrator, b: DesignBrief, critiqueCtx: CritiqueContext, fonts: ReturnType<typeof posterFonts>, deadline: number, hasPhoto: boolean, stage: (s: string, st: 'running' | 'done') => void): Promise<Final | null> {
  stage('design', 'running');
  const angles = layoutAngles(hasPhoto || b.images.length > 0);
  const loops = await Promise.all(
    angles.map((angle, i) =>
      designLoop<LayoutDesign>({
        key: `layout:${i + 1}`,
        rounds: 3,
        deadline,
        write: (round, previous) => writeLayout(orch, b, `posterLayout:${i + 1}`, angle, round, previous),
        build: (design) => buildLayout(design, b),
        render: (body) => renderPoster(b.spec, body, fonts),
        review: (png, design) => reviewPoster(png, { ...critiqueCtx, intent: design.concept }),
      })
    )
  );
  stage('design', 'done');
  const done = loops.map((l) => l.best).filter((x): x is LoopOutcome<LayoutDesign> => !!x);
  if (!done.length) return null;
  stage('critique', 'running');
  const pick = await pickBest(done, critiqueCtx);
  stage('critique', 'done');
  return {
    method: 'layout',
    render: pick.render,
    layout: 'layout',
    scheme: pick.design.background,
    concept: pick.design.concept,
    notes: `mise en page composée par l'IA (${loops.map((l) => l.rounds).join('+')} tours)`,
    copy: b.spec.copy,
    critique: pick.critique,
    tried: [],
  };
}

/**
 * Ultra : le VISUEL D'AUTEUR. Le directeur de création invente deux concepts, un designer par
 * concept code l'affiche complète, chacun dans la boucle de conception ; la critique compare.
 */
async function authorPath(orch: CreativeOrchestrator, b: DesignBrief, brief: PosterBrief, critiqueCtx: CritiqueContext, fonts: ReturnType<typeof posterFonts>, deadline: number, hasPhoto: boolean, stage: (s: string, st: 'running' | 'done') => void): Promise<Final | null> {
  stage('concept', 'running');
  let concepts = await inventConcepts(orch, b, brief, 2);
  // Le concept fait le visuel d'auteur : un directeur muet a droit à un second essai.
  if (!concepts.length) concepts = await inventConcepts(orch, b, brief, 2, 'posterCreativeDirector:retry');
  if (!concepts.length) {
    concepts = layoutAngles(hasPhoto || b.images.length > 0).map((a, i) => ({ title: `Direction ${i + 1}`, idea: a.replace(/^YOUR ANGLE:\s*/, ''), layout: 'your own composition, built for this message', photo: 'as the idea requires', colour: 'the brand colours with intent', type: 'bold, editorial' }));
  }
  stage('concept', 'done');
  stage('design', 'running');
  const loops = await Promise.all(
    concepts.slice(0, 2).map(async (concept, i) => {
      const copy = conceptCopy(b.spec.copy, concept);
      const cb: DesignBrief = { ...b, spec: { ...b.spec, copy } };
      const loop = await designLoop<AuthoredDesign>({
        key: `author:${i + 1}`,
        rounds: 4,
        deadline,
        write: (round, previous) => writeAuthored(orch, cb, concept, `posterAuthor:${i + 1}`, round, previous),
        build: (design) => buildAuthored(design, cb, copy),
        render: (body) => renderPoster(cb.spec, body, fonts),
        review: (png) => reviewPoster(png, { ...critiqueCtx, copy, intent: `${concept.title}: ${concept.idea} ${concept.layout}` }),
      });
      return { loop, concept, copy };
    })
  );
  stage('design', 'done');
  const done = loops.filter((l) => l.loop.best).map((l) => ({ ...l.loop.best!, concept: l.concept, copy: l.copy }));
  if (!done.length) return null;
  stage('critique', 'running');
  const pick = await pickBest(done, critiqueCtx);
  stage('critique', 'done');
  return {
    method: 'author',
    render: pick.render,
    layout: 'author',
    scheme: 'charter',
    concept: `${pick.concept.title} — ${pick.concept.idea}`.slice(0, 300),
    notes: `visuel d'auteur codé par l'IA (${loops.map((l) => l.loop.rounds).join('+')} tours)`,
    copy: pick.copy,
    critique: pick.critique,
    tried: [],
  };
}

/** Le meilleur de plusieurs conceptions abouties : la critique compare ; sans elle, la meilleure note. */
async function pickBest<T extends { render: PosterRender; critique: Critique | null }>(done: T[], ctx: CritiqueContext): Promise<T> {
  if (done.length === 1) return done[0];
  const verdict = await compareRenders(
    done.map((d) => d.render.png),
    ctx
  );
  if (verdict) {
    logger.info('poster.critic', { event: 'poster.critic', best: verdict.best, why: verdict.why });
    return done[verdict.best];
  }
  return [...done].sort((a, b) => (b.critique?.score ?? 0) - (a.critique?.score ?? 0))[0];
}

export type { PosterTreatment };
