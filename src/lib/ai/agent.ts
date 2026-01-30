import { AITurnResult, GameState, Locale } from "@/types/game";
import {
  buildSystemPrompt,
  buildGameContext,
  buildUserMessage,
  validateAIResponse,
  buildVarietyEnforcement,
} from "./prompts";

interface OpenAIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OpenAIResponse {
  choices: {
    message: {
      content: string;
    };
    finish_reason?: string;
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// Anti-repetition: Track recent themes to avoid
const NARRATIVE_THEMES = [
  "forest",
  "cave",
  "merchant",
  "bandit",
  "herbs",
  "cultivation",
  "rest",
  "beast",
  "village",
  "treasure",
  "sect",
  "river",
  "mountain",
  "market",
];

/**
 * Extract themes from narrative text
 */
function extractThemes(narrative: string): string[] {
  const lowerNarrative = narrative.toLowerCase();
  return NARRATIVE_THEMES.filter(
    (theme) => lowerNarrative.includes(theme) || lowerNarrative.includes(themeVietnamese(theme))
  );
}

function themeVietnamese(theme: string): string {
  const map: Record<string, string> = {
    forest: "rừng",
    cave: "hang",
    merchant: "thương nhân",
    bandit: "phỉ",
    herbs: "thảo",
    cultivation: "tu luyện",
    rest: "nghỉ",
    beast: "thú",
    village: "làng",
    treasure: "bảo",
    sect: "tông",
    river: "sông",
    mountain: "núi",
    market: "chợ",
  };
  return map[theme] || theme;
}

/**
 * Suggest themes to avoid based on recent narratives
 */
function getThemesToAvoid(recentNarratives: string[]): string[] {
  const themeCounts: Record<string, number> = {};

  recentNarratives.forEach((narrative, index) => {
    const weight = index + 1; // More recent = higher weight
    extractThemes(narrative).forEach((theme) => {
      themeCounts[theme] = (themeCounts[theme] || 0) + weight;
    });
  });

  // Return themes that appeared more than once recently
  return Object.entries(themeCounts)
    .filter(([_, count]) => count >= 2)
    .map(([theme]) => theme);
}

/**
 * Sleep utility for retry backoff
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Call OpenAI API (or compatible provider) with retry logic
 */
async function callOpenAI(
  messages: OpenAIMessage[],
  model: string = "gpt-5.1",
  options: { temperature?: number; maxRetries?: number } = {}
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  const apiBase = process.env.OPENAI_API_BASE || "https://api.openai.com/v1";
  const maxRetries = options.maxRetries ?? 3;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY not configured");
  }

  let lastError: Error | null = null;

  // GPT-5 and newer models use different parameters
  const useNewParams = model.startsWith("gpt-5") || model.startsWith("gpt-4.1");

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const requestBody: any = {
        model,
        messages,
        response_format: { type: "json_object" },
      };

      // GPT-5/4.1 only support default temperature (1) and don't support penalty parameters
      if (!useNewParams) {
        const temperature = options.temperature ?? 0.75 + Math.random() * 0.2;
        requestBody.temperature = temperature;
        requestBody.presence_penalty = 0.3; // Discourage repetition
        requestBody.frequency_penalty = 0.2; // Penalize repeated phrases
      }

      // Use correct token parameter based on model
      if (useNewParams) {
        requestBody.max_completion_tokens = 3000; // Ensure complete JSON responses
      } else {
        requestBody.max_tokens = 2000;
      }

      const response = await fetch(`${apiBase}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const error = await response.text();

        // Rate limit - wait and retry
        if (response.status === 429) {
          const waitTime = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
          console.log(`Rate limited, waiting ${waitTime}ms before retry ${attempt + 1}`);
          await sleep(waitTime);
          continue;
        }

        // Server error - retry with backoff
        if (response.status >= 500) {
          const waitTime = Math.pow(2, attempt) * 500;
          console.log(
            `Server error ${response.status}, waiting ${waitTime}ms before retry ${attempt + 1}`
          );
          await sleep(waitTime);
          lastError = new Error(`OpenAI API error: ${response.status} - ${error}`);
          continue;
        }

        throw new Error(`OpenAI API error: ${response.status} - ${error}`);
      }

      const data: OpenAIResponse = await response.json();
      const content = data.choices[0]?.message?.content;
      const finishReason = data.choices[0]?.finish_reason;

      // Log token usage and completion status
      if (data.usage) {
        console.log(
          `AI tokens used: ${data.usage.total_tokens} (prompt: ${data.usage.prompt_tokens}, completion: ${data.usage.completion_tokens}), finish: ${finishReason}`
        );
      }

      // Warn if response was truncated
      if (finishReason === "length") {
        console.warn("Response truncated due to token limit!");
      }

      if (!content) {
        console.error("Empty response from OpenAI:", data);
        throw new Error("OpenAI returned empty response");
      }

      return content;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxRetries - 1) {
        const waitTime = Math.pow(2, attempt) * 500;
        console.log(`Attempt ${attempt + 1} failed, retrying in ${waitTime}ms...`);
        await sleep(waitTime);
      }
    }
  }

  throw lastError || new Error("Failed after all retries");
}

// Forbidden modern terms that break xianxia immersion
const FORBIDDEN_MODERN_TERMS = [
  "hệ thống",
  "chỉ số",
  "level",
  "game",
  "điểm",
  "cấp độ",
  "bảng",
  "system",
  "points",
  "stats",
  "upgrade",
];

/**
 * Check narrative for modern terms that break immersion
 */
function checkForbiddenTerms(narrative: string, locale: Locale): void {
  const lowerNarrative = narrative.toLowerCase();
  for (const term of FORBIDDEN_MODERN_TERMS) {
    if (lowerNarrative.includes(term)) {
      console.warn(`⚠️ Modern term detected in narrative: "${term}"`);
    }
  }
}

/**
 * Generate AI turn result with anti-repetition
 */
export async function generateAITurn(
  state: GameState,
  recentNarratives: string[],
  sceneContext: string,
  choiceId: string | null,
  locale: Locale,
  choiceText?: string | null
): Promise<AITurnResult> {
  const systemPrompt = buildSystemPrompt(locale);
  const gameContext = buildGameContext(state, recentNarratives, locale);
  const userMessage = buildUserMessage(sceneContext, choiceId, locale, choiceText);

  // Anti-repetition: Get themes to avoid
  const themesToAvoid = getThemesToAvoid(recentNarratives);
  const varietyHint = buildVarietyEnforcement(themesToAvoid, recentNarratives.length, locale);

  const messages: OpenAIMessage[] = [
    { role: "system", content: systemPrompt },
    {
      role: "user",
      content: `${gameContext}\n\n${varietyHint}\n\n${userMessage}`,
    },
  ];

  const model = process.env.AI_MODEL || "gpt-5.1";

  // Retry loop for JSON validation failures
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const responseText = await callOpenAI(messages, model, {
        // Higher temperature for more variety after many turns
        temperature: Math.min(0.95, 0.75 + state.turn_count * 0.01),
      });

      // Debug: Log the response length and preview
      console.log(
        `AI Response: ${responseText.length} chars, preview:`,
        responseText.substring(0, 200)
      );

      if (!responseText || responseText.trim().length === 0) {
        throw new Error("AI returned empty response");
      }

      // Parse JSON with better error handling
      let jsonData: any;
      try {
        jsonData = JSON.parse(responseText);
      } catch (parseErr) {
        throw new Error(
          `Invalid JSON from AI: ${parseErr instanceof Error ? parseErr.message : "Parse error"}`
        );
      }

      const validated = validateAIResponse(jsonData);

      // Check for forbidden modern terms
      checkForbiddenTerms(validated.narrative, locale);

      // Post-validation: Check for excessive similarity
      if (recentNarratives.length > 0) {
        const similarity = calculateSimilarity(
          validated.narrative,
          recentNarratives[recentNarratives.length - 1]
        );
        if (similarity > 0.7) {
          console.warn(
            `High narrative similarity detected (${similarity.toFixed(2)}), response may be repetitive`
          );
        }
      }

      return validated;
    } catch (error) {
      // Retry on first attempt, throw on second
      if (attempt === 1) {
        console.error("AI generation error (final attempt):", error);
        throw new Error(
          `Failed to generate AI response: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
      console.warn("Retrying due to invalid AI output...", error);
    }
  }

  throw new Error("Failed to generate AI response after retries");
}

/**
 * Simple similarity check using word overlap (Jaccard similarity)
 */
function calculateSimilarity(text1: string, text2: string): number {
  const words1 = new Set(
    text1
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3)
  );
  const words2 = new Set(
    text2
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3)
  );

  const intersection = new Set([...words1].filter((w) => words2.has(w)));
  const union = new Set([...words1, ...words2]);

  return union.size > 0 ? intersection.size / union.size : 0;
}

/**
 * Fallback AI response for when API fails
 */
export function getFallbackResponse(state: GameState, locale: Locale): AITurnResult {
  if (locale === "vi") {
    return {
      locale: "vi",
      narrative:
        "Bạn đang ở trong một khu rừng yên tĩnh. Không có gì đặc biệt xảy ra. Có lẽ bạn nên nghỉ ngơi hoặc tiếp tục hành trình.",
      choices: [
        { id: "rest", text: "Nghỉ ngơi", cost: { time_segments: 1 } },
        { id: "continue", text: "Tiếp tục" },
      ],
      proposed_deltas: [{ field: "stats.stamina", operation: "add", value: 1 }],
      events: [],
    };
  } else {
    return {
      locale: "en",
      narrative:
        "You are in a quiet forest. Nothing special happens. Perhaps you should rest or continue your journey.",
      choices: [
        { id: "rest", text: "Rest", cost: { time_segments: 1 } },
        { id: "continue", text: "Continue" },
      ],
      proposed_deltas: [{ field: "stats.stamina", operation: "add", value: 1 }],
      events: [],
    };
  }
}
