// Core domain model for the CCA-F Trainer.

export type DomainKey = "agentic" | "claudecode" | "prompt" | "tools" | "context";

export type Difficulty = "easy" | "medium" | "hard";

export type UserLevel = "newcomer" | "practitioner" | "architect";

export interface Option {
  id: "A" | "B" | "C" | "D";
  text: string;
}

export interface Question {
  id: string;
  unitKind: "domain" | "scenario";
  unitKey: string;
  domainKey: DomainKey;
  scenarioKey: string | null;
  topic: string;
  difficulty: Difficulty;
  scenario: string | null;
  stem: string;
  options: Option[];
  correctOptionId: "A" | "B" | "C" | "D";
  explanation: string;
}

export interface Flashcard {
  id: string;
  domainKey: DomainKey;
  front: string;
  back: string;
}

export interface Lesson {
  domainKey: DomainKey;
  title: string;
  markdown: string;
}

export interface Corpus {
  lessons: Lesson[];
  questions: Question[];
  flashcards: Flashcard[];
}

// ---- Learner state (persisted in localStorage) ----

// 0 = pure guess, 1 = somewhat sure, 2 = confident. Drives confidence-based scoring.
export type Confidence = 0 | 1 | 2;

export interface AnswerRecord {
  questionId: string;
  domainKey: DomainKey;
  chosenOptionId: "A" | "B" | "C" | "D" | null; // null = unanswered/skipped
  correct: boolean;
  confidence: Confidence;
  difficulty: Difficulty;
  ts: number; // epoch ms
  mode: "practice" | "exam" | "review";
}

export interface ExamResult {
  id: string;
  ts: number;
  scaledScore: number; // 100..1000
  passed: boolean; // scaledScore >= 720
  rawCorrect: number;
  total: number;
  durationMs: number;
  perDomain: Record<DomainKey, { correct: number; total: number }>;
}

// SM-2 spaced-repetition card state.
export interface SrsState {
  key: string; // "q:<id>" or "f:<id>"
  kind: "question" | "flashcard";
  refId: string;
  domainKey: DomainKey;
  ease: number; // ease factor, starts 2.5
  intervalDays: number;
  reps: number;
  due: number; // epoch ms when next due
  lapses: number;
  lastGrade: number | null;
}

export interface Settings {
  level: UserLevel;
  examMinutes: number; // default 120
}

export interface PersistedState {
  version: number;
  settings: Settings;
  answers: AnswerRecord[];
  exams: ExamResult[];
  srs: Record<string, SrsState>;
}
