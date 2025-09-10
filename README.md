# 🎭 AI Debate Club (Backend MVP)

**AI Debate Club** is a fun experiment where two AI personas (powered by Anthropic Claude) debate on silly or serious topics — like *“Should pineapple go on pizza?”*.  
This repo contains the **backend MVP**, built with TypeScript + Express + SQLite.

---

## ✨ Features (MVP)

- **Create debates** with a topic, style (witty, academic, chaotic), and round count (3 for now).
- **Advance debates** turn by turn — Claude generates each persona’s responses using tailored system prompts.
- **Store debate state** (debates, turns, votes) in SQLite.
- **Vote system**: record votes for A or B (basic version).
- **Guardrails**: regex + optional Claude rewrite to keep content PG-13 and safe.
- **Structured logs** with Pino.
- **Type-safe config** via Zod.
- **Tests** with Vitest + Supertest:
  - Unit tests for planning logic and guardrails
  - Integration tests for API routes (Claude mocked)

---

## 📂 Project Structure
src/
app.ts              # Express app (for testing)
server.ts           # Entrypoint (listens on PORT)
config.ts           # Env validation
logger.ts           # Pino logger
types.ts            # Domain models (debate, turn, vote)
db.ts               # SQLite persistence layer
debateEngine.ts     # Debate planning + persona + prompts
anthropicClient.ts  # Thin Claude wrapper
guardrail.ts        # PG-13 output filter / rewrite
tests/
debateEngine.test.ts
guardrail.test.ts
server.test.ts

2. Configure environment

Copy .env.example to .env and set your Anthropic API key:
ANTHROPIC_API_KEY=sk-ant-xxxxxxxx
PORT=3001
DEFAULT_STYLE=witty
MAX_TOKENS_PER_TURN=220

# Optional: enable Claude-powered safety rewrites
CLAUDE_SAFETY=off

3. Run dev server
npm run dev

Backend will run on: http://localhost:3001

4. Smoke test (curl)

Create a debate:

curl -X POST http://localhost:3001/api/debates \
  -H "Content-Type: application/json" \
  -d '{"topic":"Should pineapple go on pizza?","style_tag":"witty","rounds":3}'


