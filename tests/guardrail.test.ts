/**
 * tests/guardrail.test.ts
 * ----------------------------------------------------------------------------
 * Tests for guardrail fast screen and enforcement behavior.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fastScreen, enforceGuardrail } from '../src/guardrail.js';

// Ensure safety rewrite is OFF so no network calls happen
beforeEach(() => {
  process.env.CLAUDE_SAFETY = 'off';
});

describe('fastScreen', () => {
  it('passes clean text', () => {
    const r = fastScreen('Hello there, friendly debate!');
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error('unexpected');
    expect(r.text).toContain('friendly');
  });

  it('flags disallowed terms', () => {
    const r = fastScreen('This is NSFW content.');
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error('unexpected');
    expect(r.reason).toBe('disallowed_term');
  });

  it('trims overly long text', () => {
    const long = 'a'.repeat(2000);
    const r = fastScreen(long);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error('unexpected');
    expect(r.reason).toBe('too_long');
    expect(r.text.length).toBe(1200);
  });
});

describe('enforceGuardrail', () => {
  it('returns original for OK text', async () => {
    const out = await enforceGuardrail('All good here.');
    expect(out).toBe('All good here.');
  });

  it('returns neutral line when unsafe and safety rewrite is off', async () => {
    const out = await enforceGuardrail('This looks NSFW to me.');
    expect(out).toMatch(/PG-13/);
  });
});
