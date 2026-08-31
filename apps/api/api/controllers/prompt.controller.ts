import { Response } from 'express';
import { CustomRequest } from '../interfaces/express.interface';
import { PromptRequest, promptService } from '../services/prompt.service';
import { GLM_MODELS, LLMProvider, TEXT_FALLBACK_MODELS } from '../config/ai.config';

class PromptController {
  async handlePromptRequest(req: CustomRequest, res: Response): Promise<void> {
    try {
      const requestBody: PromptRequest = req.body;

      if (!requestBody.messages || requestBody.messages.length === 0) {
        res.status(400).json({
          error: 'Missing required fields: provider, modelName, or non-empty messages array',
        });
        return;
      }
      const messages = requestBody.messages;
      // Le corps de requête vient du client : il ne doit pas pouvoir s'exempter
      // lui-même du plafond MAX_OUTPUT_TOKENS. Ce drapeau est réservé aux
      // appels internes dont le budget est fixé dans ai.config.ts.
      const { bypassOutputTokenCap: _ignored, ...config } = requestBody;

      // Pass the runPrompt function from the service to tryGenerateFullJSON
      const jsonResponse = await promptService.runPrompt(config, messages);
      res.status(200).json(jsonResponse);
    } catch (error: any) {
      console.error('Error in PromptController:', error);
      // Check if the error has a message property, otherwise send a generic error
      const errorMessage = error.message || 'Something broke during prompt processing!';
      res.status(500).send({ error: errorMessage });
    }
  }

  async improvePrompt(req: CustomRequest, res: Response): Promise<void> {
    try {
      const { prompt } = req.body;
      if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
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
        res.status(429).json({ error: 'Quota exceeded', message: error.message });
        return;
      }
      res.status(500).json({ error: error.message || "Erreur lors de l'amélioration du prompt." });
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
        res.status(429).json({ error: 'Quota exceeded', message: error.message });
        return;
      }
      res.status(500).json({ error: error.message || "Erreur lors de la génération de l'idée." });
    }
  }
}

export const promptController = new PromptController();
