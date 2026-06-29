import type { SrsState, DomainKey } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

// Recall grades exposed in the UI, mapped to SM-2 quality scores.
export type Recall = "again" | "hard" | "good" | "easy";

export const RECALL_QUALITY: Record<Recall, number> = {
  again: 1,
  hard: 3,
  good: 4,
  easy: 5,
};

export function newCard(
  key: string,
  kind: "question" | "flashcard",
  refId: string,
  domainKey: DomainKey,
  now: number,
): SrsState {
  return {
    key,
    kind,
    refId,
    domainKey,
    ease: 2.5,
    intervalDays: 0,
    reps: 0,
    due: now, // due immediately on creation
    lapses: 0,
    lastGrade: null,
  };
}

// SM-2 update with a same-session relearning step for lapses. `now` is injected
// so callers control the clock. A missed/again card becomes due immediately so it
// resurfaces in the next review session (it only graduates once recalled correctly).
export function review(card: SrsState, recall: Recall, now: number): SrsState {
  const q = RECALL_QUALITY[recall];
  let { ease, intervalDays, reps, lapses } = card;
  let due: number;

  if (q < 3) {
    // Lapse: reset repetition count and relearn now (don't bury it until tomorrow).
    reps = 0;
    intervalDays = 0;
    lapses += 1;
    due = now;
  } else {
    if (reps === 0) intervalDays = 1;
    else if (reps === 1) intervalDays = 6;
    else intervalDays = Math.round(intervalDays * ease);
    reps += 1;
    due = now + intervalDays * DAY_MS;
  }

  // Update ease factor (SM-2 formula), floor at 1.3.
  ease = ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  if (ease < 1.3) ease = 1.3;

  return { ...card, ease, intervalDays, reps, lapses, lastGrade: q, due };
}

export function isDue(card: SrsState, now: number): boolean {
  return card.due <= now;
}

export function dueCards(srs: Record<string, SrsState>, now: number): SrsState[] {
  return Object.values(srs)
    .filter((c) => isDue(c, now))
    .sort((a, b) => a.due - b.due);
}
