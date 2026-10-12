import crypto from 'crypto';
import logger from '../../config/logger';
import { AI_CONFIG } from '../../config/ai.config';
import { ProjectModel } from '../../models/project.model';
import { parseLlmJson } from '../../utils/llm-json.util';
import { setAiUsageContext } from '../../utils/ai-usage-context.util';
import { cacheService } from '../cache.service';
import { PromptService } from '../prompt.service';

/**
 * Les mots d'une couverture — et rien d'autre.
 *
 * La page est dessinée par le code (`coverComposer.ts`) ; le modèle n'écrit
 * que ce qu'aucun gabarit ne peut deviner : dans quel secteur la marque
 * travaille, et ce qu'elle promet. Le titre est le nom du projet, la date et
 * le type de document viennent du code : ce ne sont pas des choses à inventer.
 */
export interface CoverBrief {
  /** Sur-titre : le secteur, en deux à quatre mots. */
  kicker: string;
  /** La promesse, en une phrase de douze mots au plus. */
  promise: string;
  /** Un mot de la promesse à mettre en valeur, ou vide. */
  highlight?: string;
}

/**
 * Trente jours : la charte, le business plan et le pitch deck d'un même projet
 * partagent leur couverture. La clé suit le nom et la description : un projet
 * qui change de cap obtient de nouveaux mots.
 */
const COVER_BRIEF_TTL_S = 30 * 24 * 3600;

/**
 * Au-delà, la couverture se fait sans le modèle. Une couverture de repli
 * correcte vaut mieux qu'un document qui attend sa première page.
 */
const COVER_BRIEF_TIMEOUT_MS = 45_000;

const clip = (value: unknown, max: number): string => {
  const text = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.–-]+$/, '');
};

function projectText(project: ProjectModel): string {
  return (project.description || project.longDescription || '').trim();
}

/** Couverture sans modèle : la première phrase de la description, bornée. */
export function fallbackCoverBrief(project: ProjectModel): CoverBrief {
  const firstSentence = projectText(project).split(/(?<=[.!?])\s/)[0] ?? '';
  return {
    kicker: '',
    promise: clip(firstSentence, 90) || project.name || '',
  };
}

export class CoverBriefService {
  constructor(private readonly promptService: PromptService) {}

  /** Les mots de la couverture du projet : cache, puis modèle, puis repli. */
  async resolve(userId: string, projectId: string, project: ProjectModel): Promise<CoverBrief> {
    const description = projectText(project);
    const hash = crypto
      .createHash('sha256')
      .update(`${project.name}\n${description}`)
      .digest('hex')
      .slice(0, 16);
    const cacheKey = cacheService.generateAIKey('cover-brief', userId, projectId, hash);

    const cached = await cacheService.get<CoverBrief>(cacheKey, { prefix: 'ai', ttl: COVER_BRIEF_TTL_S });
    if (cached?.promise) return cached;

    const startedAt = Date.now();
    try {
      const brief = await Promise.race([
        this.ask(userId, project, description),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), COVER_BRIEF_TIMEOUT_MS)),
      ]);
      if (brief) {
        await cacheService.set(cacheKey, brief, { prefix: 'ai', ttl: COVER_BRIEF_TTL_S });
        logger.info(`[COVER] Mots de couverture écrits en ${Date.now() - startedAt} ms`, { projectId });
        return brief;
      }
      logger.warn(`[COVER] Mots de couverture indisponibles (délai ou réponse vide) — repli sur la description`, {
        projectId,
      });
    } catch (error: any) {
      logger.warn(`[COVER] Mots de couverture indisponibles (${error?.message}) — repli sur la description`, {
        projectId,
      });
    }
    return fallbackCoverBrief(project);
  }

  private async ask(userId: string, project: ProjectModel, description: string): Promise<CoverBrief | null> {
    const config = AI_CONFIG.coverBrief;
    setAiUsageContext({ feature: 'documents', element: 'cover-brief' });
    const raw = await this.promptService.runPrompt(
      {
        provider: config.provider,
        modelName: config.modelName,
        fallbackModels: config.fallbackModels,
        llmOptions: config.llmOptions,
        userId,
      },
      [
        {
          role: 'user',
          content: `Tu écris les mots de la couverture des documents d'une marque (charte graphique, business plan, pitch deck), en français.
Réponds par UN objet JSON, sans bloc markdown, sans réfléchir longuement :
{"kicker":"…","promise":"…","highlight":"…"}

- kicker : le secteur de la marque, 2 à 4 mots, sans point.
- promise : ce que la marque apporte à ses clients, une phrase de 12 mots au plus, sans point final.
- highlight : UN mot de promise, recopié à l'identique, qui porte le sens ; vide si aucun ne s'impose.

Règles : n'invente aucun chiffre, lieu, date, récompense ni client. Aucun emoji, aucun tiret cadratin. Aucun mot creux (innovant, révolutionnaire, leader, solution, incontournable, unique). Dis ce que la marque fait, concrètement.

Nom de la marque : ${project.name}
${description.slice(0, 2000)}`,
        },
      ]
    );

    const parsed = parseLlmJson<Record<string, unknown>>(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const promise = clip(parsed.promise, 110).replace(/[.。]+$/, '');
    if (!promise) return null;
    const highlight = clip(parsed.highlight, 30);
    return {
      kicker: clip(parsed.kicker, 40).replace(/[.。]+$/, ''),
      promise,
      // Un mot absent de la promesse ne peut pas y être mis en valeur.
      highlight: highlight && promise.toLowerCase().includes(highlight.toLowerCase()) ? highlight : undefined,
    };
  }
}
