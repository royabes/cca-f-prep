// Semantic audit + safe fix of the 5 lessons and 50 flashcards against CURRENT
// documented Anthropic behavior. Lessons are fixed via exact find/replace pairs
// (only stale snippets change); flashcards via field replacement. Each fix is
// re-audited. Dry-run default; --write applies. Run: npx tsx scripts/audit-content.ts [--write]
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import type { Lesson, Flashcard } from "../lib/types";

const MODEL = "claude-opus-4-8";
const CONCURRENCY = 4;
function apiKey(): string {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  const f = resolve(homedir(), ".anthropic_api_key");
  if (existsSync(f)) return readFileSync(f, "utf8").trim();
  throw new Error("no key");
}
const client = new Anthropic({ apiKey: apiKey() });
const root = resolve(import.meta.dirname, "..");

const FACTS = `CURRENT, DOCUMENTED ANTHROPIC FACTS (study content must reflect these):
- Bare model ids only (claude-opus-4-8/4-7/4-6, claude-sonnet-4-6, claude-haiku-4-5, claude-fable-5); date-suffixed ids are wrong.
- Assistant PREFILL is REMOVED on the 4.6+ family (HTTP 400); legacy-only. Steer format via output_config.format (json_schema constrained decoding) or system instructions.
- Context windows: Opus/Sonnet/Fable default 1M; Haiku 4.5 = 200K. NO universal 200K. Overflow => stop_reason model_context_window_exceeded.
- Structured output = output_config:{format:{type:"json_schema"}} (current preferred) and/or strict:true tool use; output_format param is deprecated; plain tool_use-for-JSON is the older (still valid) pattern.
- Adaptive thinking (thinking:{type:"adaptive"}) + output_config.effort; budget_tokens deprecated on 4.6+.
- stop_reason set: end_turn, tool_use, max_tokens, stop_sequence, pause_turn, refusal (HTTP 200), model_context_window_exceeded.
- MCP transports stdio + Streamable HTTP/SSE (NO WebSocket). tool_choice auto|any|tool|none.
- Claude Code: CLAUDE.md files CONCATENATE (not override); load order broadest->specific managed->user->project->local; more-specific (PROJECT) overrides USER, LOCAL overrides PROJECT; managed is non-excludable. CLAUDE.md is injected context, not enforced config (hooks, exit 2, enforce). --bare = real flag (skip auto-discovery for scripted/CI runs).`;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let d = 2000;
  for (let a = 0; ; a++) {
    try {
      return await fn();
    } catch (e: unknown) {
      const err = e as { status?: number; message?: string };
      const retry = err?.status === 429 || err?.status === 529 || (err?.status ?? 0) >= 500 || /rate|overload|limit|timeout|ECONN/i.test(String(err?.message ?? e));
      if (a >= 6 || !retry) throw e;
      await sleep(d);
      d = Math.min(d * 2, 30000);
    }
  }
}
async function ask(system: string, user: string, maxTokens: number): Promise<string> {
  const m = await withRetry(() => client.messages.create({ model: MODEL, max_tokens: maxTokens, system, messages: [{ role: "user", content: user }] }));
  return m.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");
}
const grab = (t: string, tag: string) => {
  const m = t.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i"));
  return (m ? m[1] : t).trim();
};
async function pool<I, O>(items: I[], n: number, w: (i: I) => Promise<O>): Promise<O[]> {
  const out: O[] = new Array(items.length);
  let i = 0;
  const run = async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await w(items[idx]);
    }
  };
  await Promise.all(Array.from({ length: n }, run));
  return out;
}

type LessonAudit = { ok: boolean; issues: string[]; replacements: { find: string; replace: string }[] };
async function auditLesson(md: string): Promise<LessonAudit> {
  const sys = "You audit a CCA-F study lesson for STALE/INCORRECT facts vs the given CURRENT facts. Output ONLY JSON in <a>...</a>.";
  const user = `${FACTS}\n\nLESSON MARKDOWN:\n"""\n${md}\n"""\n\nFind any claim that is stale or wrong per the CURRENT facts. For each, give an EXACT substring from the markdown to replace and its corrected version (change ONLY the wrong fact; keep surrounding wording, length, and markdown intact). If a stale technique is taught as current (e.g. prefill), reframe it as legacy/removed and point to the current mechanism. Return <a>{"ok":bool,"issues":["..."],"replacements":[{"find":"exact substring","replace":"corrected substring"}]}</a>. ok=true and replacements=[] if fully current.`;
  try {
    return JSON.parse(grab(await ask(sys, user, 2000), "a"));
  } catch {
    return { ok: false, issues: ["lesson audit parse failed"], replacements: [] };
  }
}

type CardAudit = { ok: boolean; issues: string[]; front: string; back: string };
async function auditCard(c: Flashcard): Promise<CardAudit> {
  const sys = "You audit one CCA-F flashcard for STALE/INCORRECT facts vs the given CURRENT facts. Output ONLY JSON in <a>...</a>.";
  const user = `${FACTS}\n\nFLASHCARD:\nfront: ${c.front}\nback: ${c.back}\n\nIf the card states a stale/wrong fact, return a corrected front/back (minimal change, same concept). If already current, echo them unchanged. Return <a>{"ok":bool,"issues":["..."],"front":"...","back":"..."}</a> (ok=true if already current).`;
  try {
    const a = JSON.parse(grab(await ask(sys, user, 900), "a")) as CardAudit;
    return { ok: !!a.ok, issues: a.issues || [], front: a.front ?? c.front, back: a.back ?? c.back };
  } catch {
    return { ok: false, issues: ["card audit parse failed"], front: c.front, back: c.back };
  }
}

async function main() {
  const WRITE = process.argv.includes("--write");
  const lPath = resolve(root, "data/lessons.json");
  const fPath = resolve(root, "data/flashcards.json");
  const lessons: Lesson[] = JSON.parse(readFileSync(lPath, "utf8"));
  const cards: Flashcard[] = JSON.parse(readFileSync(fPath, "utf8"));

  console.log(`auditing ${lessons.length} lessons + ${cards.length} flashcards…`);

  // Lessons
  const lessonResults = await pool(lessons, CONCURRENCY, async (l) => {
    const a = await auditLesson(l.markdown);
    let md = l.markdown;
    const applied: string[] = [];
    const missed: string[] = [];
    for (const r of a.replacements || []) {
      if (r.find && md.includes(r.find)) {
        md = md.replace(r.find, r.replace);
        applied.push(r.find.slice(0, 50));
      } else if (r.find) missed.push(r.find.slice(0, 50));
    }
    let reok = a.ok;
    if (applied.length) reok = (await auditLesson(md)).ok;
    return { domainKey: l.domainKey, changed: applied.length > 0 && md !== l.markdown, md, reok, issues: a.issues || [], applied, missed };
  });

  // Flashcards
  const cardResults = await pool(cards, CONCURRENCY, async (c) => {
    const a = await auditCard(c);
    const changed = a.front !== c.front || a.back !== c.back;
    let reok = a.ok;
    if (changed) reok = (await auditCard({ ...c, front: a.front, back: a.back })).ok;
    return { id: c.id, changed, front: a.front, back: a.back, reok, issues: a.issues };
  });

  const lessonsFixed = lessonResults.filter((r) => r.changed);
  const cardsFixed = cardResults.filter((r) => r.changed);
  console.log(`\nlessons changed: ${lessonsFixed.length}/${lessons.length}`);
  for (const r of lessonResults) console.log(`  ${r.domainKey}: ${r.changed ? "fixed " + r.applied.length + (r.reok ? " (reaudit ok)" : " (reaudit STILL flags)") : "clean"}${r.missed.length ? " | UNMATCHED finds: " + r.missed.length : ""}${r.issues.length && !r.changed ? " | note: " + r.issues[0] : ""}`);
  console.log(`flashcards changed: ${cardsFixed.length}/${cards.length}`);
  for (const r of cardsFixed) console.log(`  ${r.id}: fixed ${r.reok ? "(reaudit ok)" : "(reaudit STILL flags)"} — ${(r.issues[0] || "").slice(0, 80)}`);

  if (WRITE) {
    const newLessons = lessons.map((l) => {
      const r = lessonResults.find((x) => x.domainKey === l.domainKey)!;
      return r.changed && r.reok ? { ...l, markdown: r.md } : l;
    });
    const newCards = cards.map((c) => {
      const r = cardResults.find((x) => x.id === c.id)!;
      return r.changed && r.reok ? { ...c, front: r.front, back: r.back } : c;
    });
    writeFileSync(lPath, JSON.stringify(newLessons, null, 2) + "\n");
    writeFileSync(fPath, JSON.stringify(newCards, null, 2) + "\n");
    console.log("\nWROTE lessons.json + flashcards.json (only reaudit-ok fixes applied)");
  } else {
    console.log("\n(dry run — pass --write to apply reaudit-ok fixes)");
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
