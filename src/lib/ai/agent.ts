import { AITurnResult, GameState, Locale } from '@/types/game';
import {
  buildSystemPrompt,
  buildGameContext,
  buildUserMessage,
  validateAIResponse,
} from './prompts';

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenAIResponse {
  choices: {
    message: {
      content: string;
    };
  }[];
}

/**
 * Call OpenAI API (or compatible provider)
 */
async function callOpenAI(
  messages: OpenAIMessage[],
  model: string = 'gpt-4o-mini'
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  const apiBase = process.env.OPENAI_API_BASE || 'https://api.openai.com/v1';

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  const response = await fetch(`${apiBase}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.7,
      max_tokens: 1000,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${error}`);
  }

  const data: OpenAIResponse = await response.json();
  const content = data.choices[0]?.message?.content;
  
  if (!content) {
    console.error('Empty response from OpenAI:', data);
    throw new Error('OpenAI returned empty response');
  }
  
  return content;
}

/**
 * Generate AI turn result
 */
export async function generateAITurn(
  state: GameState,
  recentNarratives: string[],
  sceneContext: string,
  choiceId: string | null,
  locale: Locale
): Promise<AITurnResult> {
  const systemPrompt = buildSystemPrompt(locale);
  const gameContext = buildGameContext(state, recentNarratives, locale);
  const userMessage = buildUserMessage(sceneContext, choiceId, locale);

  const messages: OpenAIMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `${gameContext}\n\n${userMessage}` },
  ];

  const model = process.env.AI_MODEL || 'gpt-4o-mini';

  try {
    const responseText = await callOpenAI(messages, model);
    
    // Debug: Log the response
    console.log('AI Response text:', responseText.substring(0, 200));
    
    if (!responseText || responseText.trim().length === 0) {
      throw new Error('AI returned empty response');
    }
    
    const jsonData = JSON.parse(responseText);
    const validated = validateAIResponse(jsonData);

    return validated;
  } catch (error) {
    console.error('AI generation error:', error);
    throw new Error(
      `Failed to generate AI response: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Fallback AI response for when API fails
 */
export function getFallbackResponse(
  state: GameState,
  locale: Locale
): AITurnResult {
  if (locale === 'vi') {
    return {
      locale: 'vi',
      narrative:
        'Bạn đang ở trong một khu rừng yên tĩnh. Không có gì đặc biệt xảy ra. Có lẽ bạn nên nghỉ ngơi hoặc tiếp tục hành trình.',
      choices: [
        { id: 'rest', text: 'Nghỉ ngơi', cost: { time_segments: 1 } },
        { id: 'continue', text: 'Tiếp tục' },
      ],
      proposed_deltas: [
        { field: 'stats.stamina', operation: 'add', value: 1 },
      ],
      events: [],
    };
  } else {
    return {
      locale: 'en',
      narrative:
        'You are in a quiet forest. Nothing special happens. Perhaps you should rest or continue your journey.',
      choices: [
        { id: 'rest', text: 'Rest', cost: { time_segments: 1 } },
        { id: 'continue', text: 'Continue' },
      ],
      proposed_deltas: [
        { field: 'stats.stamina', operation: 'add', value: 1 },
      ],
      events: [],
    };
  }
}
