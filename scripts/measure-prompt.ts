// Throwaway script: verify buildSystemPrompt is deterministic per locale and
// print rough token footprint (chars/4 heuristic) so we can gauge savings.
// Run with: npx tsx scripts/measure-prompt.ts

import { buildSystemPrompt } from "../src/lib/ai/prompts";

function approxTokens(s: string): number {
  return Math.round(s.length / 4);
}

for (const locale of ["vi", "en"] as const) {
  const a = buildSystemPrompt(locale);
  const b = buildSystemPrompt(locale);
  const identical = a === b;
  console.log(
    `locale=${locale} chars=${a.length} ~tokens=${approxTokens(a)} deterministic=${identical}`
  );
  if (!identical) {
    console.error("❌ Prompt is NOT deterministic — prompt cache will miss.");
    process.exit(1);
  }
}

console.log("✅ System prompt is deterministic per locale — cache-friendly.");
