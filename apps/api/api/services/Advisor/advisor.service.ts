import { v4 as uuidv4 } from 'uuid';
import logger from '../../config/logger';
import { AdvisorConversationModel, AdvisorMessage } from '../../models/advisor.model';
import { AIChatMessage, LLMProvider, PromptConfig, PromptService } from '../prompt.service';
import { RepositoryFactory } from '../../repository/RepositoryFactory';
import { IRepository } from '../../repository/IRepository';
import { ProjectModel } from '../../models/project.model';
import { ADVISOR_SYSTEM_PROMPT } from './prompts/system.prompt';

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

    // Build LLM-compatible history (system + prior turns + new user message)
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
}
