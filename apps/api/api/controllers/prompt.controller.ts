import { Response } from 'express';
import { CustomRequest } from '../interfaces/express.interface';
import { PromptRequest, promptService } from '../services/prompt.service';
import { LLMProvider } from '../config/ai.config';

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
      const config = requestBody;

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
          content: `Tu es un expert en rédaction de projets entrepreneuriaux et en ingénierie de prompt.
Ton rôle est d'améliorer, d'enrichir et de rendre plus claire la description de projet fournie par l'utilisateur (environ 2 à 4 phrases).
Règles strictes :
- Conserve l'idée originale et le domaine souhaité par l'utilisateur.
- Rends le texte inspirant, structuré, professionnel et précis.
- Ne renvoie AUCUN commentaire, AUCUN titre, AUCUNE formule de politesse. Renvoie UNIQUEMENT la description améliorée.`,
        },
        {
          role: 'user' as const,
          content: prompt.trim(),
        },
      ];

      const improvedPrompt = await promptService.runPrompt(
        {
          provider: LLMProvider.GEMINI,
          modelName: 'gemini-2.5-flash',
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
          content: `Tu es un générateur d'idées de projets entrepreneuriaux innovants et à fort impact axés sur l'Afrique.
Génère UNE seule idée de projet concrète et réaliste répondant à une vraie problématique en Afrique (par exemple en agritech, mobile money/fintech, électricité solaire hors réseau, santé/télémédecine, edtech, logistique locale, ou valorisation des produits locaux).
Règles strictes :
- La description doit être concise (2 à 3 phrases maximum).
- Elle doit cibler un problème réel en Afrique et proposer une solution technologique ou sociale innovante.
- Ne renvoie AUCUN titre, AUCUN commentaire, AUCUNE formule de politesse. Renvoie UNIQUEMENT la description du projet.`,
        },
        {
          role: 'user' as const,
          content: `Propose-moi une idée de projet innovante pour l'Afrique.`,
        },
      ];

      const idea = await promptService.runPrompt(
        {
          provider: LLMProvider.GEMINI,
          modelName: 'gemini-2.5-flash',
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
