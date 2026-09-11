# CCA-F Exam Prep Guide

A focused, current playbook for passing the **Claude Certified Architect - Foundations (CCA-F)** exam, built to be used alongside this app.

> ⚠️ **Provisional logistics.** The official Anthropic exam guide is gated behind the Skilljar / Claude Partner Network portal. The specific numbers below (720 cut, 60Q/120min, scaled 100-1000, $99 fee, 6-scenario pool, ProctorFree delivery, ~6-month expiry) come from consistently-agreeing **third-party** breakdowns. Treat them as provisional and **verify against the official Skilljar exam guide before exam day.** Domain names/weights are well corroborated.

---

## 1. The exam at a glance

- **What it is:** Anthropic's first official technical certification (launched 2026-03-12). A **301-level, 100% scenario-based architecture exam** for seasoned builders, *not* a course-completion badge. You play the architect on each scenario.
- **Format:** 60 multiple-choice questions · 120 minutes · 1 correct + 3 distractors each · **closed-book** (no AI, no docs, no notes, no second monitor/tabs).
- **Scoring:** scaled **100-1000, pass = 720** (equated across forms, *not* a raw percentage). Score report in ~2 business days.
- **Logistics:** ~USD $99 ($0 for the first 5,000 Claude Partner Network employees); online-proctored (ProctorFree) or test center; credential reported to **expire after ~6 months**.
- **Scenario pool (6; 4 served per sitting: study all six):** Customer Support Resolution Agent · Code Generation with Claude Code · Multi-Agent Research System · Developer Productivity with Claude · Claude Code for CI/CD · Structured Data Extraction.
- **Audience:** architects/devs with **6+ months hands-on** on the Claude API, Agent SDK, Claude Code, and MCP. It rewards builders, not doc-skimmers.

### Domain weights

| Domain | Weight |
|---|---|
| D1: Agentic Architecture & Orchestration | **27%** |
| D3: Claude Code Configuration & Workflows | 20% |
| D4: Prompt Engineering & Structured Output | 20% |
| D2: Tool Design & MCP Integration | 18% |
| D5: Context Management & Reliability | 15% |

Agentic + Claude Code + Tools/MCP = **65%** of the exam: weight your prep accordingly.

---

## 2. Your readiness plan (with this app)

A 4-6+ week loop. The app's modes are the engine: **Study briefs → Adaptive Practice (honest confidence) → SM-2 Review → Mock Exams → dashboard-driven targeting.**

- **Week 0 (baseline):** Take **one full 60Q/120min Mock Exam cold**, before studying. Read the Readiness dashboard: pass-probability, per-domain mastery, and any *confident-but-wrong* danger-zone flags. This is your honest starting line.
- **Week 1: D1 Agentic (27%, study first):** Study briefs + Academy "Introduction to Subagents" / "Building with the Claude API". Adaptive Practice D1 with **honest confidence rating on every item** (guessing "confident" poisons danger-zone detection). Read the explanation on every item, right or wrong. Ship a small coordinator + 1-2 subagent loop by hand.
- **Week 2: D3 Claude Code (20%) + D2 Tools/MCP (18%):** Pair briefs with "Claude Code in Action" + "Introduction to MCP". Build a real CLAUDE.md hierarchy with a **PreToolUse hook (exit 2)** and one MCP server whose tool descriptions you test for selection accuracy. Start clearing the **SM-2 Review queue first thing each session**.
- **Week 3: D4 Prompt/Structured Output (20%) + D5 Context/Reliability (15%):** Build an extraction pipeline with `output_config.format` + a JSON schema, nullable fields, and a validation-retry loop. **Drill the current-fact gotchas (§5)** until each stale-vs-current pair is automatic.
- **Week 4: integrate:** Mock Exam #1 under a real clock with full multi-pass discipline. In review, study the **wrong-answer explanation on every miss**. Attack the lowest-mastery domain *and* any danger-zone domain. Use the AI Tutor at Architect level on anything that still bites.
- **Week 5+: close the gate:** Alternate Mocks with dashboard-targeting until the in-app **exam-ready gate is green** and a fresh mock clears the cut with room to spare. (Passers report not feeling ready until practice scores hit ~820+.)

---

## 3. When are you ready? (the gate)

Use the app's **exam-ready gate** as the single go/no-go signal. It requires **all** of:

1. **≥ 2 recent Mock Exams ≥ 760** (a deliberate cushion above the real 720: mock difficulty and nerves erode the margin),
2. **blended Readiness ≥ 740**, and
3. **every domain mastery ≥ 65** (no domain left behind: you can't predict which 4 scenarios appear).

Soft gate: drive the **confident-but-wrong danger-zone count toward zero**: a confident-but-wrong domain means you won't flag your own errors on exam day. *Practical "ready" = gate green + danger-zone empty + latest mock comfortably above the cut with all domains green.*

> These thresholds are the app's conservative study target, intentionally above the real 720 cut, not official passing criteria.

---

## 4. Time & test-taking strategy

- **Pace to a buffer, not the mean.** 120s/question average → target **~90s on Pass 1** to bank a 25-30 min review reserve. Checkpoints: **Q15 @ ~25m · Q30 @ ~50m · Q45 @ ~75m · Q60 @ ~95-100m**, leaving 20-25 min for flagged review. Behind a checkpoint? Flag harder: don't raid the reserve.
- **Multi-pass.** Pass 1: answer **every** question; if the approach isn't clear in ~30s, pick your best guess, **flag**, move on. Pass 2: revisit **only flagged** items.
- **Guessing (the key scoring fact):** no wrong-answer penalty → a blank scores the same as a wrong answer (0), a guess has ~25% EV. **Select-then-flag, never flag-while-blank.** Reserve the last 60-90s to sweep for accidental blanks.
- **Scaled score ≠ percentage.** 720 is *not* "72% correct" (scores are equated). So: fight for every item, hard-looking items aren't worth more points (don't over-invest in one gnarly scenario at the cost of three easy ones), and there's no partial credit. **Bank the easy points first.**
- **Change-answer discipline.** Change a Pass-1 answer **only** for a concrete, articulable reason (misread a qualifier, missed a stated constraint, sequencing error). "I have a specific reason X" = change; "feels wrong now" = leave it. Rehearse all of this under the app's 120-min Mock simulator so it's automatic.

---

## 5. Current-fact gotchas (the highest-leverage section)

Distractors are built from **stale knowledge that was correct on pre-2026 models/SDKs**. Treat any option matching old muscle memory as a *suspect to verify*, not a default.

1. **Prefill is REMOVED** on the 4.6+ family (Opus 4.6/4.7/4.8, Sonnet 4.6, Fable 5): a trailing assistant message returns **HTTP 400**. Replacements: structured output → `output_config.format`; behavioral steering → system-prompt instructions; multi-agent handoff → synthesize the task as a fresh **user** message. *The single most-exploited trap.*
2. **Context windows are NOT a universal 200K.** Opus 4.6/4.7/4.8, Sonnet 4.6, Fable 5 = **1M**; **only Haiku 4.5 = 200K**. Reject blanket "200K" *unless the scenario names Haiku 4.5*. Read which model is named.
3. **Structured output = `output_config.format`** (`output_config:{format:{…}}`, or `messages.parse()`); the top-level `output_format` param is **deprecated**. Sub-traps: citations + `output_config.format` = 400 (incompatible); use **nullable** fields (not optional) for extraction.
4. **Adaptive thinking on 4.6+:** `thinking:{type:"adaptive"}` + **`output_config.effort`** (low|medium|high|xhigh|max). `budget_tokens` is deprecated on 4.6 and **removed (400) on Opus 4.7/4.8 + Fable 5** (along with temperature/top_p/top_k). Effort lives *inside* `output_config`.
5. **`stop_reason`, never text-parse for completion.** Full set: `end_turn, max_tokens, stop_sequence, tool_use, pause_turn, refusal, model_context_window_exceeded`. **`refusal` is HTTP 200** (a success): check it *before* reading `content[0]`. **`pause_turn` resumes by re-sending** (not by appending "Continue").
6. **`tool_choice` = `auto | any | tool | none`** (+ optional `disable_parallel_tool_use`). Reject invented values like "required"/"force".
7. **MCP transports = stdio + Streamable HTTP** (legacy SSE for back-compat only). **WebSocket is NOT an MCP transport**, always a distractor.
8. **Bare model ids:** `claude-opus-4-8`, `claude-sonnet-4-6`, `claude-haiku-4-5`, `claude-fable-5`. A date-suffixed id is a 404, reject it.
9. **CLAUDE.md is injected context, not enforced config**: it guides, it doesn't gate. For any "guarantee/enforce/always" scenario the answer is a **hook (exit 2)**, not a CLAUDE.md line.
10. **Fable 5 (if it appears):** thinking always on (omit the param; explicit `{type:"disabled"}` = 400); ~30% more tokens; requires ≥30-day data retention.

---

## 6. Per-domain high-yield + common mistakes

### D1: Agentic Architecture & Orchestration (27%, heaviest)
**High-yield:** the 4-question agent **gate** (Complexity, Value, Viability, Cost-of-error all "yes" → agent; else single-call/workflow) · three tiers (single call → workflow *you* orchestrate → agent the *model* orchestrates; "start simple") · manual loop mechanics (loop until `stop_reason=="end_turn"`, **append the full `response.content`**, match `tool_use_id`) · context trio: **editing prunes, compaction summarizes, memory persists** · coordinator/hub-and-spoke + Task tool + escalation/error-propagation · Managed Agents (create once, reference by ID; first-party API + AWS only).
**Common mistakes:** building an agent when a workflow/call suffices · confusing context-editing (prune) with compaction (summarize) · extracting only text instead of full `response.content` · calling a code-orchestrated pipeline an "agent" · injecting "Continue." on `pause_turn` · returning empty results on subagent failure (return *structured error context*).

### D3: Claude Code Configuration & Workflows (20%)
**High-yield:** **hooks are deterministic enforcement** (exit **2 blocks** and feeds stderr back; **exit 1 does NOT block**) · settings precedence enterprise > project > user > local > plugin, hooks **merge and all run** · pair a PreToolUse hook (dynamic/Bash) with a permission deny rule (file tools) · CI/CD via `-p/--print` + `--output-format json` · subagents (separate context) vs skills (on-demand SKILL.md) vs hooks (lifecycle).
**Common mistakes:** thinking CLAUDE.md *enforces* (for "always/guarantee" → hook) · expecting exit 1 to block · thinking hooks use model judgment · assuming higher layers overwrite (they merge) · raw bash for destructive actions instead of a gated tool.

### D4: Prompt Engineering & Structured Output (20%)
**High-yield:** technique ladder (clear&direct → multishot → CoT → XML tags → role/system → chaining → long-context) · XML tags `<instructions>/<data>/<examples>` · 3-5 diverse multishot examples · **long-context ordering: 20K+ docs at TOP, query at BOTTOM** · system = role/safety (can't be user-overridden) · `output_config.format` + `additionalProperties:false` + **nullable** fields.
**Common mistakes:** recommending **prefill** (removed → 400) · using deprecated `output_format` · over-prescribing step-by-step on thinking models · instructions before long context · forgetting structured-output limits (no recursive schemas; citations+format=400) · CoT on trivial lookups.

### D2: Tool Design & MCP Integration (18%)
**High-yield:** `tool_choice` = auto|any|tool|none (+ `disable_parallel_tool_use`) · tool = name+description+input_schema, **prescriptive descriptions drive selection** · transports stdio + Streamable HTTP (SSE legacy; **no WebSocket**) · server tools run on Anthropic infra vs client tools your harness executes (code execution is **sandboxed, no internet**) · `.mcp.json` (project/VCS) vs `~/.claude.json` (user) · structured errors (`is_error`, retryable, category).
**Common mistakes:** listing WebSocket as a transport (or SSE as current) · confusing/inventing `tool_choice` values · thinking tool-search *swaps* schemas (it *appends*) · raw string-matching tool input JSON · over-stuffing the tool set (4-5, not 18) · assuming code execution has network.

### D5: Context Management & Reliability (15%)
**High-yield:** windows are 1M (Opus/Sonnet/Fable), 200K **only** Haiku 4.5 · full `stop_reason` set; never text-parse · **`refusal` is HTTP 200**: check before reading `content[0]`; retry on a *different* model · `model_context_window_exceeded` + graceful-degradation fallbacks · "lost in the middle" → positioning/focused passes, not a bigger window · summaries must **preserve** goals/constraints/decisions, not just shorten.
**Common mistakes:** assuming universal 200K · reading `content[0]` before checking `stop_reason` · treating `refusal` as an HTTP error · thinking a bigger window fixes attention dilution · `budget_tokens` on 4.7/4.8/Fable (400) · date-suffixed model ids (404).

---

## 7. Scenario-reading & distractor traps

- **Read the full stem before the options.** Scenarios embed disqualifying constraints: a named model/family, a transport, an error code, a deployment target (Bedrock/Vertex), "must be enforced", "Haiku 4.5", "zero-data-retention". A technically-correct action that **violates a stated constraint** is a distractor.
- **The layer question is the exam:** *"which layer owns this problem?"* Must **always** hold (compliance/ordering/gating) → programmatic enforcement (hooks exit 2, schema validation, structured errors), never a prompt line. Intermittent/behavioral (wrong tool picked) → descriptions/few-shot, not more code.
- **Eliminate-first** beats recognize-first. Cross out clearly-wrong options (usually stale-knowledge), then choose among survivors.
- **Single best answer:** two options can both be "true": pick the one the constraints make best/first/required. Watch **sequencing** traps (right action, wrong order) and **scope** traps (solves a different/bigger problem).
- **Reject on sight:** few-shot to enforce *ordering* (use programmatic prerequisites) · routing escalation on the LLM's *self-reported confidence* (route on explicit policy gaps) · "send everything to Batch API to save cost" (Batch = no SLA, 24h, latency-tolerant only) · "bigger window fixes attention dilution" · "return empty on subagent failure" · "give every agent all tools".
- **Don't convert the scaled score to a percentage**, and **change an answer only for an articulable reason.**

---

## 8. Exam-day checklist

- [ ] Confirm this form allows **free flag-and-return** across all 60 items (the multi-pass plan depends on it).
- [ ] Verify proctoring the day before: ProctorFree/test-center requirements, ID, webcam/room scan, stable internet, single monitor, clear desk.
- [ ] Walk the tutorial/intro screen to learn the **flag + review-list UI** before the clock starts.
- [ ] Internalize the pacing checkpoints (Q15/Q30/Q45/Q60).
- [ ] Do an **easy-points pass first** to bank the floor.
- [ ] **Select-then-flag** every uncertain item, never leave a blank; sweep for accidental blanks in the last 60-90s.
- [ ] Keep the **anti-stale reflexes** loaded: prefill→400; windows 1M except Haiku 200K; `output_config.format`/`.effort` not `output_format`/`budget_tokens`; MCP = stdio + Streamable HTTP (no WebSocket); hooks (exit 2) enforce, CLAUDE.md informs.
- [ ] Hunt the **load-bearing constraint** in every stem before reading options.
- [ ] Ask **"which layer owns this?"** on hard scenarios.
- [ ] Change a Pass-1 answer only for a specific articulable reason.
- [ ] Bring valid ID; confirm fee status; note the ~6-month expiry.

---

## 9. Mindset

This is a **builder's exam**, not a trivia test: it rewards people who've actually shipped agentic loops, subagents, hooks, MCP servers, and extraction pipelines. Passive doc-reading underperforms; the app's scenario practice + honest confidence rating turn knowledge into reflexes. Make the passer's mental shift: stop asking *"what's the correct answer?"* and start asking *"why is this the correct **layer** to solve **this** scenario?"* Let the dashboard, not your gut, decide where to spend remaining hours, especially the **confident-but-wrong** danger zone. Trust your first read, fight for every question, and **book only once the gate is green** and a fresh mock clears the cut with room to spare.

---

## Sources & caveats

Only `anthropic.skilljar.com` (Academy / learning path) and `anthropic.com/news/claude-partner-network` are official Anthropic sources. The specific logistics here come from consistently-agreeing **third-party** breakdowns and are **provisional: verify against the official Skilljar exam guide.** The exam-ready thresholds (760 mock / 740 readiness / 65 per-domain) are this app's conservative gate, set above the real 720 cut to absorb variance: a study target, not official criteria. Avoid third-party "exam dump" question banks as primary prep (often stale, may violate cert terms); prefer the official Anthropic Academy materials. Model-behavior facts above are grounded in the current Anthropic documentation as of mid-2026.
