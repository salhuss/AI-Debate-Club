/**
 * tests/debateEngine.test.ts
 * ----------------------------------------------------------------------------
 * Tests for debate turn planning & token estimate.
 */
import { describe, it, expect } from 'vitest';
import { nextSideAndRole, estimateTokens } from '../src/debateEngine.js';
import type { Turn } from '../src/types.js';

describe('nextSideAndRole (3-round cadence)', () => {
  it('produces expected sequence for first few turns', () => {
    const turns: Turn[] = [];
    const seq = [];
    for (let i = 0; i < 4; i++) {
      const nxt = nextSideAndRole({ rounds: 3, turns });
      if (!nxt) break;
      seq.push(`${nxt.roundNo}-${nxt.side}-${nxt.role}`);
      // push a fake turn to advance sequence
      turns.push({
        id: String(i),
        debate_id: 'd',
        round_no: nxt.roundNo,
        side: nxt.side,
        role: nxt.role,
        content: 'ok',
        tokens: 10,
        created_at: Date.now()
      });
    }
    expect(seq).toEqual([
      '1-A-opening',
      '1-B-opening',
      '2-B-rebuttal',
      '2-A-rebuttal'
    ]);
  });

  it('returns null after plan exhausted', () => {
    const taken: Turn[] = [];
    // consume all 10 planned steps
    for (let i = 0; i < 10; i++) {
      const nxt = nextSideAndRole({ rounds: 3, turns: taken });
      expect(nxt).toBeTruthy();
      taken.push({
        id: String(i),
        debate_id: 'd',
        round_no: nxt!.roundNo,
        side: nxt!.side,
        role: nxt!.role,
        content: 'x',
        tokens: 5,
        created_at: Date.now()
      });
    }
    // now should be null
    expect(nextSideAndRole({ rounds: 3, turns: taken })).toBeNull();
  });
});

describe('estimateTokens', () => {
  it('roughly matches chars/4', () => {
    const s = 'abcd'.repeat(10); // 40 chars
    expect(estimateTokens(s)).toBeGreaterThanOrEqual(10);
    expect(estimateTokens(s)).toBeLessThanOrEqual(11);
  });
});
