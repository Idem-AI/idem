/**
 * L'ATELIER — création conversationnelle de visuels.
 *
 * Un agent à outils, sur le runtime commun (`runAgent`) : même boucle d'outils,
 * même repli sans outils, même trace et même ventilation du coût que les agents
 * de génération.
 *
 * ── Pourquoi il existe ────────────────────────────────────────────────────────
 * `generateFlyer` exigeait un `ContentIdea` déjà inscrit au calendrier. Obtenir
 * son premier visuel coûtait donc une stratégie (40 crédits) puis un calendrier
 * (15) avant le visuel lui-même (2). Ici, une phrase suffit.
 *
 * ── Ce qu'il ne fait pas ──────────────────────────────────────────────────────
 * Il ne compose RIEN. Il traduit une demande en appel d'outil ; la composition
 * passe par `composeFlyer`, qui porte la charte (couleurs exactes, deux familles
 * typographiques, logo, graine de design, grille, audit visuel). Le branding est
 * donc respecté par construction, pas par consigne — c'est le point de la
 * conception : un agent conversationnel ne doit jamais avoir la charte en prose,
 * sinon elle devient manquable.
 *
 * ── La facturation ───────────────────────────────────────────────────────────
 * Elle est portée par l'OUTIL, pas par la route. Un chat où chaque phrase coûte
 * un crédit est un chat que personne n'ouvre : poser une question, demander un
 * conseil ou faire écrire une légende est gratuit ; produire un visuel se paie.
 */
import { FunctionDeclaration, Type } from '@google/genai';
import crypto from 'crypto';
import logger from '../../config/logger';
import { AI_CONFIG } from '../../config/ai.config';
import {
  ContentChannel,
  Flyer,
  FlyerFormat,
  StudioConversation,
  StudioMessage,
  StudioPendingAction,
  VisualIntent,
} from '../../models/communication.model';
import { BUSINESS_CREDIT_COSTS } from '../../models/billing.model';
import { AIChatMessage } from '../prompt.service';
import { runAgent } from '../agents/agent-runtime';
import { billingSettingsService } from '../billing/billing-settings.service';
import { creditLedgerService } from '../billing/credit-ledger.service';
import { entitlementsService } from '../billing/entitlements.service';
import { AGENT_STUDIO_PROMPT } from './prompts/agent-studio.prompt';
import { AGENT_MOMENT_CONTENT_PROMPT } from './prompts/agent-moment-content.prompt';
import { CommunicationService } from './communication.service';
import { setTraceProjectId } from '../../utils/trace.util';

/** Historique relu à chaque tour. Au-delà, la conversation est tronquée par le début. */
const MAX_HISTORY_MESSAGES = 30;

const FORMATS: FlyerFormat[] = ['square', 'story', 'banner', 'post', 'a4'];
const INTENTS: VisualIntent[] = [
  'awareness',
  'celebration',
  'promotion',
  'recruitment',
  'announcement',
];

/** Crédits insuffisants — porté jusqu'au contrôleur, qui répond 402. */
export class InsufficientCreditsError extends Error {
  constructor(
    readonly cost: number,
    readonly balance: number
  ) {
    super('insufficient_credits');
    this.name = 'InsufficientCreditsError';
  }
}

export interface StudioReply {
  userMessage: StudioMessage;
  assistantMessage: StudioMessage;
  /** Visuels produits pendant ce tour, prêts à être affichés. */
  visuals: Flyer[];
  conversation: StudioConversation;
}

export type StudioStreamEvent =
  | { type: 'thinking'; label: string }
  | { type: 'visual'; visual: Flyer }
  | { type: 'message'; message: StudioMessage }
  | { type: 'error'; message: string };

export class StudioService {
  constructor(private readonly communication: CommunicationService) {}

  // --------------------------------------------------------------------------
  // Conversation
  // --------------------------------------------------------------------------

  async getConversation(userId: string, projectId: string): Promise<StudioConversation> {
    const model = await this.communication.getCommunication(userId, projectId);
    return model?.studio || { messages: [], updatedAt: new Date() };
  }

  async clearConversation(userId: string, projectId: string): Promise<void> {
    await this.communication.patchStudio(userId, projectId, {
      messages: [],
      updatedAt: new Date(),
    });
  }

  /**
   * Un tour de conversation.
   *
   * `onEvent` sert la latence perçue : produire un visuel prend une à trois
   * minutes, et l'utilisateur doit voir que quelque chose se passe — puis voir le
   * visuel apparaître AVANT le message qui l'accompagne.
   */
  async sendMessage(
    userId: string,
    projectId: string,
    content: string,
    onEvent?: (event: StudioStreamEvent) => Promise<void>
  ): Promise<StudioReply> {
    setTraceProjectId(projectId);
    const trimmed = (content || '').trim();
    if (!trimmed) throw new Error('Empty message');

    const conversation = await this.getConversation(userId, projectId);
    const userMessage: StudioMessage = {
      id: this.newId('msg'),
      role: 'user',
      content: trimmed,
      createdAt: new Date(),
    };

    // ── Ce que l'agent produit pendant le tour, collecté par l'exécuteur ─────
    const produced: Flyer[] = [];
    let caption: string | undefined;
    let hashtags: string[] | undefined;
    let pendingAction: StudioPendingAction | undefined;
    let creditsSpent = 0;
    /**
     * Refus pour crédits insuffisants rencontré dans un outil.
     *
     * Il ne doit PAS remonter en exception : `runAgent` rattrape toute erreur de
     * la boucle d'outils et rejoue le tour SANS outils (`fallbackWithoutTools`).
     * Une exception lancée ici serait donc avalée, et l'utilisateur recevrait une
     * réponse de conversation ordinaire au lieu de l'invitation à recharger.
     */
    let creditsError: InsufficientCreditsError | null = null;

    /** Débite, ou consigne le refus et laisse l'agent l'expliquer. */
    const tryCharge = async (
      action: Parameters<StudioService['charge']>[2],
      element: string,
      multiplier = 1
    ): Promise<number | null> => {
      try {
        return await this.charge(userId, projectId, action, element, multiplier);
      } catch (err) {
        if (err instanceof InsufficientCreditsError) {
          creditsError = err;
          return null;
        }
        throw err;
      }
    };

    const creditRefusal = {
      ok: false,
      error: 'insufficient_credits',
      hint: 'Tell the user they are out of credits for this. Do NOT retry this tool.',
    };

    const systemPrompt = await this.buildSystemPrompt(userId, projectId);
    const history = conversation.messages.slice(-MAX_HISTORY_MESSAGES);
    const messages: AIChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...history.map((message) => ({
        role: message.role as 'user' | 'assistant',
        content: this.replayContent(message),
      })),
      { role: 'user', content: trimmed },
    ];

    const executor = async (name: string, args: Record<string, unknown>): Promise<unknown> => {
      logger.info('[Studio] tool call', { projectId, tool: name });
      switch (name) {
        case 'create_visual': {
          const brief = String(args.brief || trimmed);
          const format = this.asFormat(args.format);
          const intent = this.asIntent(args.intent);
          const withPhoto = args.withPhoto !== false;
          const variants = Math.min(3, Math.max(1, Number(args.variants) || 1));

          await onEvent?.({
            type: 'thinking',
            label: variants > 1 ? 'studio.composingVariants' : 'studio.composing',
          });

          // Débité AVANT de produire : l'inverse laisse lancer en parallèle plus
          // de générations que le solde n'en couvre. Le remboursement en cas
          // d'échec est porté par le catch plus bas.
          const action = variants > 1 ? 'carousel' : 'flyer';
          const charged = await tryCharge(action, `studio:${format}`);
          if (charged === null) return creditRefusal;
          creditsSpent += charged;

          try {
            const visuals =
              variants > 1
                ? await this.communication.createVisualVariants(userId, projectId, {
                    brief,
                    format,
                    intent,
                    withPhoto,
                    count: variants,
                  })
                : [
                    await this.communication.createVisualFromBrief(userId, projectId, {
                      brief,
                      format,
                      intent,
                      withPhoto,
                    }),
                  ];

            for (const visual of visuals) {
              produced.push(visual);
              await onEvent?.({ type: 'visual', visual });
            }
            pendingAction = { kind: 'schedule', visualId: visuals[0].id };
            return {
              ok: true,
              visuals: visuals.map((visual) => ({
                id: visual.id,
                format: visual.format,
                headline: visual.marketingText?.headline,
              })),
            };
          } catch (err: any) {
            await this.refund(userId, projectId, charged, action);
            creditsSpent -= charged;
            return { ok: false, error: err?.message || 'composition failed' };
          }
        }

        case 'edit_visual': {
          const visualId = String(args.visualId || produced[0]?.id || '');
          const instruction = String(args.instruction || '');
          if (!visualId || !instruction) return { ok: false, error: 'visualId and instruction required' };

          await onEvent?.({ type: 'thinking', label: 'studio.retouching' });
          const charged = await tryCharge('revision', `studio-edit:${visualId}`);
          if (charged === null) return creditRefusal;
          creditsSpent += charged;

          try {
            const edited = await this.communication.aiEditFlyer(
              userId,
              projectId,
              visualId,
              instruction
            );
            if (!edited) throw new Error('the retouch produced nothing usable');
            produced.push(edited);
            await onEvent?.({ type: 'visual', visual: edited });
            return { ok: true, visualId: edited.id };
          } catch (err: any) {
            await this.refund(userId, projectId, charged, 'revision');
            creditsSpent -= charged;
            return { ok: false, error: err?.message || 'edit failed' };
          }
        }

        case 'declinate_visual': {
          const visualId = String(args.visualId || produced[0]?.id || '');
          const formats = Array.isArray(args.formats)
            ? (args.formats as unknown[]).map((format) => this.asFormat(format))
            : [];
          if (!visualId || !formats.length) return { ok: false, error: 'visualId and formats required' };

          await onEvent?.({ type: 'thinking', label: 'studio.declinating' });
          // Une déclinaison reprend la copie déjà écrite : elle vaut une révision
          // par format, pas un visuel neuf.
          const charged = await tryCharge(
            'revision',
            `studio-declinate:${visualId}`,
            formats.length
          );
          if (charged === null) return creditRefusal;
          creditsSpent += charged;

          try {
            const created = await this.communication.declinateVisual(
              userId,
              projectId,
              visualId,
              formats
            );
            for (const visual of created) {
              produced.push(visual);
              await onEvent?.({ type: 'visual', visual });
            }
            return { ok: true, created: created.map((visual) => visual.format) };
          } catch (err: any) {
            await this.refund(userId, projectId, charged, 'revision');
            creditsSpent -= charged;
            return { ok: false, error: err?.message || 'declination failed' };
          }
        }

        case 'write_caption': {
          // Gratuit : c'est du texte, et un chat qui facture une légende ne sert
          // à rien. Le coût réel est marginal face à une composition.
          await onEvent?.({ type: 'thinking', label: 'studio.writingCaption' });
          const written = await this.writeCaption(userId, projectId, {
            subject: String(args.subject || trimmed),
            channel: this.asChannel(args.channel),
            intent: this.asIntent(args.intent),
          });
          caption = written.caption;
          hashtags = written.hashtags;
          return { ok: true, caption: written.caption, hashtags: written.hashtags };
        }

        case 'schedule_visual': {
          const visualId = String(args.visualId || produced[0]?.id || '');
          const date = String(args.date || '');
          if (!visualId || !date) return { ok: false, error: 'visualId and date required' };

          const plans = await this.communication.listPlans(userId, projectId);
          const planId =
            String(args.planId || '') ||
            // À défaut de période nommée, celle qui CONTIENT la date : c'est
            // l'intention de l'utilisateur, pas la première de la liste.
            plans.find(
              (plan) =>
                plan.status !== 'archived' &&
                date >= plan.period.start &&
                date <= plan.period.end
            )?.id;

          if (!planId) {
            // Sans période couvrant la date, on ne crée pas une période au nom de
            // l'utilisateur : on le lui propose.
            pendingAction = { kind: 'schedule', visualId, date };
            return {
              ok: false,
              error: 'no period covers this date',
              hint: 'Tell the user no period covers that date and offer to create one.',
            };
          }

          const item = await this.communication.scheduleVisual(userId, projectId, {
            visualId,
            planId,
            date,
            channel: this.asChannel(args.channel),
            caption,
          });
          return { ok: true, contentId: item?.id, planId };
        }

        case 'list_visuals': {
          const visuals = await this.communication.listVisuals(userId, projectId);
          return {
            ok: true,
            visuals: visuals.slice(0, 20).map((visual) => ({
              id: visual.id,
              format: visual.format,
              brief: visual.brief,
              headline: visual.marketingText?.headline,
              createdAt: visual.createdAt,
            })),
          };
        }

        case 'read_brand': {
          const context = await this.communication.extractContext(userId, projectId);
          return {
            ok: true,
            brand: {
              name: context.brandName,
              businessType: context.businessType,
              tone: context.tone,
              targetAudience: context.targetAudience,
              colors: {
                primary: context.branding.primary,
                secondary: context.branding.secondary,
                accent: context.branding.accent,
              },
              fonts: {
                primary: context.branding.primaryFont,
                secondary: context.branding.secondaryFont,
              },
              channels: context.channels,
            },
          };
        }

        default:
          return { ok: false, error: `unknown tool: ${name}` };
      }
    };

    let reply: string;
    try {
      const result = await runAgent(
        {
          role: 'studio',
          task: 'draft',
          baseConfig: {
            provider: AI_CONFIG.communication.studio.provider,
            modelName: AI_CONFIG.communication.studio.modelName,
            fallbackModels: AI_CONFIG.communication.studio.fallbackModels,
            llmOptions: AI_CONFIG.communication.studio.llmOptions,
          },
          promptType: AI_CONFIG.communication.studio.promptType,
          tools: STUDIO_TOOL_DECLARATIONS,
          toolExecutor: executor,
          maxToolTurns: 4,
          // Sans outils, l'atelier peut encore CONVERSER : mieux vaut une réponse
          // utile qu'une erreur si le fournisseur perd le function-calling.
          fallbackWithoutTools: true,
        },
        { messages, userId, projectId, element: 'studio-turn' }
      );
      reply = result.text.trim();
    } catch (err: any) {
      logger.error('[Studio] agent run failed', { projectId, error: err?.message });
      throw err;
    }

    // Rien n'a pu être produit faute de crédits : le tour n'a rien donné, on
    // remonte le refus pour que l'interface propose de recharger. Si l'agent a
    // malgré tout produit quelque chose avant le mur, on conserve le tour.
    if (creditsError && produced.length === 0) {
      throw creditsError;
    }

    const assistantMessage: StudioMessage = {
      id: this.newId('msg'),
      role: 'assistant',
      content: reply || this.fallbackReply(produced),
      visualIds: produced.length ? produced.map((visual) => visual.id) : undefined,
      caption,
      hashtags,
      pendingAction,
      creditsSpent: creditsSpent > 0 ? creditsSpent : undefined,
      createdAt: new Date(),
    };

    const next: StudioConversation = {
      messages: [...conversation.messages, userMessage, assistantMessage],
      updatedAt: new Date(),
    };
    await this.communication.patchStudio(userId, projectId, next);
    await onEvent?.({ type: 'message', message: assistantMessage });

    logger.info('[Studio] turn done', {
      projectId,
      visuals: produced.length,
      creditsSpent,
    });
    return { userMessage, assistantMessage, visuals: produced, conversation: next };
  }

  // --------------------------------------------------------------------------
  // Internes
  // --------------------------------------------------------------------------

  /**
   * Le prompt système : la marque, la boussole condensée, la période en cours.
   *
   * La période active est transmise pour que « je le poste vendredi » trouve une
   * destination sans question supplémentaire.
   */
  private async buildSystemPrompt(userId: string, projectId: string): Promise<string> {
    const [context, plans, strategy] = await Promise.all([
      this.communication.extractContext(userId, projectId),
      this.communication.listPlans(userId, projectId),
      this.communication
        .getCommunication(userId, projectId)
        .then((model) => model?.strategy ?? null),
    ]);

    const brand = [
      `Brand: ${context.brandName}`,
      `Business: ${context.businessType}`,
      `Audience: ${context.targetAudience}`,
      `Tone: ${context.tone}`,
      `Language: ${context.language}`,
      `Channels: ${(context.channels || []).join(', ') || 'unspecified'}`,
    ].join('\n');

    const compass = strategy
      ? [
          strategy.summary,
          ...(strategy.blocks || [])
            .filter((block) => ['positioning', 'messaging', 'tone'].includes(block.kind))
            .map((block) => `${block.title}: ${block.body}`),
        ]
          .filter(Boolean)
          .join('\n')
      : '(no brand compass yet — no need for one to create a visual)';

    const today = new Date().toISOString().slice(0, 10);
    const active = plans.find((plan) => plan.status === 'active') || plans[0];
    const period = active
      ? [
          `Today: ${today}`,
          `Current period: "${active.name}" (${active.period.start} → ${active.period.end})`,
          active.brief?.keyMessage ? `Key message: ${active.brief.keyMessage}` : '',
          `planId to use when scheduling: ${active.id}`,
        ]
          .filter(Boolean)
          .join('\n')
      : `Today: ${today}\nNo period planned yet — you can still create visuals; just do not pretend a plan exists.`;

    return AGENT_STUDIO_PROMPT.replace('{{BRAND_CONTEXT}}', brand)
      .replace('{{COMPASS}}', compass)
      .replace('{{ACTIVE_PERIOD}}', period);
  }

  /**
   * Rejoue un message d'historique pour le modèle.
   *
   * Les visuels produits sont rappelés par leur id : sans cela, « change la
   * couleur du deuxième » n'a aucun référent, et l'agent recrée au lieu de
   * retoucher — ce qui coûte 2 crédits au lieu de 1.
   */
  private replayContent(message: StudioMessage): string {
    if (message.role === 'user') return message.content;
    const parts = [message.content];
    if (message.visualIds?.length) {
      parts.push(`[visuals produced: ${message.visualIds.join(', ')}]`);
    }
    return parts.join('\n');
  }

  private fallbackReply(produced: Flyer[]): string {
    return produced.length
      ? 'Voilà.'
      : "Je n'ai pas réussi à produire quelque chose d'utile. Reformule en une phrase ce que tu veux communiquer.";
  }

  /** Légende publiable pour un sujet — réutilise le rédacteur déjà en place. */
  private async writeCaption(
    userId: string,
    projectId: string,
    input: { subject: string; channel?: ContentChannel; intent?: VisualIntent }
  ): Promise<{ caption: string; hashtags: string[] }> {
    const context = await this.communication.extractContext(userId, projectId);
    const systemPrompt = AGENT_MOMENT_CONTENT_PROMPT.replace(
      /\{\{LANGUAGE\}\}/g,
      context.language || 'fr'
    );

    const raw = await this.communication.runStudioPrompt(userId, [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: JSON.stringify({
          BRAND: {
            name: context.brandName,
            businessType: context.businessType,
            tone: context.tone,
            keywords: context.keywords,
            targetAudience: context.targetAudience,
            language: context.language,
          },
          OCCASION: { label: input.subject },
          MESSAGE: input.subject,
          INTENT: input.intent || 'awareness',
          CHANNEL: input.channel || context.channels?.[0] || 'instagram',
        }),
      },
    ]);

    const parsed = this.safeJson<{ caption?: string; hashtags?: string[] }>(raw) ?? {};
    return {
      caption: parsed.caption || '',
      hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags.slice(0, 6) : [],
    };
  }

  // ---- Facturation par outil ----------------------------------------------

  /**
   * Débite une action d'outil. Renvoie ce qui a été réellement débité.
   *
   * Le mode d'application (`off` / `log` / `enforce`) est celui du reste de la
   * plateforme : un atelier qui facturerait alors que le barème est en
   * observation créerait une incohérence invisible.
   */
  async charge(
    userId: string,
    projectId: string,
    action: keyof typeof BUSINESS_CREDIT_COSTS,
    element: string,
    multiplier = 1
  ): Promise<number> {
    const mode = await billingSettingsService.getEnforcement();
    const cost = BUSINESS_CREDIT_COSTS[action] * Math.max(1, multiplier);
    if (mode !== 'enforce' || cost <= 0) return 0;

    const result = await creditLedgerService.debit(userId, 'business', cost, {
      action,
      projectId,
      feature: 'communication',
      element,
    });
    if (!result.allowed) {
      throw new InsufficientCreditsError(cost, result.balance);
    }
    await entitlementsService.invalidate(userId);
    return cost;
  }

  /** Rend les crédits d'une production qui a échoué : on ne fait pas payer un visuel jamais reçu. */
  private async refund(
    userId: string,
    projectId: string,
    amount: number,
    action: string
  ): Promise<void> {
    if (amount <= 0) return;
    try {
      await creditLedgerService.refundDebit(userId, 'business', amount, {
        action,
        projectId,
        feature: 'communication',
        note: "Remboursement — production échouée dans l'atelier",
      });
      await entitlementsService.invalidate(userId);
    } catch (err: any) {
      logger.error('[Studio] refund failed', { projectId, amount, error: err?.message });
    }
  }

  // ---- Normalisation des arguments d'outil --------------------------------

  private asFormat(value: unknown): FlyerFormat {
    const candidate = String(value || '').toLowerCase() as FlyerFormat;
    return FORMATS.includes(candidate) ? candidate : 'square';
  }

  private asIntent(value: unknown): VisualIntent | undefined {
    const candidate = String(value || '').toLowerCase() as VisualIntent;
    return INTENTS.includes(candidate) ? candidate : undefined;
  }

  private asChannel(value: unknown): ContentChannel | undefined {
    const candidate = String(value || '').toLowerCase();
    return candidate ? (candidate as ContentChannel) : undefined;
  }

  private safeJson<T>(raw: string): T | null {
    if (!raw) return null;
    const cleaned = raw
      .replace(/^```(json)?\s*/i, '')
      .replace(/```$/g, '')
      .trim();
    try {
      return JSON.parse(cleaned) as T;
    } catch {
      const match = cleaned.match(/[[{][\s\S]*[\]}]/);
      if (match) {
        try {
          return JSON.parse(match[0]) as T;
        } catch {
          /* ignore */
        }
      }
      return null;
    }
  }

  private newId(prefix: string): string {
    return `${prefix}-${Date.now().toString(36)}-${crypto.randomInt(1e6).toString(36)}`;
  }
}

/**
 * Les outils de l'atelier.
 *
 * Les descriptions sont écrites pour un PETIT modèle : elles disent quand
 * appeler l'outil, pas seulement ce qu'il fait. C'est la différence entre un
 * agent qui retouche (1 crédit) et un agent qui recrée (2 crédits) quand
 * l'utilisateur dit « trop chargé ».
 */
export const STUDIO_TOOL_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: 'create_visual',
    description:
      'Produce one visual (or several variants) from a creative brief, composed with the brand charter. Call it whenever the user asks for something to publish. Costs the user credits, so never call it to illustrate an explanation.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        brief: {
          type: Type.STRING,
          description:
            "The user's request rewritten as a self-contained brief: what it says, to whom, in which tone. Keep their own specifics (dates, prices, opening hours) verbatim.",
        },
        format: {
          type: Type.STRING,
          enum: FORMATS,
          description:
            'square = feed post (default) · story = vertical for stories/WhatsApp status · banner = cover image · post = portrait feed · a4 = printable flyer.',
        },
        intent: {
          type: Type.STRING,
          enum: INTENTS,
          description:
            'Communication purpose. It drives the tone of the composition, never a button (a visual never carries a call-to-action).',
        },
        withPhoto: {
          type: Type.BOOLEAN,
          description:
            'true (default) to compose over a photograph. false for a purely typographic visual — often stronger for a price, a date or one short sentence.',
        },
        variants: {
          type: Type.NUMBER,
          description:
            'How many different compositions of the same brief (1 to 3). Use more than 1 ONLY when the user explicitly wants options.',
        },
      },
      required: ['brief'],
    },
  },
  {
    name: 'edit_visual',
    description:
      'Retouch an existing visual from a natural-language instruction ("plus sobre", "agrandis le prix", "logo en haut"). ALWAYS prefer this over create_visual when the user is reacting to a visual that already exists: it costs them less.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        visualId: {
          type: Type.STRING,
          description: 'Id of the visual to retouch. Defaults to the one just produced.',
        },
        instruction: {
          type: Type.STRING,
          description: 'What to change, in the user\'s own words.',
        },
      },
      required: ['instruction'],
    },
  },
  {
    name: 'declinate_visual',
    description:
      'Recompose an existing visual in other formats, reusing its copy. Use it for "et en story ?", "il me faut aussi la bannière".',
    parameters: {
      type: Type.OBJECT,
      properties: {
        visualId: { type: Type.STRING, description: 'Id of the source visual.' },
        formats: {
          type: Type.ARRAY,
          items: { type: Type.STRING, enum: FORMATS },
          description: 'Formats to produce, excluding the source format.',
        },
      },
      required: ['formats'],
    },
  },
  {
    name: 'write_caption',
    description:
      'Write the publishable post text (caption + hashtags) for a subject or a visual. Free for the user. Call it when they ask what to write, or right after producing a visual they are about to publish.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        subject: { type: Type.STRING, description: 'What the post is about.' },
        channel: {
          type: Type.STRING,
          description: 'Target network (instagram, facebook, linkedin, tiktok, x…).',
        },
        intent: { type: Type.STRING, enum: INTENTS },
      },
      required: ['subject'],
    },
  },
  {
    name: 'schedule_visual',
    description:
      'Attach a visual to a period at a given date so it appears in the plan. Call it when the user says when they will publish.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        visualId: { type: Type.STRING, description: 'Id of the visual to schedule.' },
        date: { type: Type.STRING, description: 'Publication date, YYYY-MM-DD.' },
        planId: {
          type: Type.STRING,
          description: 'Period to file it under. Omit to use the period covering that date.',
        },
        channel: { type: Type.STRING, description: 'Network it will be published on.' },
      },
      required: ['date'],
    },
  },
  {
    name: 'list_visuals',
    description:
      'List the visuals this project already holds. Call it before creating something that may already exist, and when the user refers to an earlier visual.',
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: 'read_brand',
    description:
      "The brand's colours, fonts, tone and audience. Only needed to ANSWER a question about the brand — never to create a visual, since the charter is applied downstream.",
    parameters: { type: Type.OBJECT, properties: {} },
  },
];
