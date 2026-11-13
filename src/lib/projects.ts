import { z } from "zod";
import type { Runtime } from "./curriculum";

const projectSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  language: z.string(),
  runtime: z.enum(["none", "web", "react", "vue", "node", "fullstack"]),
  files: z.record(z.string(), z.string()),
  folders: z.array(z.string()),
  activeFile: z.string(),
  updatedAt: z.number(),
});
export type PersonalProject = z.infer<typeof projectSchema>;
export type ProjectRuntime = Runtime | "none";
const KEY = "codecraft:projects";

export function createProject(
  name: string,
  language: string,
  runtime: ProjectRuntime,
): PersonalProject {
  return {
    id: crypto.randomUUID(),
    name: name.trim() || "Untitled project",
    language: language.trim() || "Any language",
    runtime,
    files: {},
    folders: [],
    activeFile: "",
    updatedAt: Date.now(),
  };
}

export function getProjects(): PersonalProject[] {
  if (typeof window === "undefined") return [];
  try {
    const raw: unknown = JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
    if (!Array.isArray(raw)) return [];
    return raw
      .flatMap((item) => {
        const parsed = projectSchema.safeParse(item);
        return parsed.success ? [parsed.data] : [];
      })
      .sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

export function saveProject(project: PersonalProject) {
  window.localStorage.setItem(
    KEY,
    JSON.stringify([project, ...getProjects().filter((item) => item.id !== project.id)]),
  );
}

export function deleteProject(id: string) {
  window.localStorage.setItem(KEY, JSON.stringify(getProjects().filter((item) => item.id !== id)));
}

export const projectReviewSchema = z.object({
  summary: z.string(),
  comments: z
    .array(
      z.object({
        file: z.string(),
        line: z.number(),
        type: z.enum(["issue", "praise", "question"]),
        message: z.string(),
      }),
    )
    .max(30),
  corrections: z
    .array(z.object({ file: z.string(), explanation: z.string(), content: z.string() }))
    .max(20),
});
export type ProjectReview = z.infer<typeof projectReviewSchema>;

export function applyProjectCorrection(
  files: Record<string, string>,
  snapshot: Record<string, string>,
  correction: ProjectReview["corrections"][number],
) {
  if (
    !(correction.file in files) ||
    !(correction.file in snapshot) ||
    files[correction.file] !== snapshot[correction.file]
  )
    return null;
  return { ...files, [correction.file]: correction.content };
}
