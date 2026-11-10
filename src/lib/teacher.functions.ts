import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const PERSONA = `You are Ada, the AI coding teacher inside CodeCraft Academy, an IDE that looks like VS Code.
You are extremely intelligent, pragmatic, warm, patient and precise. You teach beginners and advanced developers.
Never use emojis. Write in clear, professional, encouraging language. Prefer short sentences. Be concrete: reference exact line numbers and code.
When a learner is wrong, explain why, show the fix, and connect it to the underlying concept.`;

const filesSchema = z.record(z.string(), z.string());
const input = z.object({
  mode: z.enum(["review", "answer", "chat", "grade", "lesson", "hint"]),
  lessonTitle: z.string().max(300).default(""),
  goal: z.string().max(4000).default(""),
  reference: filesSchema.default({}),
  files: filesSchema.default({}),
  question: z.string().max(4000).default(""),
  answer: z.string().max(4000).default(""),
  line: z.string().max(2000).default(""),
  history: z.array(z.object({ role: z.enum(["user", "teacher"]), text: z.string().max(4000) })).max(30).default([]),
});

function numbered(files: Record<string, string>) {
  return Object.entries(files)
    .slice(0, 20)
    .map(([p, c]) => `--- ${p} ---\n` + c.slice(0, 8000).split("\n").map((l, i) => `${i + 1}| ${l}`).join("\n"))
    .join("\n\n") || "(no files)";
}

const COMMENT_SHAPE = `"comments": [{"file": "path", "line": number, "type": "praise" | "issue" | "question", "message": "string", "question": "string or empty"}]`;

export const askTeacher = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => input.parse(d))
  .handler(async ({ data }) => {
    const { askModel, extractJson, TeacherError } = await import("./ai/teacher.server");
    try {
      const ctx = `Lesson: ${data.lessonTitle}\nGoal: ${data.goal}\n\nReference solution:\n${numbered(data.reference)}\n\nLearner files:\n${numbered(data.files)}`;
      switch (data.mode) {
        case "review": {
          const t = await askModel(
            PERSONA,
            `${ctx}\n\nReview the learner's code line by line against the goal (the reference is one valid solution, other correct approaches are fine).
Return JSON only: {"score": 0-100, "summary": "2-3 sentences", ${COMMENT_SHAPE}}.
Give 3 to 7 comments. Include at least one "praise" if anything is right, every real "issue", and exactly one or two "question" comments that probe understanding of a specific line (for example: "Why does this line need X?"). Line numbers must exist in the learner file.`,
          );
          return { ok: true as const, json: JSON.stringify(extractJson(t)) };
        }
        case "grade": {
          const t = await askModel(
            PERSONA,
            `${ctx}\n\nThe learner rebuilt this exercise from scratch without help. Grade strictly but fairly, checking file structure, correctness and quality.
Return JSON only: {"score": 0-100, "passed": boolean (score >= 70), "summary": "string", "strengths": ["..."], "improvements": ["..."], ${COMMENT_SHAPE}}.`,
          );
          return { ok: true as const, json: JSON.stringify(extractJson(t)) };
        }
        case "answer": {
          const t = await askModel(
            PERSONA,
            `${ctx}\n\nYou asked the learner about this code: "${data.line}"\nQuestion: ${data.question}\nLearner answer: ${data.answer}
Decide whether the answer makes sense. Return JSON only: {"verdict": "understood" | "partial" | "confused", "points": 0-10, "feedback": "explain what is right or wrong and the correct idea", "exercise": "if partial or confused, a small similar exercise (one or two sentences) the learner can do right now in the editor, else empty string"}.`,
          );
          return { ok: true as const, json: JSON.stringify(extractJson(t)) };
        }
        case "hint": {
          const t = await askModel(PERSONA, `${ctx}\n\nGive one short, specific hint for the next thing the learner should write. Do not give the full solution. Max 3 sentences.`);
          return { ok: true as const, json: JSON.stringify({ text: t }) };
        }
        case "chat": {
          const convo = data.history.map((m) => `${m.role === "user" ? "Learner" : "Ada"}: ${m.text}`).join("\n");
          const t = await askModel(
            PERSONA,
            `${ctx}\n\nConversation so far:\n${convo}\n\nLearner: ${data.question}\n\nAnswer as Ada using markdown. Use fenced code blocks with a language tag when showing code. Keep it focused and under 250 words unless code requires more.`,
          );
          return { ok: true as const, json: JSON.stringify({ text: t }) };
        }
        case "lesson": {
          const t = await askModel(
            PERSONA,
            `Design a hands-on lesson the learner asked for: "${data.question}".
Choose runtime: "web" (plain HTML/CSS/JS, entry index.html), "react" (files .jsx, React 18 global, no imports needed but you may write import lines; must include src/App.jsx defining function App and src/main.jsx calling ReactDOM.createRoot(document.getElementById('root')).render(<App />)), "vue" (index.html + app.js using global Vue.createApp), "node" (index.js or server.js; console output; express available via require('express') with get/post/put/delete/use/listen and res.json/res.send/res.status), or "fullstack" (server.js with express API + public/index.html that uses fetch('/api/...')).
For any other language (Python, etc.) pick the closest runtime and teach concepts through JavaScript, mentioning the parallel.
Return JSON only:
{"title": "string", "summary": "string", "level": "Beginner" | "Intermediate" | "Advanced", "runtime": "web"|"react"|"vue"|"node"|"fullstack", "concepts": ["..."], "practice": "instructions for repeating the demo", "challenge": "instructions to rebuild from scratch with a small twist",
 "steps": [ {"kind": "folder", "path": "src", "say": "why"} | {"kind": "file", "path": "src/App.jsx", "say": "why"} | {"kind": "type", "path": "file path", "say": "intro", "lines": [{"code": "one line of code", "note": "plain explanation of this line, or empty"}]} | {"kind": "preview", "say": "what to notice"} ]}
Use 6 to 14 steps, 20 to 70 total code lines, notes on most meaningful lines. The code must run correctly in the chosen runtime.`,
          );
          return { ok: true as const, json: JSON.stringify(extractJson(t)) };
        }
      }
    } catch (e) {
      const status = e instanceof TeacherError ? e.status : 500;
      const message = e instanceof Error ? e.message : "The teacher could not answer.";
      console.error("askTeacher failed", status, message);
      return { ok: false as const, status, error: message };
    }
  });
