import { Router, Request, Response } from 'express';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { generateText } from 'ai';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  try {
    const deepseek = createDeepSeek({
      baseURL: process.env.THIRD_API_URL,
      apiKey: process.env.THIRD_API_KEY,
    });

    const { text } = req.body;
    console.log(text, 'text');

    const { text: enhancedText } = await generateText({
      model: deepseek('deepseek-chat'),
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
