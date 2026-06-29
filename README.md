# CCA-F Trainer

An evidence-based study app to **prepare for and pass the Claude Certified Architect — Foundations (CCA-F)** exam — Anthropic's first official technical credential.

It combines four study modes the learning-science literature ranks highest, wrapped around the real exam blueprint:

- **Study briefs** — concise, exam-focused lessons for each of the 5 domains, grounded in the real Claude API, Agent SDK, Claude Code, and MCP.
- **Adaptive practice** — interleaved, level-aware retrieval practice with per-question **confidence rating** and instant explanations.
- **Mock-exam simulator** — a full 60-question, 120-minute, blueprint-weighted exam with a navigator, flagging, scaled scoring (100–1000, pass ≥ 720), and post-exam review.
- **Spaced repetition** — an SM-2 scheduler that resurfaces missed questions and flashcards right before you'd forget them.
- **AI tutor** — a Claude-powered tutor that explains any question or concept **at your level** (Newcomer / Practitioner / Architect).

A **readiness dashboard** ties it together: it diagnoses per-domain mastery, detects "confident-but-wrong" danger zones, blends your mastery with recent mock scores into a pass-probability, and **prescribes** what to study next.

## The exam (blueprint this app targets)

| Domain | Weight |
|---|---|
| Agentic Architecture & Orchestration | 27% |
| Claude Code Configuration & Workflows | 20% |
| Prompt Engineering & Structured Output | 20% |
| Tool Design & MCP Integration | 18% |
| Context Management & Reliability | 15% |

60 scenario-based multiple-choice questions · 120 minutes · closed-book · scaled 100–1000 · **pass at 720**. The exam draws from six scenarios: Customer Support Agent, Code Generation with Claude Code, Multi-Agent Research, Developer Productivity, Claude Code for CI/CD, and Structured Data Extraction.

## Pedagogy baked in

| Technique (evidence-ranked) | Where it lives |
|---|---|
| Retrieval practice / testing effect | Practice & exam are active recall, not re-reading |
| Spaced repetition (distributed practice) | SM-2 scheduler in Review |
| Interleaving | "Adaptive mix" rotates domains instead of blocking |
| Elaborative interrogation / self-explanation | Per-question explanations + "Explain at my level" tutor |
| Confidence-based assessment | Confidence rating per question; danger-zone detection |
| Diagnose → Prescribe → Learn → Iterate | Readiness dashboard prescribes next actions |
| Readiness scoring with a consistency gate | Pass-probability + "exam-ready" only after repeated strong mocks |

## Run it

```bash
npm install
npm run dev      # http://localhost:3000
```

Build for production / deploy (Vercel-ready):

```bash
npm run build && npm start
```

All progress is stored locally in your browser (`localStorage`) — no account, no backend database.

## Enabling the AI tutor (optional)

The tutor calls the Claude API. Create a file named `.env.local` in the project root:

```
ANTHROPIC_API_KEY=sk-ant-your-key
# optional override (defaults to a fast, cheap Claude model)
TUTOR_MODEL=claude-haiku-4-5-20251001
```

On the developer machine it will also fall back to `~/.anthropic_api_key` if no env var is set. Without a key, every other feature still works — the tutor simply shows a friendly notice and the written explanations remain available.

## Project layout

```
app/            Next.js App Router pages (dashboard, study, practice, exam, review, stats, tutor)
app/api/tutor/  Claude-powered tutor route handler
components/      UI: QuestionCard, PracticeSession, ExplainPanel, Nav, charts
lib/            Domain model, readiness engine, SM-2, adaptive selection, exam scoring
data/           Verified question bank (131 Qs), flashcards (50), lessons (5)
```

## Content provenance

The question bank, flashcards, and lessons were authored and then **adversarially verified** against the real, documented behavior of Anthropic's tooling (Claude API, Agent SDK, Claude Code, MCP). This is an independent study aid and is **not affiliated with, endorsed by, or sponsored by Anthropic**. Always cross-check exam logistics against Anthropic's official exam guide.
