import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  Clock3,
  LoaderCircle,
  Play,
  Sparkles,
} from "lucide-react";
import { z } from "zod";
import logo from "@/assets/logo.png";
import teacher from "@/assets/sticker-teacher.png";
import { tracks } from "@/lib/curriculum";
import { getCustomLessons, getProgress, putCustomLesson, type Progress } from "@/lib/progress";
import { askTeacher } from "@/lib/teacher.functions";
import type { Lesson } from "@/lib/curriculum";

export const Route = createFileRoute("/studio/")({
  head: () => ({
    meta: [
      { title: "Lesson library — CodeCraft Academy" },
      {
        name: "description",
        content:
          "Choose a guided coding project or ask Ada to create a personalized interactive lesson.",
      },
      { property: "og:title", content: "CodeCraft lesson library" },
      {
        property: "og:description",
        content: "Guided projects, interactive code quizzes and from-scratch challenges.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StudioHome,
});

const generatedLesson = z.object({
  title: z.string().min(3).max(120),
  summary: z.string().min(10).max(600),
  level: z.enum(["Beginner", "Intermediate", "Advanced"]),
  runtime: z.enum(["web", "react", "vue", "node", "fullstack"]),
  concepts: z.array(z.string()).max(12).default([]),
  practice: z.string().min(5).max(2000),
  challenge: z.string().min(5).max(2000),
  steps: z
    .array(
      z.discriminatedUnion("kind", [
        z.object({ kind: z.literal("folder"), path: z.string().min(1), say: z.string() }),
        z.object({ kind: z.literal("file"), path: z.string().min(1), say: z.string() }),
        z.object({
          kind: z.literal("type"),
          path: z.string().min(1),
          say: z.string().optional(),
          lines: z.array(z.object({ code: z.string(), note: z.string().optional() })).min(1),
        }),
        z.object({ kind: z.literal("preview"), say: z.string() }),
      ]),
    )
    .min(2)
    .max(30),
});

function StudioHome() {
  const ask = useServerFn(askTeacher);
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [custom, setCustom] = useState<Lesson[]>([]);
  const [progress, setProgress] = useState<Progress>({
    xp: 0,
    completed: {},
    streak: 0,
    badges: [],
  });
  useEffect(() => {
    setCustom(getCustomLessons());
    setProgress(getProgress());
  }, []);

  const generate = async () => {
    if (busy) return;
    if (prompt.trim().length < 8)
      return setError("Describe the topic or project you want to learn in a little more detail.");
    setBusy(true);
    setError("");
    try {
      const result = await ask({
        data: {
          mode: "lesson",
          lessonTitle: "",
          goal: "",
          reference: {},
          files: {},
          question: prompt.trim(),
          answer: "",
          line: "",
          history: [],
        },
      });
      if (!result.ok) throw new Error(result.error);
      const parsed = generatedLesson.parse(JSON.parse(result.json));
      const steps: Lesson["steps"] = parsed.steps.map((step) =>
        step.kind === "type"
          ? {
              kind: "type",
              path: step.path,
              ...(step.say !== undefined ? { say: step.say } : {}),
              lines: step.lines.map((line) => ({
                code: line.code,
                ...(line.note !== undefined ? { note: line.note } : {}),
              })),
            }
          : step,
      );
      const lesson: Lesson = {
        ...parsed,
        steps,
        id: `ada-${Date.now().toString(36)}`,
        minutes: Math.min(60, Math.max(10, parsed.steps.length * 2)),
        xp: parsed.level === "Advanced" ? 350 : parsed.level === "Intermediate" ? 250 : 150,
      };
      putCustomLesson(lesson);
      await navigate({
        to: "/studio/$trackId/$lessonId",
        params: { trackId: "custom", lessonId: lesson.id },
      });
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Ada could not create that lesson. Try a more specific topic.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background paper-grain">
      <header className="mx-auto flex max-w-7xl items-center gap-3 px-5 py-4 md:px-8">
        <Link to="/" className="flex items-center gap-2 text-sm font-semibold">
          <ArrowLeft className="h-4 w-4" />
          Home
        </Link>
        <div className="mx-auto flex items-center gap-2">
          <img src={logo} alt="" className="h-8 w-8" />
          <span className="font-display font-bold">CodeCraft Studio</span>
        </div>
        <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold">
          {progress.xp} XP
        </span>
      </header>
      <main className="mx-auto max-w-7xl px-5 py-8 md:px-8">
        {progress.last && (
          <Link
            to="/studio/$trackId/$lessonId"
            params={{ trackId: progress.last.trackId, lessonId: progress.last.lessonId }}
            className="mb-8 flex items-center gap-4 rounded-2xl border bg-card p-5 shadow-soft"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Play className="h-5 w-5" fill="currentColor" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Pick up where you left off
              </div>
              <div className="font-display mt-1 truncate text-xl font-bold">
                {progress.last.title}
              </div>
            </div>
            <ArrowRight className="h-5 w-5" />
          </Link>
        )}

        <section className="relative overflow-hidden rounded-3xl border bg-card p-6 shadow-soft md:p-9">
          <div className="max-w-3xl">
            <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[.15em] text-muted-foreground">
              <Sparkles className="h-4 w-4 text-accent" />A lesson made just for you
            </div>
            <h1 className="font-display text-3xl font-extrabold md:text-5xl">
              What do you want to build today?
            </h1>
            <p className="mt-3 text-muted-foreground">
              Describe any web development topic or project. Ada will design a guided build,
              practice session, code quiz and challenge.
            </p>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void generate();
              }}
              className="mt-6"
            >
              <label htmlFor="lesson-prompt" className="sr-only">
                Lesson topic
              </label>
              <textarea
                id="lesson-prompt"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="For example: teach me JavaScript array methods by building a small movie watchlist…"
                className="h-28 w-full resize-none rounded-xl border bg-background p-4 text-base outline-none focus:ring-2 focus:ring-ring"
              />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs text-muted-foreground">
                  Best for HTML, CSS, JavaScript, React, Vue, Node and Express.
                </span>
                <button
                  type="submit"
                  disabled={busy}
                  className="flex items-center gap-2 rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground disabled:opacity-60"
                >
                  {busy ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  {busy ? "Ada is designing your lesson…" : "Create my interactive lesson"}
                </button>
              </div>
              {error && (
                <p
                  role="alert"
                  className="mt-3 rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
                >
                  {error}
                </p>
              )}
            </form>
          </div>
          <img
            src={teacher}
            alt="Ada the AI teacher"
            className="float-y absolute -right-3 bottom-2 hidden h-40 w-40 lg:block"
          />
        </section>

        {custom.length > 0 && (
          <section className="mt-12">
            <h2 className="font-display text-2xl font-bold">Your custom lessons</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {custom.map((lesson) => (
                <LessonLink
                  key={lesson.id}
                  trackId="custom"
                  lesson={lesson}
                  done={`custom/${lesson.id}` in progress.completed}
                />
              ))}
            </div>
          </section>
        )}

        <section className="mt-12 pb-20">
          <div className="mb-5">
            <h2 className="font-display text-2xl font-bold">Guided learning paths</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Every lesson includes a live preview, saved progress and a from-scratch challenge.
            </p>
          </div>
          <div className="space-y-8">
            {tracks.map((track) => (
              <div key={track.id}>
                <div className="mb-3 flex items-center gap-3">
                  <img src={track.image} alt="" className="h-10 w-10 rounded-lg object-cover" />
                  <div>
                    <h3 className="font-display text-lg font-bold">{track.name}</h3>
                    <p className="text-xs text-muted-foreground">{track.tagline}</p>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {track.lessons.map((lesson) => (
                    <LessonLink
                      key={lesson.id}
                      trackId={track.id}
                      lesson={lesson}
                      done={`${track.id}/${lesson.id}` in progress.completed}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

function LessonLink({ trackId, lesson, done }: { trackId: string; lesson: Lesson; done: boolean }) {
  return (
    <Link
      to="/studio/$trackId/$lessonId"
      params={{ trackId, lessonId: lesson.id }}
      className="group flex gap-4 rounded-2xl border bg-card p-5 shadow-soft transition-transform hover:-translate-y-0.5"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary">
        <BookOpen className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <h3 className="font-display font-bold leading-snug">{lesson.title}</h3>
          {done && <Check className="mt-0.5 h-4 w-4 shrink-0 text-pin-praise" />}
        </div>
        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
          {lesson.summary}
        </p>
        <div className="mt-3 flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock3 className="h-3 w-3" />
            {lesson.minutes} min
          </span>
          <span>{lesson.level}</span>
          <span className="ml-auto font-semibold">{lesson.xp} XP</span>
        </div>
      </div>
      <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
    </Link>
  );
}
