import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  Clock3,
  Flame,
  Play,
  Plus,
  Sparkles,
  Trophy,
} from "lucide-react";
import hero from "@/assets/hero-meadow.jpg";
import logo from "@/assets/logo.png";
import teacher from "@/assets/sticker-teacher.png";
import trophy from "@/assets/sticker-trophy.png";
import { tracks } from "@/lib/curriculum";
import { getCustomLessons, getProgress, levelFor, rankFor, type Progress } from "@/lib/progress";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CodeCraft Academy — Learn to code with an AI teacher" },
      {
        name: "description",
        content:
          "A VS Code style learning studio where an AI teacher codes with you, explains every line and grades your work.",
      },
      { property: "og:title", content: "CodeCraft Academy — Your AI coding teacher" },
      {
        property: "og:description",
        content:
          "Learn HTML, CSS, JavaScript, React, Vue, Node and Express by building real projects with Ada.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const [progress, setProgress] = useState<Progress>({
    xp: 0,
    completed: {},
    streak: 0,
    badges: [],
  });
  const [customCount, setCustomCount] = useState(0);
  useEffect(() => {
    setProgress(getProgress());
    setCustomCount(getCustomLessons().length);
    const sync = () => setProgress(getProgress());
    window.addEventListener("codecraft:progress", sync);
    return () => window.removeEventListener("codecraft:progress", sync);
  }, []);
  const level = levelFor(progress.xp);
  const completeCount = Object.keys(progress.completed).length;

  return (
    <div className="min-h-screen bg-background paper-grain">
      <header className="mx-auto flex max-w-7xl items-center gap-3 px-5 py-4 md:px-8">
        <Link to="/" className="flex items-center gap-2.5">
          <img src={logo} alt="CodeCraft logo" width={40} height={40} className="h-10 w-10" />
          <span className="font-display text-xl font-bold">CodeCraft Academy</span>
        </Link>
        <nav className="ml-auto flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/studio">
              <Plus />
              New project
            </Link>
          </Button>
          <Link
            to="/studio"
            className="hidden rounded-lg px-4 py-2 text-sm font-semibold hover:bg-secondary sm:block"
          >
            Lesson library
          </Link>
          {progress.last ? (
            <Link
              to="/studio/$trackId/$lessonId"
              params={{ trackId: progress.last.trackId, lessonId: progress.last.lessonId }}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              <Play className="h-4 w-4" fill="currentColor" />
              Continue
            </Link>
          ) : (
            <Link
              to="/studio"
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              Open studio
              <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </nav>
      </header>

      <main>
        <section className="mx-auto grid max-w-7xl items-center gap-10 px-5 py-10 md:px-8 md:py-16 lg:grid-cols-[1.02fr_.98fr]">
          <div className="relative">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs font-semibold shadow-soft">
              <Sparkles className="h-3.5 w-3.5 text-accent" />A patient teacher. A real coding
              workspace.
            </div>
            <h1 className="font-display text-5xl font-extrabold leading-[1.04] md:text-6xl lg:text-7xl">
              Learn to code with a teacher who{" "}
              <span className="crayon-underline">codes beside you</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
              Watch Ada build line by line, repeat it yourself, answer questions pinned to your
              code, then rebuild from scratch and earn your score.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                to={progress.last ? "/studio/$trackId/$lessonId" : "/studio/$trackId/$lessonId"}
                params={
                  progress.last
                    ? { trackId: progress.last.trackId, lessonId: progress.last.lessonId }
                    : { trackId: "html", lessonId: "first-page" }
                }
                className="flex items-center gap-2 rounded-xl bg-primary px-6 py-3.5 font-semibold text-primary-foreground shadow-soft transition-transform hover:-translate-y-0.5"
              >
                <Play className="h-4 w-4" fill="currentColor" />
                {progress.last ? "Continue your lesson" : "Start your first lesson"}
              </Link>
              <Link
                to="/studio"
                className="flex items-center gap-2 rounded-xl border bg-card px-5 py-3.5 font-semibold shadow-soft"
              >
                <Plus className="h-4 w-4" />
                Create a lesson with Ada
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Check className="h-4 w-4 text-pin-praise" />
                Real VS Code-style editor
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="h-4 w-4 text-pin-praise" />
                Progress saved automatically
              </span>
            </div>
            <img
              src={teacher}
              alt="Ada the robot teacher"
              width={110}
              height={110}
              className="float-y absolute -bottom-24 right-2 hidden h-24 w-24 lg:block"
            />
          </div>
          <div className="relative">
            <div className="overflow-hidden rounded-[2rem] border-4 border-card bg-card shadow-soft rotate-1">
              <img
                src={hero}
                alt="Child flying a kite made of code through a meadow"
                width={1536}
                height={864}
                className="aspect-[4/3] w-full object-cover"
              />
            </div>
            <div className="absolute -bottom-5 -left-3 flex items-center gap-3 rounded-2xl border bg-card p-3 pr-5 shadow-soft md:-left-8">
              <img src={trophy} alt="" className="h-14 w-14" />
              <div>
                <div className="font-display text-sm font-bold">Learning feels like making</div>
                <div className="text-xs text-muted-foreground">Build, experiment, understand.</div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-10 md:px-8">
          <div className="grid overflow-hidden rounded-2xl border bg-card shadow-soft sm:grid-cols-2 lg:grid-cols-4">
            <ProgressStat
              icon={Trophy}
              label={rankFor(level.level)}
              value={`Level ${level.level}`}
            />
            <ProgressStat icon={Sparkles} label="Total experience" value={`${progress.xp} XP`} />
            <ProgressStat icon={BookOpen} label="Lessons completed" value={String(completeCount)} />
            <ProgressStat
              icon={Flame}
              label="Current streak"
              value={`${progress.streak} ${progress.streak === 1 ? "day" : "days"}`}
            />
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-accent transition-all"
              style={{ width: `${Math.min(100, (level.into / level.span) * 100)}%` }}
            />
          </div>
          <p className="mt-2 text-right text-xs text-muted-foreground">
            {level.span - level.into} XP until level {level.level + 1}
          </p>
        </section>

        <section className="mx-auto max-w-7xl px-5 pb-24 pt-6 md:px-8">
          <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
            <div>
              <span className="text-xs font-bold uppercase tracking-[.16em] text-muted-foreground">
                Choose your next project
              </span>
              <h2 className="font-display mt-1 text-3xl font-bold md:text-4xl">
                Learning paths for curious minds
              </h2>
            </div>
            <Link to="/studio" className="flex items-center gap-1 text-sm font-semibold">
              View all lessons{customCount ? ` and ${customCount} custom` : ""}
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {tracks.map((track) => (
              <article
                key={track.id}
                className="group overflow-hidden rounded-2xl border bg-card shadow-soft transition-transform hover:-translate-y-1"
              >
                <div className="relative overflow-hidden">
                  <img
                    src={track.image}
                    alt=""
                    loading="lazy"
                    className="h-32 w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <span className="absolute bottom-3 left-3 rounded-full bg-card/95 px-3 py-1 font-display text-sm font-bold shadow-sm">
                    {track.name}
                  </span>
                </div>
                <div className="p-4">
                  <p className="text-sm text-muted-foreground">{track.tagline}</p>
                  <ul className="mt-4 space-y-2">
                    {track.lessons.map((lesson) => {
                      const done = `${track.id}/${lesson.id}` in progress.completed;
                      return (
                        <li key={lesson.id}>
                          <Link
                            to="/studio/$trackId/$lessonId"
                            params={{ trackId: track.id, lessonId: lesson.id }}
                            className="flex items-center gap-2 rounded-lg border p-3 transition-colors hover:bg-secondary"
                          >
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center gap-1.5 text-sm font-semibold">
                                {done && <Check className="h-3.5 w-3.5 shrink-0 text-pin-praise" />}
                                <span className="truncate">{lesson.title}</span>
                              </span>
                              <span className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                                <Clock3 className="h-3 w-3" />
                                {lesson.minutes} min · {lesson.level}
                              </span>
                            </span>
                            <span className="shrink-0 text-xs font-semibold text-muted-foreground">
                              {lesson.xp} XP
                            </span>
                            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
      <footer className="border-t bg-card">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-5 py-8 md:px-8">
          <img src={logo} alt="" className="h-8 w-8" />
          <span className="font-display font-bold">CodeCraft Academy</span>
          <span className="text-sm text-muted-foreground">
            Understand every line. Build with confidence.
          </span>
          <Link to="/studio" className="ml-auto text-sm font-semibold">
            Open the studio
            <ArrowRight className="ml-1 inline h-4 w-4" />
          </Link>
        </div>
      </footer>
    </div>
  );
}

function ProgressStat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Trophy;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 border-b p-5 last:border-0 sm:border-r lg:border-b-0">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary">
        <Icon className="h-5 w-5 text-accent" />
      </div>
      <div>
        <div className="font-display text-xl font-bold">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}
