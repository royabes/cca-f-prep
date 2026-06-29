import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

export const runtime = "nodejs";

const LEVEL_PERSONA: Record<string, string> = {
  newcomer:
    "The learner is NEW to the Claude ecosystem. Explain from first principles, define jargon, and keep it concrete. Avoid assuming prior API knowledge.",
  practitioner:
    "The learner has some hands-on Claude/API experience. Use correct terminology, be balanced in depth, and focus on the 'why'.",
  architect:
    "The learner designs production systems. Be terse and trade-off-focused. Skip basics; emphasize edge cases, failure modes, and when each option breaks.",
};

const BASE_SYSTEM =
  "You are an expert tutor for the Claude Certified Architect — Foundations (CCA-F) exam. " +
  "The exam covers five domains: Agentic Architecture & Orchestration, Claude Code Configuration & Workflows, " +
  "Prompt Engineering & Structured Output, Tool Design & MCP Integration, and Context Management & Reliability. " +
  "Be accurate, grounded in real Anthropic technology (Claude API, Agent SDK, Claude Code, MCP). " +
  "Never invent APIs. Teach architectural judgment and trade-offs, not trivia.";

function resolveApiKey(): string | null {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  // Local-first convenience fallback (works on the developer's machine).
  try {
    const key = readFileSync(join(homedir(), ".anthropic_api_key"), "utf8").trim();
    if (key) return key;
  } catch {
    /* no local key file */
  }
  return null;
}

interface QuestionPayload {
  scenario?: string | null;
  stem: string;
  options: { id: string; text: string }[];
  correctOptionId: string;
  explanation: string;
  topic?: string;
}

export async function POST(req: NextRequest) {
  const apiKey = resolveApiKey();
  if (!apiKey) {
    return NextResponse.json({ error: "no_api_key" }, { status: 503 });
  }

  let body: {
    mode: "explain" | "chat";
    level?: string;
    question?: QuestionPayload;
    messages?: { role: "user" | "assistant"; content: string }[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const level = body.level && LEVEL_PERSONA[body.level] ? body.level : "practitioner";
  const persona = LEVEL_PERSONA[level];
  const client = new Anthropic({ apiKey });
  const model = process.env.TUTOR_MODEL || "claude-haiku-4-5-20251001";

  let system = `${BASE_SYSTEM}\n\nLEARNER LEVEL: ${persona}`;
  let messages: { role: "user" | "assistant"; content: string }[];

  if (body.mode === "explain" && body.question) {
    const q = body.question;
    const opts = q.options.map((o) => `${o.id}. ${o.text}`).join("\n");
    system +=
      "\n\nYou are explaining ONE practice question. In <=180 words: (1) tie it to the scenario, " +
      "(2) say plainly why the correct option is right, (3) name the trap in the most tempting wrong option, " +
      "(4) give one short memory hook. Use short paragraphs separated by blank lines. Do not use markdown headers.";
    messages = [
      {
        role: "user",
        content:
          `Topic: ${q.topic ?? "n/a"}\n` +
          (q.scenario ? `Scenario: ${q.scenario}\n` : "") +
          `Question: ${q.stem}\nOptions:\n${opts}\nCorrect answer: ${q.correctOptionId}\n` +
          `Reference explanation: ${q.explanation}\n\nNow coach me at my level.`,
      },
    ];
  } else if (body.mode === "chat" && body.messages?.length) {
    system +=
      "\n\nAnswer the learner's question conversationally and concisely. Offer a concrete example or a quick " +
      "practice question when helpful. Keep responses focused (a few short paragraphs).";
    messages = body.messages.slice(-12);
  } else {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  try {
    const msg = await client.messages.create({
      model,
      max_tokens: 700,
      system,
      messages,
    });
    const text = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    return NextResponse.json({ text, model });
  } catch (err) {
    const message = err instanceof Error ? err.message : "tutor_error";
    return NextResponse.json({ error: "tutor_error", detail: message }, { status: 502 });
  }
}
