import type { Lesson, Step } from "./curriculum";
import { referenceFiles, referenceFolders } from "./curriculum";
import type { ReviewComment } from "./progress";

export type LogEntry = {
  id: number;
  level: "log" | "info" | "warn" | "error";
  text: string;
  source: "preview" | "studio";
};
export type Problem = {
  file: string;
  line: number;
  message: string;
  severity: "error" | "warning";
};

export const normalizePath = (path: string) =>
  path
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .replace(/^\/+|\/+$/g, "")
    .replace(/\/{2,}/g, "/");

export function validNewPath(
  path: string,
  files: Record<string, string>,
  folders: string[],
  folder = false,
) {
  const clean = normalizePath(path);
  if (!clean || clean.split("/").some((part) => !part || part === "." || part === ".."))
    return "Use a valid path, such as src/App.jsx.";
  if (!/^[a-zA-Z0-9_./@ -]+$/.test(clean))
    return "Use letters, numbers, spaces, dots, dashes, underscores or slashes.";
  if (!folder && !clean.split("/").pop()?.includes("."))
    return "Add a file extension, such as .html, .css or .js.";
  if (clean in files || folders.includes(clean)) return "That file or folder already exists.";
  const parents = clean
    .split("/")
    .slice(0, -1)
    .map((_, i, all) => all.slice(0, i + 1).join("/"));
  if (parents.some((p) => p in files)) return "A parent path is already a file.";
  if (
    Object.keys(files).some((f) => f.startsWith(clean + "/")) ||
    folders.some((f) => f.startsWith(clean + "/"))
  )
    return "That name is already used as a folder.";
  return null;
}

export function expectedPaths(lesson: Lesson) {
  return Object.keys(referenceFiles(lesson));
}

export function blankPractice(lesson: Lesson) {
  return Object.fromEntries(expectedPaths(lesson).map((path) => [path, ""]));
}

export function manualEditPhase(phase: import("./progress").Phase) {
  return phase === "watch" || phase === "review" || phase === "done" ? "repeat" : phase;
}

export function similarity(files: Record<string, string>, reference: Record<string, string>) {
  const wanted = Object.entries(reference);
  if (!wanted.length) return 0;
  const points = wanted.reduce((total, [path, content]) => {
    const actual = (files[path] ?? "").replace(/\s+/g, " ").trim();
    const expected = content.replace(/\s+/g, " ").trim();
    if (!expected) return total + 1;
    if (!actual) return total;
    if (actual === expected) return total + 1;
    const tokens = expected.split(/(?<=[>{};])|\s+/).filter((token) => token.length > 1);
    const matched = tokens.filter((token) => actual.includes(token)).length;
    return total + (tokens.length ? matched / tokens.length : 0);
  }, 0);
  return Math.round((points / wanted.length) * 100);
}

export function inspectFiles(files: Record<string, string>): Problem[] {
  const problems: Problem[] = [];
  for (const [file, source] of Object.entries(files)) {
    const lines = source.split("\n");
    if (/\.(jsx|js|tsx|ts)$/.test(file)) {
      let braces = 0;
      let parens = 0;
      lines.forEach((line, index) => {
        const clean = line.replace(/(["'`])(?:\\.|(?!\1).)*\1/g, "");
        for (const char of clean) {
          if (char === "{") braces++;
          if (char === "}") braces--;
          if (char === "(") parens++;
          if (char === ")") parens--;
        }
        if (braces < 0)
          problems.push({
            file,
            line: index + 1,
            message: "Unexpected closing brace.",
            severity: "error",
          });
        if (parens < 0)
          problems.push({
            file,
            line: index + 1,
            message: "Unexpected closing parenthesis.",
            severity: "error",
          });
      });
      if (braces > 0)
        problems.push({
          file,
          line: lines.length,
          message: `${braces} opening brace${braces === 1 ? " is" : "s are"} not closed.`,
          severity: "error",
        });
      if (parens > 0)
        problems.push({
          file,
          line: lines.length,
          message: `${parens} opening parenthes${parens === 1 ? "is is" : "es are"} not closed.`,
          severity: "error",
        });
    }
    if (/\.html$/.test(file)) {
      lines.forEach((line, index) => {
        if (/\sonclick\s*=\s*["']?\s*javascript:/i.test(line))
          problems.push({
            file,
            line: index + 1,
            message: "Inline JavaScript URLs are unsafe. Use an event listener instead.",
            severity: "warning",
          });
      });
    }
  }
  return problems;
}

export function localComments(lesson: Lesson): ReviewComment[] {
  const comments: ReviewComment[] = [];
  for (const step of lesson.steps) {
    if (step.kind !== "type") continue;
    const reference = referenceFiles(lesson)[step.path] ?? "";
    const lines = reference.split("\n");
    const base = lines.findIndex((line) => line === step.lines[0]?.code);
    step.lines.forEach((line, index) => {
      if (!line.note) return;
      const lineNumber = Math.max(1, (base < 0 ? index : base + index) + 1);
      if (comments.filter((c) => c.type === "question").length < 2 && line.code.trim()) {
        comments.push({
          id: `quiz-${step.path}-${index}`,
          file: step.path,
          line: lineNumber,
          type: "question",
          message: line.note,
          question: `In your own words, why is this line important: ${line.code.trim()}`,
          questionPoints: 0,
        } as ReviewComment);
      } else if (comments.length < 5) {
        comments.push({
          id: `note-${step.path}-${index}`,
          file: step.path,
          line: lineNumber,
          type: "praise",
          message: line.note,
        });
      }
    });
  }
  return comments.slice(0, 7);
}

export function safeComments(value: unknown, files: Record<string, string>): ReviewComment[] {
  if (
    !value ||
    typeof value !== "object" ||
    !("comments" in value) ||
    !Array.isArray(value.comments)
  )
    return [];
  return value.comments.flatMap((raw, index): ReviewComment[] => {
    if (!raw || typeof raw !== "object") return [];
    const item = raw as Record<string, unknown>;
    const file =
      typeof item["file"] === "string" && item["file"] in files
        ? item["file"]
        : Object.keys(files)[0];
    if (!file) return [];
    const max = Math.max(1, (files[file] ?? "").split("\n").length);
    const line = Math.min(
      max,
      Math.max(1, typeof item["line"] === "number" ? Math.round(item["line"]) : 1),
    );
    const type =
      item["type"] === "issue" || item["type"] === "question" || item["type"] === "praise"
        ? item["type"]
        : "praise";
    return [
      {
        id: `ada-${Date.now()}-${index}`,
        file,
        line,
        type,
        message:
          typeof item["message"] === "string" ? item["message"] : "Ada left a note on this line.",
        ...(typeof item["question"] === "string" && item["question"]
          ? { question: item["question"] }
          : {}),
      },
    ];
  });
}

export function watchThrough(lesson: Lesson, stepCount: number) {
  const files: Record<string, string> = {};
  const folders: string[] = [];
  lesson.steps.slice(0, stepCount).forEach((step) => {
    if (step.kind === "folder" && !folders.includes(step.path)) folders.push(step.path);
    if (step.kind === "file") files[step.path] ??= "";
    if (step.kind === "type")
      files[step.path] =
        (files[step.path] ? files[step.path] + "\n" : "") +
        step.lines.map((line) => line.code).join("\n");
  });
  return { files, folders };
}

export function initialActiveFile(lesson: Lesson) {
  return expectedPaths(lesson)[0] ?? "";
}

export function lessonReference(lesson: Lesson) {
  return { reference: referenceFiles(lesson), folders: referenceFolders(lesson) };
}

export function nextPlayableStep(steps: Step[], index: number) {
  return Math.min(steps.length, Math.max(0, index));
}
