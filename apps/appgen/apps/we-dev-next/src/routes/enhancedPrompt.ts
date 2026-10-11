import { Router, Request, Response } from 'express';
import { generateText } from 'ai';
import { getOpenAIModel } from '../services/aiService.js';
import { getDefaultModelKey, resolveModelCredentials } from '../config/modelConfig.js';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  try {
    const { text } = req.body ?? {};
    if (typeof text !== 'string' || !text.trim() || text.length > 5000) {
      return res.status(400).json({ error: 'A non-empty `text` (max 5000 characters) is required.' });
    }

    const modelKey = getDefaultModelKey();
    const { apiKey, apiUrl } = resolveModelCredentials(modelKey);

    const { text: enhancedText } = await generateText({
      model: getOpenAIModel(apiUrl, apiKey, modelKey),
      system: `You are a product manager and prompt optimization expert. You need to analyze and optimize my input content to provide better output. Only return the enhanced content. My input is: ${text}`,
      prompt: text,
    });

    return res.json({
      code: 0,
      text: enhancedText,
    });
  } catch (error) {
    return res.json({
      code: -1,
      messages: 'Generation failed',
    });
  }
});

export default router;
