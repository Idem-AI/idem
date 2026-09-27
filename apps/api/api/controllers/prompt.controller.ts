import { Response } from 'express';
import { CustomRequest } from '../interfaces/express.interface';
import { AIChatMessage, promptService } from '../services/prompt.service';
import { GLM_MODELS, LLMProvider, TEXT_FALLBACK_MODELS } from '../config/ai.config';

const MAX_MESSAGES = 30;
const MAX_MESSAGE_LENGTH = 20_000;
const CLIENT_ROLES = new Set(['user', 'assistant']);

/**
 * Ne garde du corps que des messages bien formés.
 *
 * Le corps n'est JAMAIS la configuration de l'appel : `provider`, `modelName`,
 * `llmOptions`, `file`, `userId` ou `skipQuotaCheck` sont réservés au serveur.
 * Les accepter du client permettait de lire des fichiers du serveur, de choisir
 * le modèle le plus cher et d'ignorer le quota.
 */
function sanitizeMessages(value: unknown): AIChatMessage[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_MESSAGES) return null;

  const messages: AIChatMessage[] = [];
  for (const item of value) {
    const role = (item as { role?: unknown })?.role;
    const content = (item as { content?: unknown })?.content;
    if (typeof role !== 'string' || !CLIENT_ROLES.has(role)) return null;
    if (typeof content !== 'string' || !content.trim() || content.length > MAX_MESSAGE_LENGTH) {
      return null;
    }
    messages.push({ role: role as AIChatMessage['role'], content });
  }
  return messages;
}

class PromptController {
  async handlePromptRequest(req: CustomRequest, res: Response): Promise<void> {
    try {
      const messages = sanitizeMessages(req.body?.messages);
      if (!messages) {
        res.status(400).json({
          error: `A non-empty messages array (max ${MAX_MESSAGES}, roles user/assistant) is required`,
        });
        return;
      }

      const jsonResponse = await promptService.runPrompt(
        {
          provider: LLMProvider.GLM,
          modelName: GLM_MODELS.mechanical,
          fallbackModels: TEXT_FALLBACK_MODELS,
          userId: req.user?.uid,
          language: req.language,
        },
        messages
      );
      res.status(200).json(jsonResponse);
    } catch (error: any) {
      console.error('Error in PromptController:', error);
      if (error.message?.includes('Quota exceeded')) {
        res.status(429).json({ error: 'Quota exceeded' });
        return;
      }
      res.status(500).send({ error: 'Something broke during prompt processing!' });
    }
  }

  async improvePrompt(req: CustomRequest, res: Response): Promise<void> {
    try {
      const { prompt } = req.body;
      if (!prompt || typeof prompt !== 'string' || !prompt.trim() || prompt.length > 5000) {
        res.status(400).json({ error: 'Le prompt à améliorer est requis.' });
        return;
      }

      const userId = req.user?.uid;
      const messages = [
        {
          role: 'system' as const,
          content: `You are an expert in writing up entrepreneurial projects and in prompt engineering.
Your job is to improve, enrich and clarify the project description supplied by the user (about 2 to 4 sentences).
Strict rules:
- Preserve the original idea and the domain the user chose.
- Make the text inspiring, structured, professional and precise.
- Write it in the SAME LANGUAGE as the user's description.
- Return NO comment, NO title, NO pleasantry. Return ONLY the improved description.`,
        },
        {
          role: 'user' as const,
          content: prompt.trim(),
        },
      ];

      const improvedPrompt = await promptService.runPrompt(
        {
          // Étage mécanique : reformuler et proposer une idée sont des tâches
          // de forme. Le modèle vient du catalogue, pas d'une chaîne en dur.
          provider: LLMProvider.GLM,
          modelName: GLM_MODELS.mechanical,
          fallbackModels: TEXT_FALLBACK_MODELS,
          userId,
          language: req.language,
        },
        messages
      );

      res.status(200).json({ success: true, improvedPrompt: improvedPrompt.trim() });
    } catch (error: any) {
      console.error('Error in improvePrompt:', error);
      if (error.message?.includes('Quota exceeded')) {
        res.status(429).json({ error: 'Quota exceeded' });
        return;
      }
      res.status(500).json({ error: "Erreur lors de l'amélioration du prompt." });
    }
  }

  async generateFeelingLucky(req: CustomRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.uid;
      const messages = [
        {
          role: 'system' as const,
          content: `You generate innovative, high-impact entrepreneurial project ideas focused on Africa.
Produce ONE concrete, realistic project idea addressing a real African problem (for example in agritech, mobile money / fintech, off-grid solar power, health and telemedicine, edtech, local logistics, or adding value to local produce).
Strict rules:
- The description must be concise (2 to 3 sentences maximum).
- It must target a real African problem and propose an innovative technological or social solution.
- Write it IN FRENCH.
- Return NO title, NO comment, NO pleasantry. Return ONLY the project description.`,
        },
        {
          role: 'user' as const,
          content: `Propose one innovative project idea for Africa.`,
        },
      ];

      const idea = await promptService.runPrompt(
        {
          // Étage mécanique : reformuler et proposer une idée sont des tâches
          // de forme. Le modèle vient du catalogue, pas d'une chaîne en dur.
          provider: LLMProvider.GLM,
          modelName: GLM_MODELS.mechanical,
          fallbackModels: TEXT_FALLBACK_MODELS,
          userId,
          language: req.language,
        },
        messages
      );

      res.status(200).json({ success: true, idea: idea.trim() });
    } catch (error: any) {
      console.error('Error in generateFeelingLucky:', error);
      if (error.message?.includes('Quota exceeded')) {
        res.status(429).json({ error: 'Quota exceeded' });
        return;
      }
      res.status(500).json({ error: "Erreur lors de la génération de l'idée." });
    }
  }
}

export const promptController = new PromptController();
