/**
 * src/app.ts
 * ----------------------------------------------------------------------------
 * Express application (no .listen here). This makes the API testable via
 * Supertest without opening a port. Keep server.ts for prod/dev startup.
 */
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';

import { config } from './config.js';
import { logger } from './logger.js';
import {
  insertDebate,
  getDebate,
  listTurns,
  insertTurn,
  insertVote,
  setDebateStatus
} from './db.js';
import {
  personaFor,
  systemPrompt,
  userPrompt,
  nextSideAndRole,
  estimateTokens
} from './debateEngine.js';
import { generateClaudeTurn } from './anthropicClient.js';
import type { StyleTag } from './types.js';
import { enforceGuardrail } from './guardrail.js';

export const app = express();

app.use(cors());
app.use(express.json({ limit: '1mb' }));

// basic rate-limit to protect Claude & DB in MVP
const limiter = rateLimit({ windowMs: 15 * 1000, max: 20 });
app.use('/api/', limiter);

app.get('/health', (_req, res) => res.json({ ok: true }));

// --- Create debate ---
const CreateDebateBody = z.object({
  topic: z.string().min(3).max(200),
  style_tag: z.enum(['witty', 'academic', 'chaotic']).default(config.DEFAULT_STYLE),
  rounds: z.union([z.literal(3), z.literal(5)]).default(3)
});

app.post('/api/debates', async (req, res) => {
  try {
    const body = CreateDebateBody.parse(req.body);
    if (body.rounds !== 3) {
      // MVP only supports the 3-round cadence we encoded.
      return res.status(400).json({ error: 'MVP supports rounds=3 only for now.' });
    }
    const debate = insertDebate({
      topic: body.topic,
      style_tag: body.style_tag,
      rounds: body.rounds,
      status: 'live'
    });
    res.json({ debate });
  } catch (e: any) {
    logger.error(e, 'create debate failed');
    res.status(400).json({ error: e.message || 'invalid request' });
  }
});

// --- Advance a debate one step (Claude generates) ---
app.post('/api/debates/:id/step', async (req, res) => {
  const id = req.params.id;
  const debate = getDebate(id);
  if (!debate) return res.status(404).json({ error: 'not found' });

  const turns = listTurns(id);
  const next = nextSideAndRole({ rounds: debate.rounds, turns });
  if (!next) {
    // No more steps; mark finished
    setDebateStatus(id, 'finished');
    return res.json({ status: 'finished', debate, turns });
  }

  // Build prompts
  const persona = personaFor(debate.style_tag as StyleTag, next.side);
  const sys = systemPrompt({
    topic: debate.topic,
    persona,
    style: debate.style_tag as StyleTag,
    roundName: roleToRoundName(next.role)
  });

  const oppLast = lastOpponentText(turns, next.side) || '(no prior context)';
  const user = userPrompt({
    oppLast,
    roundName: roleToRoundName(next.role)
  });

  try {
    let text = await generateClaudeTurn({ systemPrompt: sys, userPrompt: user });
    text = await enforceGuardrail(text);

    const t = insertTurn({
      debate_id: id,
      round_no: next.roundNo,
      side: next.side,
      role: next.role,
      content: text,
      tokens: estimateTokens(text)
    });

    // If this was the final step in our cadence, flip status
    const nowTurns = listTurns(id);
    if (!nextSideAndRole({ rounds: debate.rounds, turns: nowTurns })) {
      setDebateStatus(id, 'finished');
    }

    res.json({ turn: t, debate: getDebate(id), turns: nowTurns });
  } catch (e: any) {
    logger.error(e, 'step generation failed');
    res.status(500).json({ error: 'generation failed' });
  }
});

// --- Get debate state ---
app.get('/api/debates/:id', (req, res) => {
  const id = req.params.id;
  const debate = getDebate(id);
  if (!debate) return res.status(404).json({ error: 'not found' });

  const turns = listTurns(id);
  res.json({ debate, turns, votes: { A: 0, B: 0 } });
});

// --- Record a vote ---
const VoteBody = z.object({
  debate_id: z.string().min(10),
  winner: z.enum(['A', 'B']),
  fingerprint: z.string().min(6).max(64)
});

app.post('/api/votes', (req, res) => {
  try {
    const body = VoteBody.parse(req.body);
    const v = insertVote(body);
    res.json({ vote: v });
  } catch (e: any) {
    return res.status(400).json({ error: e.message || 'invalid vote' });
  }
});

// ---- helpers (module-local) ----
function roleToRoundName(role: string): string {
  switch (role) {
    case 'opening': return 'opening';
    case 'rebuttal': return 'rebuttal';
    case 'crossq': return 'cross-examination-question';
    case 'crossa': return 'cross-examination-answer';
    case 'closing': return 'closing';
    default: return 'opening';
  }
}

function lastOpponentText(turns: ReturnType<typeof listTurns>, nextSide: 'A' | 'B'): string | null {
  const opp = nextSide === 'A' ? 'B' : 'A';
  for (let i = turns.length - 1; i >= 0; i--) {
    if (turns[i].side === opp) return turns[i].content;
  }
  return null;
}
