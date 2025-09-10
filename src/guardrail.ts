/**
 * src/guardrail.ts
 * ----------------------------------------------------------------------------
 * Lightweight output moderation for debate turns.
 * Strategy:
 *  1) Fast local regex screen for disallowed content (slurs, NSFW, doxxing).
 *  2) If flagged AND CLAUDE_SAFETY=on, ask Claude to gently rewrite.
 *  3) Otherwise, return a redacted fallback line to keep the debate moving.
 *
 * Keep lists tight and youth-friendly. Expand as needed.
 */

import { config } from './config.js';
import { generateClaudeTurn } from './anthropicClient.js';

const BAD_WORDS = [
  // Minimal illustrative set; expand as needed.
  // NOTE: intentionally not including specific slurs in this public snippet.
  /\bkill yourself\b/i,
  /\bsuicide\b/i,
  /\bnsfw\b/i,
  /\bexplicit\b/i,
  /\bgraphic\b/i,
  /\b(dox|doxx)\w*/i
];

const MAX_LEN = 1200; // extra hard cap

export type GuardrailResult =
  | { ok: true; text: string }
  | { ok: false; text: string; reason: string };

export function fastScreen(text: string): GuardrailResult {
  if (!text || typeof text !== 'string') {
    return { ok: false, text: '…', reason: 'empty' };
  }
  if (text.length > MAX_LEN) {
    return { ok: false, text: text.slice(0, MAX_LEN), reason: 'too_long' };
  }
  for (const rx of BAD_WORDS) {
    if (rx.test(text)) {
      return { ok: false, text, reason: 'disallowed_term' };
    }
  }
  return { ok: true, text };
}

/**
 * Optionally ask Claude to rewrite unsafe content into a PG-13, friendly version.
 * Toggle with env CLAUDE_SAFETY=on (see config usage below).
 */
export async function maybeRewriteUnsafe(original: string, reason: string): Promise<string> {
  // Only escalate if feature is enabled
  if (process.env.CLAUDE_SAFETY !== 'on') {
    return '(Content adjusted to keep things PG-13. Let’s keep it friendly.)';
  }

  const systemPrompt = [
    'You are a content safety editor.',
    'Task: Rewrite the provided reply to be PG-13 and friendly without changing the core intent.',
    'No insults, harassment, or graphic content. Keep it concise and upbeat.'
  ].join('\n');

  const userPrompt = `Reason flagged: ${reason}\n\nOriginal reply:\n"""${original}"""\n\nRewrite now:`;

  const rewritten = await generateClaudeTurn({
    systemPrompt,
    userPrompt,
    maxTokens: Math.min(config.MAX_TOKENS_PER_TURN, 180),
    temperature: 0.2
  });

  // Fallback if empty
  return rewritten.trim() || '(Content adjusted to keep things PG-13. Let’s keep it friendly.)';
}

/** Enforce guardrail with optional rewrite */
export async function enforceGuardrail(text: string): Promise<string> {
  const screen = fastScreen(text);
  if (screen.ok) return screen.text;

  // Try to salvage with a rewrite if enabled
  return await maybeRewriteUnsafe(screen.text, screen.reason);
}
