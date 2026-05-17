import { v4 as uuidv4 } from 'uuid';
import logger from '../../config/logger';
import {
  AdvisorConversationModel,
  AdvisorMessage,
  AdvisorPendingFinanceIntent,
} from '../../models/advisor.model';
import { AIChatMessage, LLMProvider, PromptConfig, PromptService } from '../prompt.service';
import { RepositoryFactory } from '../../repository/RepositoryFactory';
import { IRepository } from '../../repository/IRepository';
import { ProjectModel } from '../../models/project.model';
import { ADVISOR_SYSTEM_PROMPT } from './prompts/system.prompt';
import { financeAIService, FinanceChatIntent } from '../Finance/finance-ai.service';
import { financeService } from '../Finance/finance.service';

export interface AdvisorReplyResult {
  userMessage: AdvisorMessage;
  assistantMessage: AdvisorMessage;
  conversation: AdvisorConversationModel;
}

const MAX_HISTORY_MESSAGES = 40;

export class AdvisorService {
  private readonly projectRepository: IRepository<ProjectModel>;

  constructor(private readonly promptService: PromptService) {
    this.projectRepository = RepositoryFactory.getRepository<ProjectModel>();
    logger.info('AdvisorService initialized.');
  }

  async getConversation(userId: string, projectId: string): Promise<AdvisorConversationModel> {
    logger.debug(`AdvisorService.getConversation userId=${userId} projectId=${projectId}`);
    const project = await this.projectRepository.findById(projectId, `users/${userId}/projects`);
    if (!project) {
      logger.warn(`AdvisorService.getConversation: project not found ${projectId}`);
      throw new Error(`Project not found: ${projectId}`);
    }
    const conv = project.analysisResultModel?.advisorConversation || {
      messages: [],
      updatedAt: new Date(),
    };
    logger.info(
      `AdvisorService.getConversation loaded ${conv.messages.length} messages for projectId=${projectId}`
    );
    return conv;
  }

  async clearConversation(userId: string, projectId: string): Promise<void> {
    logger.info(`AdvisorService.clearConversation userId=${userId} projectId=${projectId}`);
    const project = await this.projectRepository.findById(projectId, `users/${userId}/projects`);
    if (!project) {
      logger.warn(`AdvisorService.clearConversation: project not found ${projectId}`);
      return;
    }
    project.analysisResultModel.advisorConversation = { messages: [], updatedAt: new Date() };
    await this.projectRepository.update(projectId, project, `users/${userId}/projects`);
    logger.info(`AdvisorService.clearConversation: cleared projectId=${projectId}`);
  }

  /**
   * Build the project-context block injected as a system message before each LLM call.
   */
  private buildProjectContext(project: ProjectModel): string {
    return [
      `PROJET: ${project.name || '—'}`,
      `DESCRIPTION: ${project.description || '—'}`,
      `TYPE: ${JSON.stringify(project.type || {})}`,
      `SCOPE: ${JSON.stringify(project.scope || {})}`,
      `CIBLE: ${JSON.stringify(project.targets || {})}`,
      `TAILLE ÉQUIPE: ${project.teamSize || '—'}`,
      `BUDGET: ${project.budgetIntervals || '—'}`,
      `CONTRAINTES: ${(project.constraints || []).join(', ') || '—'}`,
      `INFORMATIONS COMPLÉMENTAIRES: ${JSON.stringify(project.additionalInfos || {})}`,
    ].join('\n');
  }

  /**
   * Send a user message, call the LLM, persist both messages, return the reply.
   */
  async sendMessage(
    userId: string,
    projectId: string,
    content: string
  ): Promise<AdvisorReplyResult> {
    const startedAt = Date.now();
    const trimmed = (content || '').trim();
    if (!trimmed) {
      logger.warn(`AdvisorService.sendMessage: empty message from userId=${userId}`);
      throw new Error('Empty message');
    }
    logger.info(
      `AdvisorService.sendMessage userId=${userId} projectId=${projectId} length=${trimmed.length}`
    );

    const project = await this.projectRepository.findById(projectId, `users/${userId}/projects`);
    if (!project) {
      logger.warn(`AdvisorService.sendMessage: project not found ${projectId}`);
      throw new Error(`Project not found: ${projectId}`);
    }

    const existing: AdvisorConversationModel = project.analysisResultModel?.advisorConversation || {
      messages: [],
      updatedAt: new Date(),
    };

    const now = new Date();
    const userMessage: AdvisorMessage = {
      id: uuidv4(),
      role: 'user',
      content: trimmed,
      createdAt: now,
    };

    // ----------------------------------------------------------------
    // Détection d'intention Finance — avant l'appel LLM générique.
    // ----------------------------------------------------------------
    let financeIntent: FinanceChatIntent | null = null;
    try {
      financeIntent = await financeAIService.parseChatIntent(userId, projectId, trimmed);
      logger.debug(
        `AdvisorService.sendMessage finance intent: kind=${financeIntent?.kind} isFin=${financeIntent?.isFinanceIntent}`
      );
    } catch (err: any) {
      logger.warn(`AdvisorService.sendMessage parseChatIntent failed: ${err?.message}`);
      financeIntent = null;
    }

    // a) Intent lecture → on répond directement avec le résumé
    if (
      financeIntent?.isFinanceIntent &&
      (financeIntent.kind === 'read_summary' || financeIntent.kind === 'read_section')
    ) {
      const replyText =
        financeIntent.summaryText ||
        (await this.buildFinanceSummaryFallback(userId, projectId, financeIntent));
      const assistantMessage: AdvisorMessage = {
        id: uuidv4(),
        role: 'assistant',
        content: replyText,
        createdAt: new Date(),
      };
      const conversation = await this.persistConversation(
        userId,
        projectId,
        project,
        existing,
        userMessage,
        assistantMessage
      );
      return { userMessage, assistantMessage, conversation };
    }

    // b) Intent mutation → on renvoie la phrase de confirmation + intent stockée
    if (
      financeIntent?.isFinanceIntent &&
      (financeIntent.kind === 'update_field' ||
        financeIntent.kind === 'add_line' ||
        financeIntent.kind === 'delete_line') &&
      financeIntent.section
    ) {
      const pending: AdvisorPendingFinanceIntent = {
        isFinanceIntent: true,
        kind: financeIntent.kind,
        section: financeIntent.section,
        target: financeIntent.target,
        fieldPath: financeIntent.fieldPath,
        value: financeIntent.value,
        month: financeIntent.month,
        year: financeIntent.year,
      };
      const replyText =
        financeIntent.confirmationSentence ||
        'Souhaitez-vous que j\u2019applique cette modification \u00e0 vos finances ?';
      const assistantMessage: AdvisorMessage = {
        id: uuidv4(),
        role: 'assistant',
        content: replyText,
        createdAt: new Date(),
        pendingFinanceIntent: pending,
      };
      const conversation = await this.persistConversation(
        userId,
        projectId,
        project,
        existing,
        userMessage,
        assistantMessage
      );
      return { userMessage, assistantMessage, conversation };
    }

    // c) Pas d'intent finance → flow LLM générique
    const history = existing.messages.slice(-MAX_HISTORY_MESSAGES);
    const aiMessages: AIChatMessage[] = [
      { role: 'system', content: ADVISOR_SYSTEM_PROMPT },
      {
        role: 'system',
        content: `CONTEXTE PROJET:\n${this.buildProjectContext(project)}`,
      },
      ...history.map((m) => ({
        role: (m.role === 'system' ? 'system' : m.role) as AIChatMessage['role'],
        content: m.content,
      })),
      { role: 'user', content: trimmed },
    ];

    const promptConfig: PromptConfig = {
      provider: LLMProvider.GEMINI,
      modelName: 'gemini-3-flash-preview',
      userId,
      promptType: 'advisor',
    };

    logger.info(
      `AdvisorService.sendMessage calling LLM projectId=${projectId} historyLen=${history.length}`
    );
    let raw: string;
    try {
      raw = await this.promptService.runPrompt(promptConfig, aiMessages);
    } catch (err: any) {
      logger.error(
        `AdvisorService.sendMessage LLM call failed projectId=${projectId}: ${err?.message}`,
        { stack: err?.stack }
      );
      throw err;
    }
    const reply = this.promptService.getCleanAIText(raw).trim();
    logger.debug(
      `AdvisorService.sendMessage LLM replyLen=${reply.length} durationMs=${Date.now() - startedAt}`
    );

    const assistantMessage: AdvisorMessage = {
      id: uuidv4(),
      role: 'assistant',
      content: reply,
      createdAt: new Date(),
    };

    const updatedMessages = [...existing.messages, userMessage, assistantMessage];
    const conversation: AdvisorConversationModel = {
      messages: updatedMessages,
      updatedAt: new Date(),
    };

    await this.projectRepository.update(
      projectId,
      {
        ...project,
        analysisResultModel: {
          ...project.analysisResultModel,
          advisorConversation: conversation,
        },
      },
      `users/${userId}/projects`
    );

    logger.info(
      `AdvisorService.sendMessage done projectId=${projectId} totalMessages=${conversation.messages.length} durationMs=${Date.now() - startedAt}`
    );
    return { userMessage, assistantMessage, conversation };
  }

  // -----------------------------------------------------------------
  // Confirmation / annulation d'une intention finance en attente
  // -----------------------------------------------------------------

  /**
   * Applique une intention finance précédemment proposée par l'assistant.
   * @param accepted true si l'utilisateur confirme, false s'il annule.
   */
  async confirmFinanceIntent(
    userId: string,
    projectId: string,
    messageId: string,
    accepted: boolean
  ): Promise<AdvisorReplyResult> {
    logger.info(
      `AdvisorService.confirmFinanceIntent userId=${userId} projectId=${projectId} messageId=${messageId} accepted=${accepted}`
    );
    const project = await this.projectRepository.findById(projectId, `users/${userId}/projects`);
    if (!project) throw new Error(`Project not found: ${projectId}`);

    const existing: AdvisorConversationModel = project.analysisResultModel?.advisorConversation || {
      messages: [],
      updatedAt: new Date(),
    };

    const pendingMsg = existing.messages.find(
      (m) => m.id === messageId && m.role === 'assistant' && m.pendingFinanceIntent
    );
    if (!pendingMsg || !pendingMsg.pendingFinanceIntent) {
      throw new Error('No pending finance intent for this message');
    }
    const pending = pendingMsg.pendingFinanceIntent;

    // Marque comme résolu côté message d'origine
    pendingMsg.pendingFinanceIntent = undefined;
    if (accepted) {
      pendingMsg.appliedFinanceIntent = pending;
    }

    let replyText: string;
    if (accepted) {
      try {
        await financeAIService.applyChatIntent(userId, projectId, {
          isFinanceIntent: true,
          kind: pending.kind,
          section: pending.section as any,
          target: pending.target,
          fieldPath: pending.fieldPath,
          value: pending.value,
          month: pending.month,
          year: pending.year,
        });
        replyText =
          'C\u2019est fait \u2705. La modification a \u00e9t\u00e9 appliqu\u00e9e \u00e0 vos finances et les calculs ont \u00e9t\u00e9 mis \u00e0 jour.';
      } catch (err: any) {
        logger.error(`confirmFinanceIntent apply failed: ${err.message}`);
        replyText = `Je n\u2019ai pas pu appliquer la modification: ${err.message}`;
      }
    } else {
      replyText = 'D\u2019accord, je n\u2019applique aucune modification.';
    }

    const assistantMessage: AdvisorMessage = {
      id: uuidv4(),
      role: 'assistant',
      content: replyText,
      createdAt: new Date(),
    };
    const userMessage: AdvisorMessage = {
      id: uuidv4(),
      role: 'user',
      content: accepted ? '[Confirmation]' : '[Annulation]',
      createdAt: new Date(),
    };

    const updatedMessages = [...existing.messages, userMessage, assistantMessage];
    const conversation: AdvisorConversationModel = {
      messages: updatedMessages,
      updatedAt: new Date(),
    };

    await this.projectRepository.update(
      projectId,
      {
        ...project,
        analysisResultModel: {
          ...project.analysisResultModel,
          advisorConversation: conversation,
        },
      },
      `users/${userId}/projects`
    );
    return { userMessage, assistantMessage, conversation };
  }

  // -----------------------------------------------------------------
  // Helpers internes
  // -----------------------------------------------------------------

  /** Persiste la conversation avec les deux nouveaux messages. */
  private async persistConversation(
    userId: string,
    projectId: string,
    project: ProjectModel,
    existing: AdvisorConversationModel,
    userMessage: AdvisorMessage,
    assistantMessage: AdvisorMessage
  ): Promise<AdvisorConversationModel> {
    const conversation: AdvisorConversationModel = {
      messages: [...existing.messages, userMessage, assistantMessage],
      updatedAt: new Date(),
    };
    await this.projectRepository.update(
      projectId,
      {
        ...project,
        analysisResultModel: {
          ...project.analysisResultModel,
          advisorConversation: conversation,
        },
      },
      `users/${userId}/projects`
    );
    return conversation;
  }

  /** Construit un résumé finance de secours si l'IA n'a pas renvoyé `summaryText`. */
  private async buildFinanceSummaryFallback(
    userId: string,
    projectId: string,
    intent: FinanceChatIntent
  ): Promise<string> {
    try {
      const result = await financeService.getSummary(userId, projectId);
      if (!result) {
        return 'Aucune donn\u00e9e financi\u00e8re disponible pour le moment. Voulez-vous que je remplisse une premi\u00e8re \u00e9bauche avec l\u2019IA ?';
      }
      const s = result.summary;
      const fmt = (v: number) =>
        Math.round(v)
          .toString()
          .replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' FCFA';
      const lines = [
        `Voici un r\u00e9sum\u00e9 de vos finances :`,
        `- Chiffre d\u2019affaires An 1: ${fmt(s.caY1)}`,
        `- R\u00e9sultat net An 3: ${fmt(s.resultatNetY3)}`,
        `- Marge brute: ${s.margeBrutePct.toFixed(1)}%`,
        `- Tr\u00e9sorerie cl\u00f4ture An 1: ${fmt(s.tresorerieClotureY1)}`,
        `- Point mort: ${Math.round(s.pointMortJours)} jours`,
        `- Co\u00fbt total du projet: ${fmt(s.coutTotalProjet)}`,
        `- TRI: ${s.tri.toFixed(1)}%`,
        `- VAN: ${fmt(s.van)}`,
      ];
      if (s.alerts && s.alerts.length > 0) {
        lines.push('', 'Points de vigilance:');
        s.alerts.forEach((a) => lines.push(`- ${a}`));
      }
      return lines.join('\n');
    } catch (err: any) {
      logger.warn(`buildFinanceSummaryFallback failed: ${err?.message}`);
      return 'Je n\u2019ai pas pu r\u00e9cup\u00e9rer le r\u00e9sum\u00e9 de vos finances pour le moment.';
    }
  }
}
