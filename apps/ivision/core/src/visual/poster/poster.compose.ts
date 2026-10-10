/**
 * LE COMPOSITEUR DE VISUELS — partagé par IDEM et iVision, pour tous les crans.
 *
 *   1. les mots : l'intention, les faits du brief, les cases (rédacteur, tous crans) ;
 *   2. la photo : celle de l'utilisateur, sinon les PHOTOS de la marque (les affiches et logos
 *      du site sont écartés) classées par pertinence, sinon une photo de banque ou générée
 *      VÉRIFIÉE par la vision, sinon aucune (composition typographique) ;
 *   3. les candidats : gabarit × palette × variante, pondérés par l'intention, la direction
 *      artistique, la variété (derniers visuels) et le retour de l'utilisateur ;
 *   4. le choix, selon le cran :
 *        Low     le meilleur candidat du code
 *        Medium  tirage parmi les trois meilleurs (variété)
 *        High    le directeur artistique (IA) choisit dans le menu
 *        Max     il en choisit trois, rendus et MESURÉS, le meilleur gagne
 *        Ultra   il en choisit quatre (traitements photo compris), la critique visuelle
 *                (vision) compare les rendus et désigne le plus professionnel ;
 *   5. le rendu mesuré : un candidat qui déborde, se chevauche ou sort des marges est écarté.
 *
 * L'IA n'écrit JAMAIS de HTML : chaque visuel est une composition dessinée par le code.
 */
import crypto from 'crypto';
import sharp from 'sharp';
import { atLeast, CreativityLevel } from '../../creativity/levels';
import { CreativeOrchestrator, type AgentTask } from '../../creativity/orchestrator';
import { agentLines, menuLines, LETTERS } from '../../creativity/agent-io';
import { coreHost } from '../../runtime/host';
import logger from '../../runtime/logger';
import type { VisualAuditReport } from '../../design/visualAudit';
import { imageSourcingService, ImageSourcingPreferences, SourcedImage } from '../image.sourcing';
import type { FlyerFormat, VisualBrandContext, VisualContent, VisualMeta } from '../visual.model';
import { copyTask, inferPosterIntent, type PosterBrief } from './poster.copy';
import { classifyImage, posterImage, rankByRelevance } from './poster.images';
import { posterFonts, renderPoster, type PosterRender } from './poster.render';
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
function artDirectorTask(menu: Candidate[], copy: PosterCopy, req: PosterRequest, schemes: PosterScheme[], count: number, treatments: boolean, hasPhoto: boolean): AgentTask<{ picks: Candidate[]; emphasis?: number }> {
  const describe = (c: Candidate) => `${TEMPLATE_BY_ID.get(c.template)!.summary}; colours: ${schemes.find((s) => s.id === c.scheme)!.label}`;
  const ad = req.context.artDirection;
  const words = copy.headline.split(/\s+/);
  return {
    role: 'posterArtDirector',
    minLevel: 'high',
    prompt: () =>
      menu.length < 2
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

/** Cran Ultra : la critique compare les rendus (une planche) et désigne le plus professionnel. */
async function visualCritic(renders: PosterRender[], req: PosterRequest): Promise<{ best: number; why?: string } | null> {
  const analyze = coreHost().analyzeImage;
  if (!analyze || renders.length < 2) return null;
  try {
    const tileH = 420;
    const tiles = await Promise.all(renders.map((r) => sharp(r.png).resize({ height: tileH }).png().toBuffer({ resolveWithObject: true })));
    let x = 0;
    const comps = tiles.map((t) => {
      const c = { input: t.data, left: x, top: 0 };
      x += t.info.width + 16;
      return c;
    });
    const sheet = await sharp({ create: { width: x - 16, height: tileH, channels: 3, background: '#9a9a9a' } }).composite(comps).jpeg({ quality: 80 }).toBuffer();
    const ad = req.context.artDirection;
    const raw = await analyze(
      sheet.toString('base64'),
      'image/jpeg',
      [
        `${renders.length} candidate social-media visuals for the brand ${req.context.brandName} (${req.context.businessType}), numbered 1 to ${renders.length} from left to right.`,
        ad ? `Brand art direction: ${ad.styleName || ad.styleId}. Do: ${(ad.dos || []).slice(0, 3).join('; ')}. Don't: ${(ad.donts || []).slice(0, 3).join('; ')}.` : '',
        'As a senior art director, pick the most professional one: clear hierarchy, legible text, balanced space, on-brand, nothing cluttered or cheap. A real photo of the brand’s own people, well composed, beats an empty typographic layout.',
        'Reply ONLY with JSON: {"best": <number>, "why": "<12 words"}',
      ]
        .filter(Boolean)
        .join('\n'),
      { maxOutputTokens: 120, temperature: 0, purpose: 'visual-analysis' }
    );
    const json = JSON.parse((raw.match(/\{[\s\S]*\}/) || ['{}'])[0]);
    const best = Number(json.best) - 1;
    return Number.isInteger(best) && best >= 0 && best < renders.length ? { best, why: typeof json.why === 'string' ? json.why.slice(0, 120) : undefined } : null;
  } catch (error) {
    logger.warn('poster.critic_failed', { event: 'poster.critic_failed', error });
    return null;
  }
}

// ─── La composition ─────────────────────────────────────────────────────────

export async function composePoster(ports: PosterPorts, req: PosterRequest): Promise<PosterResult> {
  const started = Date.now();
  const ctx = req.context;
  const level = req.creativity;
  const orch = new CreativeOrchestrator({ level, call: ports.agentCall });
  const message = [req.content.title, req.content.hook].filter(Boolean).join(' — ');
  const brief: PosterBrief = { message, details: req.content.description, brandName: ctx.brandName, businessType: ctx.businessType, valueProposition: ctx.valueProposition, tone: ctx.tone, language: ctx.language || 'fr' };
  const intent = inferPosterIntent(`${message} ${req.content.description || ''}`);

  // 1. Les mots.
  const copy = (await orch.run(copyTask(brief, intent, req.feedback))).value;

  // 2. La photo.
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
          image = (await posterImage(good[0].url, 'brand')) || undefined;
          extraImages = (await Promise.all(good.slice(1, 3).map((g) => posterImage(g.url, 'brand')))).filter((x): x is PosterImage => !!x);
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

  // 4. Le choix, selon le cran.
  let queue: Candidate[];
  let emphasis: number | undefined;
  if (atLeast(level, 'high')) {
    const count = level === 'ultra' ? 4 : level === 'max' ? 3 : 1;
    // Le menu : les meilleurs du code, un gabarit n'y figurant qu'une fois sous chaque palette.
    const menu = all.slice(0, 9);
    const hasPhoto = !!image && (image.origin === 'brand' || image.origin === 'user');
    const decided = (await orch.run(artDirectorTask(menu, copy, req, schemes, count, level === 'ultra', hasPhoto))).value;
    emphasis = decided.emphasis;
    let picks = decided.picks;
    // Plusieurs candidats : au moins une composition qui montre la photo de la marque, et des gabarits différents.
    if (count > 1) {
      picks = picks.filter((p, i) => picks.findIndex((q) => q.template === p.template) === i);
      for (const c of all) {
        if (picks.length >= count) break;
        if (!picks.some((p) => p.template === c.template)) picks.push(c);
      }
      if (hasPhoto && !picks.some((p) => TEMPLATE_BY_ID.get(p.template)?.needsImage)) {
        const photoPick = all.find((c) => TEMPLATE_BY_ID.get(c.template)?.needsImage);
        if (photoPick) picks = [...picks.slice(0, count - 1), photoPick];
      }
    }
    queue = [...picks, ...all.filter((c) => !picks.includes(c))];
  } else if (level === 'medium') {
    const top = all.slice(0, 3);
    const first = top[hash(req.seedKey + ':pick') % Math.max(1, top.length)];
    queue = first ? [first, ...all.filter((c) => c !== first)] : all;
  } else {
    queue = all;
  }
  if (!queue.length) throw new Error('poster_no_candidate');

  // 5. Rendus mesurés : on garde les candidats sans défaut ; au-delà du nombre voulu, on s'arrête.
  const wanted = level === 'ultra' ? 4 : level === 'max' ? 3 : 1;
  const rendered: { choice: Candidate; render: PosterRender }[] = [];
  const tried: PosterResult['candidates'] = [];
  for (const c of queue.slice(0, wanted + 4)) {
    const spec = specFor(input, { ...c, emphasis: emphasis ?? c.emphasis }, schemes);
    const template = TEMPLATE_BY_ID.get(c.template);
    if (!spec || !template) continue;
    try {
      const render = await renderPoster(spec, template.render(spec), fonts);
      tried.push({ choice: c, score: render.measure.score, blocking: render.measure.blocking });
      if (!render.measure.blocking) rendered.push({ choice: c, render });
    } catch (error) {
      logger.warn('poster.render_failed', { event: 'poster.render_failed', template: c.template, error });
    }
    if (rendered.length >= wanted) break;
  }
  if (!rendered.length) throw new Error('poster_render_failed');

  let pick = 0;
  if (rendered.length > 1) {
    // Le meilleur rendu mesuré (à mérite égal, l'ordre du directeur artistique) ; en Ultra, la critique visuelle tranche.
    pick = rendered.reduce((best, r, i) => (r.render.measure.score > rendered[best].render.measure.score + 4 ? i : best), 0);
    if (level === 'ultra') {
      const verdict = await visualCritic(
        rendered.map((r) => r.render),
        req
      );
      if (verdict) {
        pick = verdict.best;
        logger.info('poster.critic', { event: 'poster.critic', best: verdict.best, why: verdict.why });
      }
    }
  }
  const chosen = rendered[pick];
  logger.info('poster.composed', {
    event: 'poster.composed',
    brandId: req.brandId,
    level,
    intent,
    template: chosen.choice.template,
    scheme: chosen.choice.scheme,
    image: image?.origin || 'none',
    rendered: rendered.length,
    tried: tried.length,
    score: chosen.render.measure.score,
    ms: Date.now() - started,
  });
  const m = chosen.render.measure;
  const findings = [
    ...m.overflow.map((o) => ({ rule: 'debordement', severity: 'error' as const, message: `Texte trop long pour sa zone (${o})`, count: 1, repaired: false })),
    ...(m.dropped || []).map((d) => ({ rule: 'texte-retire', severity: 'info' as const, message: `Texte retiré faute de place (${d})`, count: 1, repaired: true })),
  ];
  return {
    html: chosen.render.html,
    png: chosen.render.png,
    parsed: {
      layout: chosen.choice.template,
      scheme: chosen.choice.scheme,
      copy,
      concept: `${chosen.choice.template} · ${chosen.choice.scheme}`,
      layoutNotes: TEMPLATE_BY_ID.get(chosen.choice.template)?.summary,
      marketingText: { headline: copy.headline, subheadline: copy.sub, body: copy.facts.map((f) => f.text).join(' · ') },
      creativity: level,
      agents: orch.traces,
    } as PosterResult['parsed'],
    sourced,
    audit: { findings: findings as VisualAuditReport['findings'], repaired: (m.dropped || []).map((d) => `retrait:${d}`), score: m.score, blocking: m.blocking },
    candidates: tried,
  };
}

export type { PosterTreatment };
