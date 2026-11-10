import type { Lesson } from "./curriculum";

export type Phase = "watch" | "repeat" | "review" | "challenge" | "done";
export type ReviewComment = {
  id: string;
  file: string;
  line: number;
  type: "praise" | "issue" | "question";
  message: string;
  question?: string;
  answer?: string;
  feedback?: string;
  verdict?: "understood" | "partial" | "confused";
  exercise?: string;
};
export type LessonSave = {
  phase: Phase;
  stepIndex: number;
  files: Record<string, string>;
  folders: string[];
  comments: ReviewComment[];
  reviewScore?: number;
  challengeScore?: number;
  questionPoints: number;
  updatedAt: number;
};
export type Progress = {
  xp: number;
  completed: Record<string, number>;
  last?: { trackId: string; lessonId: string; title: string };
  streak: number;
  lastDay?: string;
  badges: string[];
};

const PKEY = "codecraft:progress";
const empty: Progress = { xp: 0, completed: {}, streak: 0, badges: [] };

function safeGet<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function safeSet(key: string, v: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* storage full */
  }
}

export const getProgress = (): Progress => ({ ...empty, ...(safeGet<Progress>(PKEY) ?? {}) });
export const saveProgress = (p: Progress) => {
  safeSet(PKEY, p);
  window.dispatchEvent(new Event("codecraft:progress"));
};

export function touchStreak(p: Progress): Progress {
  const today = new Date().toISOString().slice(0, 10);
  if (p.lastDay === today) return p;
  const y = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  return { ...p, lastDay: today, streak: p.lastDay === y ? p.streak + 1 : 1 };
}

export function addXp(amount: number, badge?: string) {
  let p = touchStreak(getProgress());
  p = { ...p, xp: p.xp + Math.max(0, Math.round(amount)) };
  if (badge && !p.badges.includes(badge)) p.badges = [...p.badges, badge];
  saveProgress(p);
  return p;
}

export const levelFor = (xp: number) => {
  const level = Math.floor(Math.sqrt(xp / 100)) + 1;
  const cur = (level - 1) ** 2 * 100;
  const next = level ** 2 * 100;
  return { level, into: xp - cur, span: next - cur };
};

export const rankFor = (level: number) =>
  ["Curious Beginner", "Tag Tinkerer", "Style Sculptor", "Script Scout", "Component Crafter", "API Architect", "Full Stack Pilot", "Code Sensei"][Math.min(7, level - 1)]!;

const lkey = (t: string, l: string) => `codecraft:lesson:${t}/${l}`;
export const getLessonSave = (t: string, l: string) => safeGet<LessonSave>(lkey(t, l));
export const putLessonSave = (t: string, l: string, s: LessonSave) => safeSet(lkey(t, l), s);
export const clearLessonSave = (t: string, l: string) => {
  if (typeof window !== "undefined") window.localStorage.removeItem(lkey(t, l));
};

const CKEY = "codecraft:custom";
export const getCustomLessons = (): Lesson[] => safeGet<Lesson[]>(CKEY) ?? [];
export const putCustomLesson = (l: Lesson) => safeSet(CKEY, [l, ...getCustomLessons().filter((x) => x.id !== l.id)].slice(0, 30));
