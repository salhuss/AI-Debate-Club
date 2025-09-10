/**
 * tests/server.test.ts
 * ----------------------------------------------------------------------------
 * Supertest API tests. We mock the anthropic client to avoid network calls.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import request from 'supertest';

// Mock anthropic call to return a deterministic string
vi.mock('../src/anthropicClient.js', () => ({
  generateClaudeTurn: vi.fn(async () => 'Mocked debate turn ✅')
}));

import { app } from '../src/app.js';

describe('API', () => {
  it('health returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('create debate, step once, fetch state', async () => {
    // create
    const create = await request(app)
      .post('/api/debates')
      .send({ topic: 'Pineapple on pizza?', style_tag: 'witty', rounds: 3 });
    expect(create.status).toBe(200);
    const debateId = create.body.debate.id as string;
    expect(debateId).toBeTruthy();

    // step
    const step = await request(app).post(`/api/debates/${debateId}/step`);
    expect(step.status).toBe(200);
    expect(step.body.turn.content).toContain('Mocked debate turn');

    // get
    const get = await request(app).get(`/api/debates/${debateId}`);
    expect(get.status).toBe(200);
    expect(Array.isArray(get.body.turns)).toBe(true);
    expect(get.body.turns.length).toBe(1);
  });
});
