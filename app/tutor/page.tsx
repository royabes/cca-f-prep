"use client";

import Markdown from "@/components/Markdown";

import { useEffect, useRef, useState } from "react";
import { useSettings } from "@/components/Providers";
import { LEVELS } from "@/lib/domains";
import { PageHeader } from "@/components/ui";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  "When should I use a multi-agent system vs a single agent?",
  "Explain the difference between MCP resources, tools, and prompts.",
  "How do CLAUDE.md precedence rules actually resolve conflicts?",
  "Quiz me on context management with one hard scenario question.",
];

export default function TutorPage() {
  const { settings } = useSettings();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [noKey, setNoKey] = useState(false);
  const [error, setError] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    setError(false);
    const next = [...messages, { role: "user" as const, content }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "chat", level: settings.level, messages: next }),
      });
      if (res.status === 503) {
        setNoKey(true);
        return;
      }
      if (!res.ok) throw new Error("bad");
      const data = await res.json();
      setMessages((m) => [...m, { role: "assistant", content: data.text || "(no response)" }]);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  const levelMeta = LEVELS.find((l) => l.key === settings.level)!;

  return (
    <div className="fade-in">
      <PageHeader
        kicker="AI tutor"
        title="Ask Claude anything CCA-F"
        intro={
          <>
            A Claude-powered tutor that answers at your level (<strong>{levelMeta.label}</strong>) and can quiz you,
            explain trade-offs, or unpack any concept. It’s grounded in the real Claude API, Agent SDK, Claude Code,
            and MCP.
          </>
        }
      />

      {noKey && (
        <div className="mb-4 rounded-xl border border-[var(--amber)] bg-[color-mix(in_srgb,var(--amber)_10%,transparent)] px-4 py-3 text-[0.86rem]">
          The AI tutor needs an <code>ANTHROPIC_API_KEY</code>. Set it in <code>.env.local</code> (see the README),
          then restart the dev server. Everything else in the app works without it.
        </div>
      )}

      <div className="card flex h-[60vh] flex-col p-0">
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {messages.length === 0 && (
            <div className="grid h-full place-items-center">
              <div className="max-w-md text-center">
                <div className="mb-3 text-[0.86rem] text-[var(--ink-soft)]">Try one of these to start:</div>
                <div className="grid gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="rounded-xl border border-[var(--line-strong)] px-4 py-2.5 text-left text-[0.86rem] transition-colors hover:bg-[var(--paper-2)]"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[0.92rem] leading-relaxed ${
                  m.role === "user"
                    ? "whitespace-pre-wrap bg-[var(--clay)] text-[var(--on-primary)]"
                    : "border border-[var(--line)] bg-[var(--paper-2)]"
                }`}
              >
                {m.role === "user" ? m.content : <Markdown source={m.content} compact />}
              </div>
            </div>
          ))}

          {busy && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-2xl border border-[var(--line)] bg-[var(--paper-2)] px-4 py-2.5 text-[0.88rem] text-[var(--ink-soft)]">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--line-strong)] border-t-[var(--clay)]" />
                Thinking…
              </div>
            </div>
          )}
          {error && (
            <div className="text-center text-[0.84rem] text-[var(--red)]">
              Couldn’t reach the tutor. Try again.
            </div>
          )}
          <div ref={endRef} />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex items-center gap-2 border-t border-[var(--line)] p-3"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about agents, MCP, Claude Code, prompting…"
            className="flex-1 rounded-xl border border-[var(--line-strong)] bg-[var(--card)] px-4 py-2.5 text-[0.92rem] outline-none focus:border-[var(--clay)]"
          />
          <button type="submit" disabled={busy || !input.trim()} className="btn btn-primary">
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
