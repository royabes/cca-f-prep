"use client";

import { useState } from "react";
import type { Question, UserLevel } from "@/lib/types";

// On-demand, level-aware elaboration from the Claude tutor. Implements the
// "elaborative interrogation / self-explanation" technique: the learner can ask
// for a deeper, context-tailored explanation of any question.
export default function ExplainPanel({ question, level }: { question: Question; level: UserLevel }) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error" | "nokey">("idle");
  const [text, setText] = useState("");

  async function ask() {
    setState("loading");
    try {
      const res = await fetch("/api/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "explain", level, question }),
      });
      if (res.status === 503) {
        setState("nokey");
        return;
      }
      if (!res.ok) throw new Error("bad status");
      const data = await res.json();
      setText(data.text || "");
      setState("done");
    } catch {
      setState("error");
    }
  }

  return (
    <div className="mt-3">
      {state === "idle" && (
        <button onClick={ask} className="btn btn-soft text-[0.84rem]">
          ✦ Explain this at my level
        </button>
      )}
      {state === "loading" && (
        <div className="flex items-center gap-2 text-[0.86rem] text-[var(--ink-soft)]">
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--line-strong)] border-t-[var(--clay)]" />
          Asking the tutor…
        </div>
      )}
      {state === "done" && (
        <div className="fade-in rounded-xl border border-[var(--clay-soft)] bg-[color-mix(in_srgb,var(--clay)_5%,transparent)] px-4 py-3 text-[0.9rem] leading-relaxed">
          <div className="mb-1 text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--clay)]">
            ✦ Tutor · tailored to {level}
          </div>
          {text.split("\n").filter(Boolean).map((p, i) => (
            <p key={i} className="mt-1.5 first:mt-0">
              {p}
            </p>
          ))}
        </div>
      )}
      {state === "nokey" && (
        <div className="rounded-xl border border-[var(--line)] bg-[var(--paper-2)] px-4 py-3 text-[0.84rem] text-[var(--ink-soft)]">
          The live AI tutor needs an <code>ANTHROPIC_API_KEY</code>. The written explanation above still
          covers the key reasoning — set the key (see README) to unlock tailored, level-aware coaching.
        </div>
      )}
      {state === "error" && (
        <button onClick={ask} className="btn btn-ghost text-[0.84rem]">
          Couldn’t reach the tutor — retry
        </button>
      )}
    </div>
  );
}
