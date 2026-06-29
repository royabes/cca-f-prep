"use client";

import type {
  PersistedState,
  AnswerRecord,
  ExamResult,
  SrsState,
  Settings,
} from "./types";

const KEY = "cca-f-trainer-v1";
const VERSION = 1;

export const DEFAULT_SETTINGS: Settings = {
  level: "practitioner",
  examMinutes: 120,
};

function empty(): PersistedState {
  return {
    version: VERSION,
    settings: { ...DEFAULT_SETTINGS },
    answers: [],
    exams: [],
    srs: {},
  };
}

export function load(): PersistedState {
  if (typeof window === "undefined") return empty();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as PersistedState;
    // Shallow migration / defaulting.
    return {
      version: VERSION,
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
      answers: parsed.answers || [],
      exams: parsed.exams || [],
      srs: parsed.srs || {},
    };
  } catch {
    return empty();
  }
}

export function save(state: PersistedState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // ignore quota / serialization errors
  }
}

// Convenience mutators that load, apply, persist, and return the new state.
export function recordAnswers(records: AnswerRecord[]): PersistedState {
  const s = load();
  s.answers.push(...records);
  // Keep the log bounded (most recent 5000 answers).
  if (s.answers.length > 5000) s.answers = s.answers.slice(-5000);
  save(s);
  return s;
}

export function recordExam(result: ExamResult): PersistedState {
  const s = load();
  s.exams.push(result);
  save(s);
  return s;
}

export function upsertSrs(cards: SrsState[]): PersistedState {
  const s = load();
  for (const c of cards) s.srs[c.key] = c;
  save(s);
  return s;
}

export function updateSettings(patch: Partial<Settings>): PersistedState {
  const s = load();
  s.settings = { ...s.settings, ...patch };
  save(s);
  return s;
}

export function resetAll(): PersistedState {
  const s = empty();
  save(s);
  return s;
}
