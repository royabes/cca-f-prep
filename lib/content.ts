import questionsJson from "@/data/questions.json";
import flashcardsJson from "@/data/flashcards.json";
import lessonsJson from "@/data/lessons.json";
import type { Corpus, Question, Flashcard, Lesson, DomainKey } from "./types";

export const CORPUS: Corpus = {
  questions: questionsJson as unknown as Question[],
  flashcards: flashcardsJson as unknown as Flashcard[],
  lessons: lessonsJson as unknown as Lesson[],
};

export const QUESTION_BY_ID: Map<string, Question> = new Map(
  CORPUS.questions.map((q) => [q.id, q]),
);

export const FLASHCARD_BY_ID: Map<string, Flashcard> = new Map(
  CORPUS.flashcards.map((f) => [f.id, f]),
);

export const LESSON_BY_DOMAIN: Map<DomainKey, Lesson> = new Map(
  CORPUS.lessons.map((l) => [l.domainKey, l]),
);

export function questionsForDomain(d: DomainKey): Question[] {
  return CORPUS.questions.filter((q) => q.domainKey === d);
}

export function flashcardsForDomain(d: DomainKey): Flashcard[] {
  return CORPUS.flashcards.filter((f) => f.domainKey === d);
}

export function countsByDomain(): Record<DomainKey, number> {
  const out = {} as Record<DomainKey, number>;
  for (const q of CORPUS.questions) out[q.domainKey] = (out[q.domainKey] || 0) + 1;
  return out;
}
