import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";

// Deterministic 3-question exam. The correct option of every question carries
// the same marker text so the test can always click the right answer regardless
// of which letter (A-D) it lands on.
vi.mock("@/lib/content", () => {
  const mk = (id: string, correct: "A" | "B" | "C" | "D", domainKey: string) => ({
    id,
    unitKind: "domain",
    unitKey: domainKey,
    domainKey,
    scenarioKey: null,
    topic: "t",
    difficulty: "medium",
    scenario: null,
    stem: `stem ${id}`,
    options: (["A", "B", "C", "D"] as const).map((L) => ({
      id: L,
      text: L === correct ? "CORRECT_CHOICE" : `wrong-${id}-${L}`,
    })),
    correctOptionId: correct,
    explanation: "e",
  });
  return {
    CORPUS: {
      questions: [mk("t1", "B", "agentic"), mk("t2", "D", "tools"), mk("t3", "A", "prompt")],
      flashcards: [],
      lessons: [],
    },
  };
});

import ExamPage from "./page";
import { Providers } from "@/components/Providers";
import { load } from "@/lib/store";

beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("exam timer expiry", () => {
  it("scores the answers the learner actually selected, not an empty set", () => {
    vi.useFakeTimers();
    render(
      <Providers>
        <ExamPage />
      </Providers>,
    );

    fireEvent.click(screen.getByRole("button", { name: /Begin exam/i }));

    // Answer all three questions correctly, navigating with Next.
    for (let i = 0; i < 3; i++) {
      fireEvent.click(screen.getByText("CORRECT_CHOICE"));
      const next = screen.queryByRole("button", { name: /Next/i }) as HTMLButtonElement | null;
      if (next && !next.disabled) fireEvent.click(next);
    }

    // Let the clock run out WITHOUT pressing Submit, the bug path.
    act(() => {
      vi.setSystemTime(Date.now() + 8_000_000); // well past the 120-minute limit
      vi.advanceTimersByTime(600); // fire one countdown tick → auto-submit
    });

    const examAnswers = load().answers.filter((a) => a.mode === "exam");
    expect(examAnswers).toHaveLength(3);
    expect(examAnswers.every((a) => a.chosenOptionId !== null)).toBe(true);
    expect(examAnswers.filter((a) => a.correct)).toHaveLength(3);
  });
});
