/**
 * LA CONVERSATION d'iVision.
 *
 * Une conversation a un mode fixe — IMAGES ou VIDÉOS, on ne mélange pas — et une marque. Un
 * tour suit toujours le même chemin, et l'assistant DEMANDE plutôt que de deviner :
 *
 *   1. un lien de site dans le message → le site est scanné, trois palettes et trois
 *      typographies sont proposées ; la demande attend le choix ;
 *   2. pas de marque → l'assistant propose : coller son site, importer un projet IDEM, ou
 *      choisir une marque existante ;
 *   3. pas de modèle cité → « Avez-vous une vidéo (une image) modèle ? » — à chaque demande ;
 *      « non » est une réponse, pas un oubli ;
 *   4. la génération : débit des crédits (prix d'IDEM), moteur partagé, progression réelle en
 *      direct, crédits restitués en cas d'échec.
 *
 * La demande en attente (`pending`) est rejouée telle quelle quand la réponse arrive : choisir
 * une palette ou ajouter un modèle n'oblige pas à réécrire sa demande.
 */
import crypto from 'crypto';
import type { ReferenceImage } from '../../../core/src/reference/reference.analyzer';
import type { VideoMediaAsset } from '../../../core/src/video/video.model';
import { VideoInputError } from '../../../core/src/video/motionVideo.service';
import { normalizeCreativity } from '../../../core/src/creativity/levels';
import { FLYER_FORMATS, FlyerFormat } from '../../../core/src/visual/visual.model';
import { videoCost } from '../../../core/src/video/video.pricing';
import { SiteScanError } from '../../../core/src/site/site-scanner';
import { collection } from '../config/db';
import logger from '../config/logger';
import { HttpError } from '../middleware/error';
import type { ChatAsk, ChatAttachment, ChatMessage, ChatMode, ChatOptions, ChatSession, IvisionBrand, IvisionReference } from '../models';
import { charge, Charge, PaymentRequired, quote, refund } from './billing';
import { brandView, getBrand, scanBrand } from './brands.service';
import { blueprintOf, getReference, referenceView } from './references.service';
import { createVideo, scopeOf } from './videos.service';
import { createVisual, getVisual, visualView } from './visuals.service';

const sessions = () => collection<ChatSession>('sessions');
const now = () => new Date().toISOString();
const newId = (prefix: string) => `${prefix}_${Date.now().toString(36)}${crypto.randomBytes(4).toString('hex')}`;

export type ChatEvent =
  | { type: 'message'; message: ChatMessage }
  | { type: 'status'; key: string; text: string; data?: Record<string, unknown> }
  | { type: 'progress'; stage: string; state: string; data?: Record<string, unknown> }
  | { type: 'brand'; brand: ReturnType<typeof brandView> }
  | { type: 'result'; message: ChatMessage; video?: unknown; visual?: unknown }
  | { type: 'error'; error: string; message: string; payment?: Record<string, unknown> };

export interface TurnInput {
  text?: string;
  /** Le modèle cité pour CETTE demande, ou `noReference` : l'utilisateur a répondu « non ». */
  referenceId?: string;
  noReference?: boolean;
  /** Vidéo : médias importés (photos, clips, 3D, Lottie). Visuel : la photo à poser. */
  media?: VideoMediaAsset[];
  photoUrl?: string;
  options?: ChatOptions;
  /** Rejoue la demande en attente (après un choix de palette, un modèle ajouté…). */
  resume?: boolean;
}

// ─── Conversations ──────────────────────────────────────────────────────────

export async function createSession(userId: string, mode: ChatMode, brandId?: string): Promise<ChatSession> {
  if (brandId) await getBrand(userId, brandId);
  const session: ChatSession = { _id: newId('chat'), userId, mode, ...(brandId ? { brandId } : {}), title: mode === 'video' ? 'Nouvelle vidéo' : 'Nouveau visuel', messages: [], createdAt: now(), updatedAt: now() };
  await sessions().insertOne(session);
  return session;
}

export async function listSessions(userId: string, mode?: ChatMode) {
  const list = await sessions()
    .find({ userId, ...(mode ? { mode } : {}) }, { projection: { messages: { $slice: -1 } } })
    .sort({ updatedAt: -1 })
    .limit(60)
    .toArray();
  return list.map((s) => ({ id: s._id, mode: s.mode, brandId: s.brandId, title: s.title, updatedAt: s.updatedAt, last: s.messages[0]?.text?.slice(0, 120) }));
}

export async function getSession(userId: string, id: string): Promise<ChatSession> {
  const session = await sessions().findOne({ _id: id, userId });
  if (!session) throw new HttpError(404, 'session_not_found', 'Conversation introuvable.');
  return session;
}

export async function setSessionBrand(userId: string, id: string, brandId: string): Promise<ChatSession> {
  await getBrand(userId, brandId);
  await sessions().updateOne({ _id: id, userId }, { $set: { brandId, updatedAt: now() } });
  return getSession(userId, id);
}

export async function deleteSession(userId: string, id: string): Promise<void> {
  const res = await sessions().deleteOne({ _id: id, userId });
  if (!res.deletedCount) throw new HttpError(404, 'session_not_found', 'Conversation introuvable.');
}

export function sessionView(s: ChatSession) {
  return { id: s._id, mode: s.mode, brandId: s.brandId, title: s.title, messages: s.messages, pending: s.pending ? { text: s.pending.text } : null, createdAt: s.createdAt, updatedAt: s.updatedAt };
}

// ─── Un tour de conversation ────────────────────────────────────────────────

const URL_PATTERN = /\b(https?:\/\/[^\s<>"']+|(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s<>"']*)?)/i;

/** Le lien d'un site collé dans le message (et le reste du texte, la vraie demande). */
function splitUrl(text: string): { url?: string; rest: string } {
  const match = text.match(URL_PATTERN);
  if (!match) return { rest: text };
  // Un courriel n'est pas un site.
  if (text.slice(Math.max(0, (match.index || 0) - 1), match.index).includes('@')) return { rest: text };
  // La ponctuation qui suit un lien (« mon site : exemple.com, … ») n'en fait pas partie.
  const url = match[1].replace(/[.,;:!?)\]»]+$/, '');
  return { url, rest: text.replace(url, ' ').replace(/\s+/g, ' ').replace(/^[\s:—–-]+/, '').trim() };
}

/**
 * La formule de demande n'est pas le message : « Une affiche pour nos soldes : -20 % » annonce
 * « Nos soldes : -20 % ». Le modèle de rédaction le comprend seul ; sans lui (repli), la phrase
 * de commande finirait sur l'affiche.
 */
const REQUEST_FR = /^\s*(?:(?:je\s+(?:veux|voudrais)|j['’]aimerais|fais(?:-moi)?|cr[ée]e(?:-moi)?|g[ée]n[èe]re(?:-moi)?)\s+)?(?:une?|des|la|le|ma|mon)\s+(?:petite?s?\s+)?(?:affiches?|visuels?|publications?|posts?|stor(?:y|ies)|banni[èe]res?|flyers?|images?|vid[ée]os?(?:\s+(?:en\s+)?motion\s+design)?)(?:\s+(?:de\s+)?\d+\s*(?:s|sec|secondes)\b)?\s*(?:pour|sur|qui|annon[çc]ant|afin\s+de|:)?\s*/i;
const REQUEST_EN = /^\s*(?:(?:i\s+(?:want|need|would\s+like)|make(?:\s+me)?|create(?:\s+me)?)\s+)?(?:an?|the|my)\s+(?:short\s+)?(?:posters?|visuals?|posts?|stor(?:y|ies)|banners?|flyers?|images?|videos?)(?:\s+of\s+\d+\s*(?:s|sec|seconds)\b)?\s*(?:for|about|announcing|to|:)?\s*/i;

export function messageOf(request: string): string {
  const stripped = request.replace(REQUEST_FR, '').replace(REQUEST_EN, '').trim();
  const out = stripped.length >= 3 ? stripped : request.trim();
  return out.charAt(0).toUpperCase() + out.slice(1);
}

/**
 * Un RETOUR sur le visuel précédent, pas une nouvelle demande : « ce n'est pas pro », « propose
 * autre chose », « refais », « plus sobre ». La demande d'origine est rejouée autrement ; la
 * phrase de l'utilisateur n'est jamais le texte du visuel.
 */
const FEEDBACK = /(pas (?:assez |tr[eè]s )?(?:pro|professionn?el|beau|terrible|top|bien)|moche|nul|bof|autre chose|une? autre (?:version|proposition|id[ée]e)|propose[rz]? (?:autre|encore|mieux)|refai[st]|recommence|essaie encore|encore une|change[rz]?|plus (?:sobre|color[ée]|lisible|moderne|pro|grand|petit|clair|sombre|simple|[ée]pur[ée])|moins (?:charg[ée]|color[ée]|sombre|clair)|je n.aime pas|[çc]a ne (?:me )?(?:pla[iî]t|va) pas|not (?:professional|good)|try again|another one)/i;

export function isFeedback(text: string): boolean {
  return FEEDBACK.test(text) && text.split(/\s+/).length <= 16;
}

/** Le format nommé dans la demande (« une story… », « une bannière… ») l'emporte sur le réglage. */
export function formatIn(text: string): FlyerFormat | undefined {
  const t = text.toLowerCase();
  if (/\bstor(?:y|ies)\b|\bstatut\b|\breel\b|9\s*[:/x]\s*16|vertical/.test(t)) return 'story';
  if (/banni[eè]re|banner|couverture|cover|16\s*[:/x]\s*9|linkedin|twitter|youtube/.test(t)) return 'banner';
  if (/\ba4\b|affiche (?:à |a )?imprimer|flyer imprim|impression/.test(t)) return 'a4';
  if (/4\s*[:/x]\s*5|portrait/.test(t)) return 'post';
  if (/\bcarr[ée]\b|square|1\s*[:/x]\s*1/.test(t)) return 'square';
  return undefined;
}

/** Une seule génération à la fois par conversation (double clic, deux onglets). */
const running = new Set<string>();

const message = (role: ChatMessage['role'], text: string, extra: Partial<ChatMessage> = {}): ChatMessage => ({ id: newId('msg'), role, text, createdAt: now(), ...extra });

async function push(sessionId: string, msg: ChatMessage, set: Partial<ChatSession> = {}, unset: string[] = []): Promise<void> {
  await sessions().updateOne(
    { _id: sessionId },
    {
      $push: { messages: msg } as never,
      $set: { ...set, updatedAt: now() },
      ...(unset.length ? { $unset: Object.fromEntries(unset.map((k) => [k, ''])) } : {}),
    }
  );
}

const ASK_TEXT: Record<ChatAsk['kind'], (mode: ChatMode) => { key: string; text: string }> = {
  brand: () => ({ key: 'chat.ask.brand', text: 'Pour que le résultat respecte votre marque : collez le lien de votre site, importez un projet IDEM, ou choisissez une marque.' }),
  'brand-choice': () => ({ key: 'chat.ask.brandChoice', text: 'J’ai lu votre site. Choisissez la palette et la typographie qui vous ressemblent — je les applique à tout ce que je crée.' }),
  reference: (mode) =>
    mode === 'video'
      ? { key: 'chat.ask.referenceVideo', text: 'Avez-vous une vidéo modèle à reproduire ? J’en reprends les animations et le rythme, avec vos textes, vos images et votre marque.' }
      : { key: 'chat.ask.referenceImage', text: 'Avez-vous une image modèle ? J’en reprends la composition, avec vos textes, vos couleurs et votre logo.' },
};

async function ask(session: ChatSession, a: ChatAsk, pending: ChatSession['pending'], emit: (e: ChatEvent) => void): Promise<void> {
  const { key, text } = ASK_TEXT[a.kind](session.mode);
  const msg = message('assistant', text, { ask: a, i18n: { key } });
  await push(session._id, msg, pending ? { pending } : {});
  emit({ type: 'message', message: msg });
}

/** Le modèle cité, une fois son analyse finie (attente bornée, progression montrée). */
async function readyReference(userId: string, id: string, emit: (e: ChatEvent) => void): Promise<IvisionReference> {
  const deadline = Date.now() + 180_000;
  let last = '';
  for (;;) {
    const ref = await getReference(userId, id);
    if (ref.status !== 'analyzing') return ref;
    const step = ref.progress?.step || 'probe';
    if (step !== last) {
      last = step;
      emit({ type: 'status', key: `chat.status.reference.${step}`, text: 'Analyse du modèle…', data: { step, done: ref.progress?.done, total: ref.progress?.total } });
    }
    if (Date.now() > deadline) throw new HttpError(504, 'reference_timeout', 'L’analyse du modèle prend trop de temps. Réessayez dans un instant.');
    await new Promise((r) => setTimeout(r, 1500));
  }
}

export async function runTurn(userId: string, sessionId: string, input: TurnInput, emit: (e: ChatEvent) => void, language?: string): Promise<void> {
  if (running.has(sessionId)) throw new HttpError(409, 'turn_running', 'Une création est déjà en cours dans cette conversation.');
  running.add(sessionId);
  try {
    await turn(userId, await getSession(userId, sessionId), input, emit, language);
  } finally {
    running.delete(sessionId);
  }
}

async function turn(userId: string, session: ChatSession, input: TurnInput, emit: (e: ChatEvent) => void, language?: string): Promise<void> {
  // (`input` est complété plus bas pour une révision : la décision de modèle d'avant vaut.)
  const pending = session.pending;
  const written = String(input.text || '').trim().slice(0, 2000);
  // Reprise : la demande en attente, avec les réglages et médias d'alors (complétés par ceux d'aujourd'hui).
  const text = input.resume && pending ? pending.text : written;
  const options: ChatOptions = { ...(input.resume ? pending?.options : {}), ...(input.options || {}) };
  const media: VideoMediaAsset[] = input.media?.length ? input.media : input.resume && pending?.media ? pending.media : [];
  const photoUrl = input.photoUrl || (input.resume ? pending?.photoUrl : undefined);
  const keep = (t: string): ChatSession['pending'] => ({ text: t, options, ...(media.length ? { media } : {}), ...(photoUrl ? { photoUrl } : {}) });

  // Le message de l'utilisateur (sauf reprise sans texte) : avec ses pièces jointes.
  if (written || input.referenceId || input.noReference) {
    const attachments: ChatAttachment[] = [];
    if (input.referenceId) {
      const ref = await getReference(userId, input.referenceId);
      attachments.push({ kind: 'reference', id: ref._id, url: ref.url, name: ref.name, mimeType: ref.mimeType });
    }
    for (const m of input.media || []) attachments.push({ kind: 'media', id: m.id, url: m.url, name: m.name, mimeType: m.kind });
    if (input.photoUrl) attachments.push({ kind: 'media', id: 'photo', url: input.photoUrl, mimeType: 'image' });
    const userText = written || (input.noReference ? 'Sans modèle.' : '');
    const msg = message('user', userText, attachments.length ? { attachments } : {});
    const title = session.messages.length === 0 && written ? { title: written.replace(/\s+/g, ' ').slice(0, 60) } : {};
    await push(session._id, msg, title);
    emit({ type: 'message', message: msg });
  }

  // 1. Un lien de site : on scanne, on propose, la demande attend le choix.
  const { url, rest } = splitUrl(text);
  let brand: IvisionBrand | null = session.brandId ? await getBrand(userId, session.brandId).catch(() => null) : null;
  // Un lien vers un AUTRE site que celui de la marque courante : c'est la marque à lire (un lien
  // seul aussi). Le même site ne se relit pas à chaque message.
  const sameSite = (() => {
    try {
      return !!brand?.siteUrl && new URL(brand.siteUrl).host === new URL(/^https?:\/\//i.test(url || '') ? url! : `https://${url}`).host;
    } catch {
      return false;
    }
  })();
  if (url && (!brand || rest.length < 12 || !sameSite)) {
    emit({ type: 'status', key: 'chat.status.scan.open', text: 'Je visite votre site…' });
    try {
      brand = await scanBrand(userId, url, (step) => emit({ type: 'status', key: `chat.status.scan.${step}`, text: 'Lecture du site…' }));
    } catch (error) {
      const known = error instanceof SiteScanError;
      logger.warn('chat.scan_failed', { event: 'chat.scan_failed', error });
      const msg = message('assistant', known ? (error as Error).message : 'Je n’ai pas pu lire ce site. Vérifiez le lien, ou choisissez une marque autrement.', { status: 'error', i18n: { key: known ? `chat.error.scan.${(error as SiteScanError).code}` : 'chat.error.scan.failed' } });
      await push(session._id, msg);
      emit({ type: 'message', message: msg });
      return;
    }
    emit({ type: 'brand', brand: brandView(brand) });
    await sessions().updateOne({ _id: session._id }, { $set: { brandId: brand._id } });
    session.brandId = brand._id;
    await ask(session, { kind: 'brand-choice', brandId: brand._id }, rest.length >= 3 ? keep(rest) : undefined, emit);
    return;
  }

  // 2. Pas de marque : l'utilisateur choisit d'où elle vient.
  if (!brand) {
    await ask(session, { kind: 'brand' }, text.length >= 3 ? keep(text) : undefined, emit);
    return;
  }
  // Une marque scannée attend la validation de sa palette et de sa typographie.
  if (brand.status === 'draft') {
    await ask(session, { kind: 'brand-choice', brandId: brand._id }, text.length >= 3 ? keep(text) : pending, emit);
    return;
  }

  // Un retour sur le visuel précédent (« pas pro, autre chose ») : la même demande, autrement.
  let feedback: string | undefined;
  let avoid: { template?: string; scheme?: string }[] = [];
  let revisedRequest: string | undefined;
  if (session.mode === 'image' && !url && written && isFeedback(written)) {
    const last = [...session.messages].reverse().find((m) => m.result?.kind === 'visual');
    const previous = last?.result?.kind === 'visual' ? await getVisual(userId, last.result.visualId).catch(() => null) : null;
    if (previous) {
      feedback = written;
      revisedRequest = previous.prompt;
      avoid = [{ template: previous.layout, scheme: previous.scheme }];
      // Pas de nouvelle question de modèle pour une révision : la décision d'avant vaut.
      input = { ...input, ...(previous.referenceId ? { referenceId: previous.referenceId } : { noReference: true }) };
      // Le format de la version précédente, sauf si le retour en nomme un autre (« en story »).
      options.format = formatIn(written) || previous.format;
    }
  }

  // Rien à créer encore (le lien seul, une salutation).
  const request = (revisedRequest || (url ? rest : text)).trim();
  if (request.length < 3) {
    const msg = message('assistant', session.mode === 'video' ? 'Que doit raconter votre vidéo ? Une offre, un produit, un événement…' : 'Que doit dire votre visuel ? Une offre, un produit, un événement…', { i18n: { key: `chat.ask.what.${session.mode}` } });
    await push(session._id, msg, {}, ['pending']);
    emit({ type: 'message', message: msg });
    return;
  }

  // 3. Le modèle : demandé à chaque création, « non » est une réponse.
  if (!input.referenceId && !input.noReference) {
    await ask(session, { kind: 'reference', mode: session.mode }, keep(request), emit);
    return;
  }
  let reference: IvisionReference | null = null;
  if (input.referenceId) {
    reference = await readyReference(userId, input.referenceId, emit);
    if (reference.status === 'failed') {
      const msg = message('assistant', reference.error || 'Ce modèle n’a pas pu être analysé.', { status: 'error', i18n: { key: 'chat.error.reference' } });
      await push(session._id, msg);
      emit({ type: 'message', message: msg });
      return;
    }
    if ((reference.kind === 'video') !== (session.mode === 'video')) {
      const msg = message('assistant', session.mode === 'video' ? 'Ce modèle est une image : en mode vidéo, ajoutez une vidéo modèle.' : 'Ce modèle est une vidéo : en mode images, ajoutez une image modèle.', { status: 'error', i18n: { key: `chat.error.referenceKind.${session.mode}` } });
      await push(session._id, msg);
      emit({ type: 'message', message: msg });
      return;
    }
  }

  // 4. La création.
  const level = normalizeCreativity(options.creativity);
  let paid: Charge | undefined;
  try {
    if (session.mode === 'video') {
      paid = await charge(userId, quote.video(scopeOf(options), level), session._id);
      emit({ type: 'status', key: 'chat.status.video.start', text: 'Je prépare votre vidéo…', data: { cost: paid.cost } });
      const blueprint = reference ? blueprintOf(reference) : null;
      const video = await createVideo(
        userId,
        brand._id,
        { text: messageOf(request), details: request, options, media, ...(blueprint ? { reference: blueprint } : {}), language: brand.voice.language || language },
        paid.charged ? paid.cost : videoCost(scopeOf(options)),
        (event) => emit({ type: 'progress', stage: event.stage, state: event.state, data: event.data })
      );
      const msg = message('assistant', reference ? 'Votre vidéo est prête : les animations du modèle, avec votre marque. Retouchez les textes et les images, puis exportez.' : 'Votre vidéo est prête. Retouchez les textes et les images, puis exportez.', {
        result: { kind: 'video', videoId: video.id },
        status: 'done',
        i18n: { key: reference ? 'chat.result.videoFromReference' : 'chat.result.video' },
      });
      await push(session._id, msg, {}, ['pending']);
      emit({ type: 'result', message: msg, video });
    } else {
      paid = await charge(userId, quote.visual(level), session._id);
      emit({ type: 'status', key: 'chat.status.visual.start', text: 'Je compose votre visuel…', data: { cost: paid.cost } });
      // Le format nommé dans la demande (« une story ») l'emporte sur le réglage par défaut.
      const named = formatIn(request);
      const format: FlyerFormat = named || (FLYER_FORMATS.includes(options.format as FlyerFormat) ? (options.format as FlyerFormat) : 'square');
      const wantsDark = /fond (?:noir|sombre)|dark|sombre/i.test(`${request} ${feedback || ''}`);
      const image = reference?.image ? ({ ...reference.image, id: reference._id } as ReferenceImage & { id: string }) : undefined;
      const visual = await createVisual(
        userId,
        brand,
        { prompt: messageOf(request), brief: request, format, creativity: level, withPhoto: options.withPhoto !== false, photoUrl: photoUrl || media.find((m) => m.kind === 'image')?.url, reference: image, sessionId: session._id, feedback, avoid, wantsDark },
        paid.cost
      );
      const msg = message('assistant', image ? 'Voici votre visuel, composé comme le modèle, à votre marque.' : 'Voici votre visuel.', {
        result: { kind: 'visual', visualId: visual._id },
        status: 'done',
        i18n: { key: image ? 'chat.result.visualFromReference' : 'chat.result.visual' },
      });
      await push(session._id, msg, {}, ['pending']);
      emit({ type: 'result', message: msg, visual: visualView(visual) });
    }
  } catch (error) {
    if (error instanceof PaymentRequired) {
      const msg = message('assistant', 'Vos crédits ne suffisent pas pour cette création. Rechargez votre compte IDEM, puis relancez.', { status: 'error', error: 'payment_required', i18n: { key: 'chat.error.payment' } });
      await push(session._id, msg, { pending: keep(request) });
      emit({ type: 'error', error: 'payment_required', message: msg.text, payment: error.body });
      emit({ type: 'message', message: msg });
      return;
    }
    await refund(userId, paid, session.mode === 'video' ? 'Vidéo iVision en échec — crédits restitués' : 'Visuel iVision en échec — crédits restitués');
    const code = error instanceof VideoInputError || error instanceof HttpError ? (error as Error & { code?: string }).code || error.message : 'generation_failed';
    logger.error('chat.generation_failed', { event: 'chat.generation_failed', sessionId: session._id, mode: session.mode, error });
    const msg = message('assistant', 'La création a échoué. Vos crédits ont été restitués ; vous pouvez relancer.', { status: 'error', error: code, i18n: { key: 'chat.error.generation' } });
    await push(session._id, msg, { pending: keep(request) });
    emit({ type: 'message', message: msg });
  }
}

export { referenceView };
