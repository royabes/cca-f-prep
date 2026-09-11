import { DEMOS_URL, REPO_URL } from "./site";

export interface WhatsNewEntry {
  /** ISO date, YYYY-MM-DD */
  date: string;
  title: string;
  body: string;
  href?: string;
  label?: string;
}

/** Newest first. The dashboard shows the latest three. */
export const WHATS_NEW: WhatsNewEntry[] = [
  {
    date: "2026-09-11",
    title: "Now part of royabes.com",
    body:
      "The trainer moved to cca.royabes.com and took on the portfolio's look, with light and dark themes. Same content, and your progress still lives in this browser.",
    href: DEMOS_URL,
    label: "More demos",
  },
  {
    date: "2026-09-11",
    title: "Open source: run it on your machine",
    body:
      "The code is public under the MIT license. Clone it, run npm install and npm run dev, and add your own Claude key if you want the AI tutor.",
    href: REPO_URL,
    label: "View on GitHub",
  },
  {
    date: "2026-09-11",
    title: "Checked against Anthropic's Exam Guide v1.0",
    body:
      "The July 2026 guide keeps the five domains and weights this app targets. The official code is now CCAR-F, the fee is $125, credentials last 12 months, each sitting draws 4 of 6 scenarios, and some items are multiple-response. The practice bank is single-answer for now.",
  },
];
