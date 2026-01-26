import { createDeepSeek } from '@ai-sdk/deepseek';
import { generateText } from 'ai';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const deepseek = createDeepSeek({
      baseURL: process.env.THIRD_API_URL,
      apiKey: process.env.THIRD_API_KEY,
    });
    // Use smaller model
    const { text } = await request.json();
    console.log(text, 'text');
    const { text: enhancedText } = await generateText({
      model: deepseek('deepseek-chat'),
      system: `You are a product manager and prompt optimization expert. You need to analyze and optimize my input content to provide better output. Only return the enhanced content. My input is: ${text}`,
      prompt: text,
    });
    return NextResponse.json({
      code: 0,
      text: enhancedText,
    });
  } catch (error) {
    return NextResponse.json({
      code: -1,
      messages: 'Generation failed',
    });
  }
}
