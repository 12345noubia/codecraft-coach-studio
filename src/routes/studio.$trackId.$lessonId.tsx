import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BookOpen,
  Bot,
  Braces,
  Check,
  CheckCircle2,
  ChevronLeft,
  CircleHelp,
  Code2,
  Eye,
  FileCode2,
  Files,
  Flame,
  Gauge,
  GraduationCap,
  Lightbulb,
  ListTree,
  LoaderCircle,
  Map,
  Menu,
  MessageSquare,
  PanelLeftClose,
  Pause,
  Play,
  RotateCcw,
  Send,
  Server,
  Sparkles,
  SquareArrowOutUpRight,
  Trophy,
  X,
  Zap,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import logo from "@/assets/logo.png";
import teacher from "@/assets/sticker-teacher.png";
import { CodeEditor, type Overlay } from "@/components/ide/CodeEditor";
import { CommentBubble } from "@/components/ide/Bubble";
import { FileIcon } from "@/components/ide/FileIcon";
import { FileExplorer } from "@/components/studio/FileExplorer";
import { PreviewPane, ApiClient, type Device } from "@/components/studio/PreviewPane";
import { TerminalPanel, type TerminalTab } from "@/components/studio/TerminalPanel";
import { Achievements, Celebration } from "@/components/studio/Celebration";
import {
  findLesson,
  referenceFiles,
  referenceFolders,
  type Lesson,
  type Track,
} from "@/lib/curriculum";
import { findConnections } from "@/lib/runtime";
import { askTeacher } from "@/lib/teacher.functions";
import {
  addXp,
  getCustomLessons,
  getLessonSave,
  getProgress,
  levelFor,
  putLessonSave,
  rankFor,
  saveProgress,
  touchStreak,
  type LessonSave,
  type Phase,
  type Progress,
  type ReviewComment,
} from "@/lib/progress";
import {
  blankPractice,
  expectedPaths,
  initialActiveFile,
  inspectFiles,
  localComments,
  manualEditPhase,
  normalizePath,
  safeComments,
  similarity,
  validNewPath,
  watchThrough,
  type LogEntry,
} from "@/lib/studio";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/studio/$trackId/$lessonId")({
  head: ({ params }) => {
    const found = findLesson(params.trackId, params.lessonId);
    const title = found
      ? `${found.lesson.title} — CodeCraft Studio`
      : "Your coding lesson — CodeCraft Studio";
    const description =
      found?.lesson.summary ?? "Learn by building with Ada, your interactive AI coding teacher.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: StudioRoute,
});

type ChatMessage = { role: "user" | "teacher"; text: string };
type WorkspaceTab = "code" | "preview" | "connections" | "api";
type TeacherTab = "lesson" | "chat";

function StudioRoute() {
  const { trackId, lessonId } = Route.useParams();
  const found = findLesson(trackId, lessonId);
  if (found)
    return <Studio key={`${trackId}/${lessonId}`} track={found.track} lesson={found.lesson} />;
  if (trackId === "custom") return <CustomStudio lessonId={lessonId} />;
  return <Navigate to="/studio" replace />;
}

function CustomStudio({ lessonId }: { lessonId: string }) {
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    setLesson(getCustomLessons().find((item) => item.id === lessonId) ?? null);
    setChecked(true);
  }, [lessonId]);
  if (!checked) return <StudioLoading />;
  if (!lesson) return <Navigate to="/studio" replace />;
  const track: Track = {
    id: "custom",
    name: "Custom lesson",
    tagline: "Designed by Ada for you",
    color: "react",
    image: "",
    lessons: [lesson],
  };
  return <Studio key={lesson.id} track={track} lesson={lesson} />;
}

function StudioLoading() {
  return (
    <div className="flex h-screen items-center justify-center bg-ide-bg text-ide-fg">
      <LoaderCircle className="mr-2 h-5 w-5 animate-spin" />
      Opening your saved lesson…
    </div>
  );
}

function Studio({ track, lesson }: { track: Track; lesson: Lesson }) {
  const ask = useServerFn(askTeacher);
  const reference = useMemo(() => referenceFiles(lesson), [lesson]);
  const [files, setFiles] = useState<Record<string, string>>(() => blankPractice(lesson));
  const [folders, setFolders] = useState<string[]>([]);
  const [activeFile, setActiveFile] = useState(() => initialActiveFile(lesson));
  const [phase, setPhase] = useState<Phase>("watch");
  const [stepIndex, setStepIndex] = useState(0);
  const [lineIndex, setLineIndex] = useState(0);
  const [typed, setTyped] = useState("");
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [comments, setComments] = useState<ReviewComment[]>([]);
  const [reviewScore, setReviewScore] = useState<number | undefined>();
  const [challengeScore, setChallengeScore] = useState<number | undefined>();
  const [reviewSummary, setReviewSummary] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [activeComment, setActiveComment] = useState<string | null>(null);
  const [busy, setBusy] = useState<"review" | "grade" | "hint" | "chat" | string | null>(null);
  const [teacherError, setTeacherError] = useState("");
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>("code");
  const [device, setDevice] = useState<Device>("desktop");
  const [terminalTab, setTerminalTab] = useState<TerminalTab>("terminal");
  const [terminalOpen, setTerminalOpen] = useState(true);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [followLine, setFollowLine] = useState<number | undefined>();
  const [cursor, setCursor] = useState({ line: 1, col: 1 });
  const [teacherTab, setTeacherTab] = useState<TeacherTab>("lesson");
  const [chat, setChat] = useState<ChatMessage[]>([
    {
      role: "teacher",
      text: `Welcome to **${lesson.title}**. I will build the example with you, explain the important lines, and help you improve your own version.`,
    },
  ]);
  const [question, setQuestion] = useState("");
  const [progress, setProgress] = useState<Progress>({
    xp: 0,
    completed: {},
    streak: 0,
    badges: [],
  });
  const [achievementsOpen, setAchievementsOpen] = useState(false);
  const [celebrationOpen, setCelebrationOpen] = useState(false);
  const [awardedXp, setAwardedXp] = useState(0);
  const [explorerOpen, setExplorerOpen] = useState(false);
  const [teacherOpen, setTeacherOpen] = useState(false);
  const [restored, setRestored] = useState(false);
  const logId = useRef(0);
  const restoredLesson = useRef("");

  const addLog = useCallback((entry: Omit<LogEntry, "id">) => {
    setLogs((old) => [...old.slice(-149), { ...entry, id: ++logId.current }]);
  }, []);

  useEffect(() => {
    if (restoredLesson.current === `${track.id}/${lesson.id}`) return;
    restoredLesson.current = `${track.id}/${lesson.id}`;
    const saved = getLessonSave(track.id, lesson.id);
    if (saved) {
      setFiles(saved.files);
      setFolders(saved.folders);
      setPhase(saved.phase);
      setStepIndex(Math.min(saved.stepIndex, lesson.steps.length));
      setLineIndex(saved.lineIndex ?? 0);
      setTyped(saved.typed ?? "");
      setComments(saved.comments);
      setReviewScore(saved.reviewScore);
      setChallengeScore(saved.challengeScore);
      setActiveFile((current) =>
        current in saved.files
          ? current
          : (Object.keys(saved.files)[0] ?? initialActiveFile(lesson)),
      );
      addLog({
        level: "info",
        source: "studio",
        text: `Restored your ${saved.phase} session from ${new Date(saved.updatedAt).toLocaleString()}.`,
      });
      toast.success("Your lesson is right where you left it");
    } else {
      addLog({
        level: "info",
        source: "studio",
        text: `Workspace ready for ${lesson.title}. Press Watch AI teach to begin.`,
      });
    }
    const current = getProgress();
    setProgress(current);
    saveProgress({
      ...current,
      last: { trackId: track.id, lessonId: lesson.id, title: lesson.title },
    });
    setRestored(true);
  }, [addLog, lesson, track.id]);

  useEffect(() => {
    if (!restored) return;
    const save: LessonSave = {
      phase,
      stepIndex,
      lineIndex,
      typed,
      files,
      folders,
      comments,
      questionPoints: comments.reduce((sum, comment) => sum + (comment.verdict ? 1 : 0), 0),
      updatedAt: Date.now(),
      ...(reviewScore !== undefined ? { reviewScore } : {}),
      ...(challengeScore !== undefined ? { challengeScore } : {}),
    };
    const persist = () => putLessonSave(track.id, lesson.id, save);
    const timer = window.setTimeout(persist, 180);
    window.addEventListener("pagehide", persist);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pagehide", persist);
      persist();
    };
  }, [
    challengeScore,
    comments,
    files,
    folders,
    lineIndex,
    lesson.id,
    phase,
    restored,
    reviewScore,
    stepIndex,
    track.id,
    typed,
  ]);

  useEffect(() => {
    const sync = () => setProgress(getProgress());
    window.addEventListener("codecraft:progress", sync);
    return () => window.removeEventListener("codecraft:progress", sync);
  }, []);

  const currentStep = lesson.steps[stepIndex];
  const currentLine = currentStep?.kind === "type" ? currentStep.lines[lineIndex] : undefined;
  const currentCode = activeFile ? (files[activeFile] ?? "") : "";
  const localScore = useMemo(() => similarity(files, reference), [files, reference]);
  const problems = useMemo(() => inspectFiles(files), [files]);
  const connections = useMemo(() => findConnections(files), [files]);
  const level = levelFor(progress.xp);
  const lessonKey = `${track.id}/${lesson.id}`;
  const isCompleted = lessonKey in progress.completed;

  useEffect(() => {
    if (!playing || phase !== "watch") return;
    const step = lesson.steps[stepIndex];
    if (!step) {
      setPlaying(false);
      addLog({
        level: "info",
        source: "studio",
        text: "Guided build complete. Your turn is ready when you are.",
      });
      return;
    }
    let timer: number | undefined;
    if (step.kind === "file" || step.kind === "folder") {
      timer = window.setTimeout(() => {
        if (step.kind === "file") {
          setFiles((old) => ({ ...old, [step.path]: old[step.path] ?? "" }));
          setActiveFile(step.path);
          addLog({ level: "info", source: "studio", text: `Created ${step.path}` });
        } else {
          setFolders((old) => (old.includes(step.path) ? old : [...old, step.path]));
          addLog({ level: "info", source: "studio", text: `Created folder ${step.path}/` });
        }
        setStepIndex((index) => index + 1);
        setLineIndex(0);
        setTyped("");
      }, 650 / speed);
    } else if (step.kind === "preview") {
      timer = window.setTimeout(() => {
        setWorkspaceTab("preview");
        setStepIndex((index) => index + 1);
      }, 1400 / speed);
    } else {
      setActiveFile(step.path);
      setWorkspaceTab("code");
      const line = step.lines[lineIndex];
      if (!line) {
        timer = window.setTimeout(() => {
          setStepIndex((index) => index + 1);
          setLineIndex(0);
          setTyped("");
        }, 700 / speed);
      } else if (typed.length < line.code.length) {
        timer = window.setTimeout(
          () => {
            const next = line.code.slice(0, typed.length + 1);
            setFiles((old) => {
              const existing = old[step.path] ?? "";
              const base =
                typed && existing.endsWith(typed) ? existing.slice(0, -typed.length) : existing;
              const separator = base && !base.endsWith("\n") ? "\n" : "";
              return { ...old, [step.path]: base + separator + next };
            });
            setTyped(next);
          },
          Math.max(8, 32 / speed),
        );
      } else {
        timer = window.setTimeout(
          () => {
            setLineIndex((index) => index + 1);
            setTyped("");
          },
          Math.max(100, 520 / speed),
        );
      }
    }
    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [addLog, lineIndex, lesson.steps, phase, playing, speed, stepIndex, typed]);

  const startWatch = () => {
    if (busy) return;
    if (
      Object.values(files).some((code) => code.trim()) &&
      !window.confirm("Restart Ada's example? This replaces the current workspace.")
    )
      return;
    setFiles({});
    setFolders([]);
    setComments([]);
    setReviewScore(undefined);
    setChallengeScore(undefined);
    setPhase("watch");
    setStepIndex(0);
    setLineIndex(0);
    setTyped("");
    setPlaying(true);
    setWorkspaceTab("code");
  };

  const stepForward = () => {
    setPlaying(false);
    const step = lesson.steps[stepIndex];
    if (!step) return;
    if (step.kind === "folder") {
      setFolders((old) => (old.includes(step.path) ? old : [...old, step.path]));
      setStepIndex((index) => index + 1);
    } else if (step.kind === "file") {
      setFiles((old) => ({ ...old, [step.path]: old[step.path] ?? "" }));
      setActiveFile(step.path);
      setStepIndex((index) => index + 1);
    } else if (step.kind === "preview") {
      setWorkspaceTab("preview");
      setStepIndex((index) => index + 1);
    } else if (step.lines[lineIndex]) {
      const line = step.lines[lineIndex];
      if (!line) return;
      setActiveFile(step.path);
      setWorkspaceTab("code");
      setFiles((old) => {
        const existing = old[step.path] ?? "";
        const base =
          typed && existing.endsWith(typed) ? existing.slice(0, -typed.length) : existing;
        return {
          ...old,
          [step.path]: base + (base && !base.endsWith("\n") ? "\n" : "") + line.code,
        };
      });
      setLineIndex((index) => index + 1);
      setTyped("");
    } else {
      setStepIndex((index) => index + 1);
      setLineIndex(0);
    }
  };

  const stepBack = () => {
    setPlaying(false);
    const target = Math.max(0, stepIndex - 1);
    const built = watchThrough(lesson, target);
    setFiles(built.files);
    setFolders(built.folders);
    setStepIndex(target);
    setLineIndex(0);
    setTyped("");
    const step = lesson.steps[target];
    if (step && "path" in step) setActiveFile(step.path);
  };

  const startRepeat = () => {
    if (
      Object.values(files).some((code) => code.trim()) &&
      !window.confirm("Start with empty practice files? This replaces the current code.")
    )
      return;
    setPlaying(false);
    setPhase("repeat");
    setFiles(blankPractice(lesson));
    setFolders(referenceFolders(lesson));
    setComments([]);
    setReviewScore(undefined);
    setChallengeScore(undefined);
    setReviewSummary("");
    setActiveFile(initialActiveFile(lesson));
    setWorkspaceTab("code");
    addLog({
      level: "info",
      source: "studio",
      text: "Your turn: the expected files are ready, but their code is yours to write.",
    });
  };

  const teacherPayload = () => ({
    lessonTitle: lesson.title,
    goal: phase === "challenge" ? lesson.challenge : lesson.practice,
    reference,
    files,
    history: chat.slice(-12),
  });

  const reviewCode = async () => {
    if (busy) return;
    if (!Object.values(files).some((content) => content.trim())) {
      toast.error("Write your solution before asking Ada to review it");
      return;
    }
    setPhase("review");
    setPlaying(false);
    const starterComments = localComments(lesson);
    setComments(starterComments);
    setActiveComment(
      starterComments.find((comment) => comment.type === "question")?.id ??
        starterComments[0]?.id ??
        null,
    );
    setTeacherTab("lesson");
    setTeacherError("");
    setBusy("review");
    try {
      const result = await ask({
        data: { mode: "review", ...teacherPayload(), question: "", answer: "", line: "" },
      });
      if (!result.ok) throw new Error(result.error);
      const parsed = JSON.parse(result.json) as { score?: number; summary?: string };
      const aiComments = safeComments(parsed, files);
      const localQuestions = localComments(lesson).filter((comment) => comment.type === "question");
      const nextComments = [
        ...aiComments,
        ...(aiComments.some((comment) => comment.type === "question") ? [] : localQuestions),
      ];
      setComments(nextComments);
      setActiveComment(
        nextComments.find((comment) => comment.type === "question")?.id ??
          nextComments[0]?.id ??
          null,
      );
      if (typeof parsed.score === "number")
        setReviewScore(Math.max(0, Math.min(100, Math.round(parsed.score))));
      setReviewSummary(
        parsed.summary ??
          "Ada reviewed your implementation. Open the pinned comments to explore her feedback.",
      );
      toast.success("Ada pinned her review to your code");
    } catch (error) {
      setTeacherError(error instanceof Error ? error.message : "Ada could not review this yet.");
      setReviewSummary(
        "Your local check and practice questions are ready. Ada's detailed review could not be loaded.",
      );
    } finally {
      setBusy(null);
    }
  };

  const startChallenge = () => {
    if (busy) return;
    setPlaying(false);
    setPhase("challenge");
    setFiles({});
    setFolders([]);
    setComments([]);
    setChallengeScore(undefined);
    setReviewSummary("");
    setActiveFile("");
    setWorkspaceTab("code");
    addLog({
      level: "info",
      source: "studio",
      text: "Challenge started with a completely empty workspace.",
    });
  };

  const gradeChallenge = async () => {
    if (busy) return;
    if (!Object.values(files).some((content) => content.trim())) {
      toast.error("Create at least one file and write your solution first");
      return;
    }
    setBusy("grade");
    setTeacherError("");
    try {
      const result = await ask({
        data: { mode: "grade", ...teacherPayload(), question: "", answer: "", line: "" },
      });
      if (!result.ok) throw new Error(result.error);
      const parsed = JSON.parse(result.json) as { score?: number; summary?: string };
      const score = Math.max(
        0,
        Math.min(100, Math.round(typeof parsed.score === "number" ? parsed.score : 0)),
      );
      setChallengeScore(score);
      setComments(safeComments(parsed, files));
      const strengths =
        "strengths" in parsed && Array.isArray(parsed.strengths)
          ? parsed.strengths.filter((x): x is string => typeof x === "string")
          : [];
      const improvements =
        "improvements" in parsed && Array.isArray(parsed.improvements)
          ? parsed.improvements.filter((x): x is string => typeof x === "string")
          : [];
      setReviewSummary(
        [
          parsed.summary,
          strengths.length ? `What worked: ${strengths.join(" ")}` : "",
          improvements.length ? `Next step: ${improvements.join(" ")}` : "",
        ]
          .filter(Boolean)
          .join("\n\n"),
      );
      setWorkspaceTab("code");
      toast.success(
        score >= 70
          ? "Challenge passed. Your lesson is ready to complete."
          : "Ada left specific feedback to improve your build.",
      );
    } catch (error) {
      setTeacherError(error instanceof Error ? error.message : "Ada could not grade this yet.");
    } finally {
      setBusy(null);
    }
  };

  const answerQuiz = async (comment: ReviewComment) => {
    if (busy) return;
    const answer = (answers[comment.id] ?? "").trim();
    if (!answer) {
      toast.error("Write your explanation first");
      return;
    }
    if (comment.verdict) return;
    setBusy(comment.id);
    setTeacherError("");
    try {
      const codeLine =
        (files[comment.file] ?? reference[comment.file] ?? "").split("\n")[comment.line - 1] ?? "";
      const result = await ask({
        data: {
          mode: "answer",
          ...teacherPayload(),
          question: comment.question ?? comment.message,
          answer,
          line: codeLine,
        },
      });
      if (!result.ok) throw new Error(result.error);
      const parsed = JSON.parse(result.json) as {
        verdict?: string;
        points?: number;
        feedback?: string;
        exercise?: string;
      };
      const verdict =
        parsed.verdict === "understood" ||
        parsed.verdict === "partial" ||
        parsed.verdict === "confused"
          ? parsed.verdict
          : "partial";
      const points = Math.max(
        0,
        Math.min(10, Math.round(typeof parsed.points === "number" ? parsed.points : 0)),
      );
      setComments((old) =>
        old.map((item) =>
          item.id === comment.id
            ? {
                ...item,
                answer,
                verdict,
                feedback: parsed.feedback ?? "Thanks for explaining your thinking.",
                exercise: parsed.exercise ?? "",
              }
            : item,
        ),
      );
      const updated = addXp(points, "Curious mind");
      setProgress(updated);
      toast.success(`${points} XP earned for your explanation`);
    } catch (error) {
      setTeacherError(
        error instanceof Error ? error.message : "Ada could not check this answer yet.",
      );
    } finally {
      setBusy(null);
    }
  };

  const sendChat = async (text = question) => {
    if (busy) return;
    const clean = text.trim();
    if (!clean) return;
    const contextLine = currentCode.split("\n")[cursor.line - 1] ?? "";
    const outgoing = activeFile
      ? `${clean}\n\nContext: ${activeFile}, line ${cursor.line}: ${contextLine}`
      : clean;
    const nextChat: ChatMessage[] = [...chat, { role: "user", text: clean }];
    setChat(nextChat);
    setQuestion("");
    setTeacherTab("chat");
    setBusy("chat");
    setTeacherError("");
    try {
      const result = await ask({
        data: {
          mode: "chat",
          ...teacherPayload(),
          history: nextChat.slice(-12),
          question: outgoing,
          answer: "",
          line: contextLine,
        },
      });
      if (!result.ok) throw new Error(result.error);
      const parsed = JSON.parse(result.json) as { text?: string };
      setChat((old) => [
        ...old,
        { role: "teacher", text: parsed.text ?? "I could not generate an explanation this time." },
      ]);
    } catch (error) {
      setTeacherError(error instanceof Error ? error.message : "Ada could not answer yet.");
    } finally {
      setBusy(null);
    }
  };

  const getHint = async () => {
    if (busy) return;
    setBusy("hint");
    setTeacherError("");
    try {
      const result = await ask({
        data: { mode: "hint", ...teacherPayload(), question: "", answer: "", line: "" },
      });
      if (!result.ok) throw new Error(result.error);
      const parsed = JSON.parse(result.json) as { text?: string };
      setChat((old) => [
        ...old,
        {
          role: "teacher",
          text: `**Hint:** ${parsed.text ?? "Compare your current line with the lesson goal."}`,
        },
      ]);
      setTeacherTab("chat");
    } catch (error) {
      setTeacherError(error instanceof Error ? error.message : "A hint is not available yet.");
    } finally {
      setBusy(null);
    }
  };

  const completeLesson = () => {
    if (challengeScore === undefined || challengeScore < 70) return;
    const previous = getProgress();
    const firstCompletion = !(lessonKey in previous.completed);
    const earned = firstCompletion ? lesson.xp + Math.round(challengeScore / 2) : 0;
    let updated = firstCompletion ? addXp(earned, "First steps") : touchStreak(previous);
    updated = {
      ...updated,
      completed: {
        ...updated.completed,
        [lessonKey]: Math.max(challengeScore, updated.completed[lessonKey] ?? 0),
      },
      last: { trackId: track.id, lessonId: lesson.id, title: lesson.title },
      badges: updated.badges.includes("Challenge accepted")
        ? updated.badges
        : [...updated.badges, "Challenge accepted"],
    };
    saveProgress(updated);
    setProgress(updated);
    setAwardedXp(earned);
    setPhase("done");
    setCelebrationOpen(true);
  };

  const createPath = (kind: "file" | "folder", rawPath: string) => {
    if (playing || busy)
      return "Pause Ada and wait for the current response before changing files.";
    const path = normalizePath(rawPath);
    const error = validNewPath(path, files, folders, kind === "folder");
    if (error) return error;
    setChallengeScore(undefined);
    setReviewScore(undefined);
    setComments([]);
    if (kind === "folder") setFolders((old) => [...old, path]);
    else {
      setFiles((old) => ({ ...old, [path]: "" }));
      setActiveFile(path);
      setWorkspaceTab("code");
      addLog({ level: "info", source: "studio", text: `Created ${path}` });
    }
    return null;
  };

  const deletePath = (path: string, kind: "file" | "folder") => {
    if (playing || busy) return;
    if (!window.confirm(`Delete ${path}${kind === "folder" ? " and everything inside it" : ""}?`))
      return;
    setChallengeScore(undefined);
    setReviewScore(undefined);
    setComments([]);
    if (kind === "folder") {
      setFolders((old) => old.filter((item) => item !== path && !item.startsWith(path + "/")));
      setFiles((old) =>
        Object.fromEntries(Object.entries(old).filter(([name]) => !name.startsWith(path + "/"))),
      );
      if (activeFile.startsWith(path + "/")) setActiveFile("");
    } else {
      setFiles((old) => Object.fromEntries(Object.entries(old).filter(([name]) => name !== path)));
      if (activeFile === path)
        setActiveFile(Object.keys(files).find((name) => name !== path) ?? "");
    }
  };

  const jumpToComment = (comment: ReviewComment) => {
    setActiveComment(comment.id);
    setActiveFile(comment.file);
    setWorkspaceTab("code");
    setFollowLine(comment.line);
    window.setTimeout(() => setFollowLine(undefined), 100);
  };

  const overlays: Overlay[] = [];
  if (
    phase === "watch" &&
    currentStep?.kind === "type" &&
    currentStep.path === activeFile &&
    currentLine?.note
  ) {
    overlays.push({
      key: "live-teacher",
      line: Math.max(1, (files[activeFile] ?? "").split("\n").length),
      highlight: "teacher",
      node: (
        <CommentBubble kind="teacher" title="Ada explains">
          {currentLine.note}
        </CommentBubble>
      ),
    });
  }
  comments
    .filter((comment) => comment.file === activeFile)
    .forEach((comment) => {
      overlays.push({
        key: comment.id,
        line: comment.line,
        highlight: comment.type === "teacher" ? "teacher" : comment.type,
        node: (
          <CommentBubble
            kind={comment.type}
            title={
              comment.type === "question"
                ? "Ada asks"
                : comment.type === "issue"
                  ? "Try improving this"
                  : comment.type === "praise"
                    ? "Good work"
                    : "Ada"
            }
            collapsible
            open={activeComment === comment.id}
            onOpenChange={(open) => setActiveComment(open ? comment.id : null)}
          >
            <p>{comment.message}</p>
            {comment.type === "question" && (
              <>
                {comment.question && <p className="mt-2 font-medium">{comment.question}</p>}
                {!comment.verdict ? (
                  <div className="mt-2">
                    <textarea
                      aria-label={`Answer Ada's question on line ${comment.line}`}
                      value={answers[comment.id] ?? ""}
                      onChange={(event) =>
                        setAnswers((old) => ({ ...old, [comment.id]: event.target.value }))
                      }
                      placeholder="Explain your thinking…"
                      className="min-h-16 w-full resize-y rounded-md border bg-background p-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
                    />
                    <button
                      type="button"
                      disabled={busy === comment.id}
                      onClick={() => void answerQuiz(comment)}
                      className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground disabled:opacity-50"
                    >
                      {busy === comment.id ? (
                        <LoaderCircle className="h-3 w-3 animate-spin" />
                      ) : (
                        <Send className="h-3 w-3" />
                      )}
                      Check my answer
                    </button>
                  </div>
                ) : (
                  <div className="mt-2 rounded-md bg-secondary p-2">
                    <div className="mb-1 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {comment.verdict}
                    </div>
                    <p>{comment.feedback}</p>
                    {comment.exercise && (
                      <p className="mt-2 border-t pt-2">
                        <strong>Try this:</strong> {comment.exercise}
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
          </CommentBubble>
        ),
      });
    });

  const phaseLabel =
    phase === "watch"
      ? "Watch"
      : phase === "repeat"
        ? "Your turn"
        : phase === "review"
          ? "Code quiz"
          : phase === "challenge"
            ? "Challenge"
            : "Complete";
  const activeLine = Math.max(1, currentCode.split("\n").length);

  return (
    <div className="flex h-[100dvh] min-h-[540px] flex-col overflow-hidden bg-ide-bg font-sans text-ide-fg">
      <header className="flex h-11 shrink-0 items-center border-b border-ide-border bg-ide-bar px-2 text-xs">
        <Link
          to="/"
          className="mr-2 flex items-center gap-2 rounded px-1.5 py-1 hover:bg-ide-hover"
          aria-label="CodeCraft home"
        >
          <img src={logo} alt="" className="h-6 w-6" />
          <span className="hidden font-display text-sm font-bold lg:inline">CodeCraft</span>
        </Link>
        <div className="hidden items-center gap-1 text-ide-muted md:flex">
          <span>File</span>
          <span className="ml-3">Edit</span>
          <span className="ml-3">Selection</span>
          <span className="ml-3">View</span>
          <span className="ml-3">Go</span>
          <span className="ml-3">Run</span>
          <span className="ml-3">Help</span>
        </div>
        <div className="mx-auto flex min-w-0 items-center gap-2 rounded-md bg-ide-panel px-3 py-1 text-ide-muted">
          <FileCode2 className="h-3.5 w-3.5" />
          <span className="truncate">{lesson.title} — CodeCraft Academy</span>
        </div>
        <button
          type="button"
          onClick={() => setAchievementsOpen(true)}
          className="ml-2 flex items-center gap-2 rounded-md px-2 py-1 hover:bg-ide-hover"
          aria-label="Open achievements"
        >
          <Trophy className="h-4 w-4 text-sun" />
          <span className="hidden text-ide-fg sm:inline">Lv. {level.level}</span>
          <span className="hidden text-ide-muted lg:inline">{progress.xp} XP</span>
        </button>
      </header>

      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-ide-border bg-ide-panel px-3">
        <button
          type="button"
          onClick={() => setExplorerOpen((open) => !open)}
          className="rounded p-1.5 hover:bg-ide-hover md:hidden"
          aria-label="Toggle file explorer"
        >
          <Menu className="h-4 w-4" />
        </button>
        <div className="hidden min-w-0 items-center gap-1.5 text-xs text-ide-muted sm:flex">
          <span>{track.name}</span>
          <ChevronLeft className="h-3 w-3 rotate-180" />
          <span className="truncate text-ide-fg">{lesson.title}</span>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          {phase === "watch" && (
            <div className="flex items-center rounded-md border border-ide-border bg-ide-editor p-0.5">
              <button
                type="button"
                onClick={stepBack}
                disabled={stepIndex === 0}
                className="rounded p-1.5 text-ide-muted hover:bg-ide-hover hover:text-ide-fg disabled:opacity-30"
                title="Previous step"
                aria-label="Previous step"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() =>
                  stepIndex >= lesson.steps.length ||
                  (stepIndex === 0 && !Object.values(files).some((code) => code.trim()))
                    ? startWatch()
                    : setPlaying((value) => !value)
                }
                className="flex items-center gap-1.5 rounded bg-ide-blue px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                aria-label={playing ? "Pause lesson" : "Watch AI teach"}
              >
                {playing ? (
                  <Pause className="h-3.5 w-3.5" />
                ) : (
                  <Play className="h-3.5 w-3.5" fill="currentColor" />
                )}
                <span className="hidden sm:inline">
                  {playing ? "Pause" : stepIndex ? "Resume" : "Watch AI teach"}
                </span>
              </button>
              <button
                type="button"
                onClick={stepForward}
                disabled={stepIndex >= lesson.steps.length}
                className="rounded p-1.5 text-ide-muted hover:bg-ide-hover hover:text-ide-fg disabled:opacity-30"
                title="Next step"
                aria-label="Next step"
              >
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          {phase === "watch" && (
            <StudioButton
              onClick={() => {
                setPlaying(false);
                setPhase("repeat");
                setTyped("");
                setWorkspaceTab("code");
              }}
              icon={GraduationCap}
            >
              Your turn
            </StudioButton>
          )}
          {phase !== "watch" && (
            <StudioButton onClick={startWatch} disabled={!!busy} icon={Play}>
              Watch Ada
            </StudioButton>
          )}
          {phase === "repeat" && (
            <StudioButton
              onClick={() => void reviewCode()}
              disabled={!!busy}
              icon={busy === "review" ? LoaderCircle : Sparkles}
            >
              {busy === "review" ? "Reviewing…" : "Review my code"}
            </StudioButton>
          )}
          {phase === "review" && (
            <StudioButton onClick={startChallenge} disabled={!!busy} icon={Zap}>
              From scratch
            </StudioButton>
          )}
          {phase === "challenge" &&
            (challengeScore === undefined || challengeScore < 70 ? (
              <StudioButton
                onClick={() => void gradeChallenge()}
                disabled={busy === "grade"}
                icon={busy === "grade" ? LoaderCircle : Award}
              >
                {busy === "grade" ? "Grading…" : "Grade my build"}
              </StudioButton>
            ) : (
              <StudioButton onClick={completeLesson} icon={Trophy}>
                Complete lesson
              </StudioButton>
            ))}
          {phase === "done" && (
            <span className="flex items-center gap-1.5 rounded-md bg-pin-praise/15 px-3 py-1.5 text-xs font-semibold text-pin-praise">
              <Check className="h-4 w-4" />
              Lesson complete
            </span>
          )}
          {phase === "watch" && (
            <select
              aria-label="Playback speed"
              value={speed}
              onChange={(event) => setSpeed(Number(event.target.value))}
              className="hidden rounded border border-ide-border bg-ide-editor px-2 py-1.5 text-xs text-ide-muted sm:block"
            >
              <option value={0.5}>0.5×</option>
              <option value={1}>1×</option>
              <option value={2}>2×</option>
              <option value={4}>4×</option>
            </select>
          )}
          <button
            type="button"
            onClick={() => setTeacherOpen((open) => !open)}
            className="rounded p-1.5 hover:bg-ide-hover xl:hidden"
            aria-label="Toggle Ada panel"
          >
            <Bot className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="relative grid min-h-0 flex-1 grid-cols-[44px_minmax(0,1fr)] md:grid-cols-[44px_220px_minmax(0,1fr)] xl:grid-cols-[44px_220px_minmax(0,1fr)_330px]">
        <nav
          className="flex flex-col items-center border-r border-ide-border bg-ide-bar py-1"
          aria-label="Studio views"
        >
          <ActivityButton
            label="Explorer"
            active={workspaceTab === "code"}
            onClick={() => {
              setWorkspaceTab("code");
              setExplorerOpen(true);
            }}
            icon={Files}
          />
          <ActivityButton
            label="Live preview"
            active={workspaceTab === "preview"}
            onClick={() => setWorkspaceTab("preview")}
            icon={Eye}
          />
          <ActivityButton
            label="Connections"
            active={workspaceTab === "connections"}
            onClick={() => setWorkspaceTab("connections")}
            icon={ListTree}
          />
          {(lesson.runtime === "node" || lesson.runtime === "fullstack") && (
            <ActivityButton
              label="API client"
              active={workspaceTab === "api"}
              onClick={() => setWorkspaceTab("api")}
              icon={Server}
            />
          )}
          <ActivityButton
            label="Ask Ada"
            active={teacherTab === "chat"}
            onClick={() => {
              setTeacherTab("chat");
              setTeacherOpen(true);
            }}
            icon={MessageSquare}
          />
          <div className="mt-auto">
            <ActivityButton
              label="Achievements"
              onClick={() => setAchievementsOpen(true)}
              icon={Trophy}
            />
          </div>
        </nav>

        <div
          className={cn(
            "min-h-0 max-md:absolute max-md:inset-y-0 max-md:left-11 max-md:z-30 max-md:w-[240px] max-md:border-r max-md:border-ide-border",
            !explorerOpen && "max-md:hidden",
          )}
        >
          <FileExplorer
            files={files}
            folders={folders}
            activeFile={activeFile}
            onSelect={(path) => {
              setActiveFile(path);
              setWorkspaceTab("code");
              setExplorerOpen(false);
            }}
            onCreate={createPath}
            onDelete={deletePath}
          />
        </div>

        <main className="flex min-h-0 min-w-0 flex-col">
          <div className="flex h-10 shrink-0 items-stretch border-b border-ide-border bg-ide-editor">
            <button
              type="button"
              onClick={() => setWorkspaceTab("code")}
              className={cn(
                "flex items-center gap-1.5 border-r border-ide-border px-3 text-xs",
                workspaceTab === "code" ? "bg-ide-panel text-ide-fg" : "text-ide-muted",
              )}
            >
              <Code2 className="h-3.5 w-3.5" />
              Code
            </button>
            <button
              type="button"
              onClick={() => setWorkspaceTab("preview")}
              className={cn(
                "flex items-center gap-1.5 border-r border-ide-border px-3 text-xs",
                workspaceTab === "preview" ? "bg-ide-panel text-ide-fg" : "text-ide-muted",
              )}
            >
              <Eye className="h-3.5 w-3.5" />
              Preview
            </button>
            {(lesson.runtime === "node" || lesson.runtime === "fullstack") && (
              <button
                type="button"
                onClick={() => setWorkspaceTab("api")}
                className={cn(
                  "hidden items-center gap-1.5 border-r border-ide-border px-3 text-xs sm:flex",
                  workspaceTab === "api" ? "bg-ide-panel text-ide-fg" : "text-ide-muted",
                )}
              >
                <Server className="h-3.5 w-3.5" />
                API
              </button>
            )}
            <div className="ml-auto flex items-center gap-2 px-3 text-[11px] text-ide-muted">
              {phase === "repeat" && (
                <span>
                  Match: <strong className="text-ide-fg">{localScore}%</strong>
                </span>
              )}
              <span>{problems.length} problems</span>
            </div>
          </div>

          {workspaceTab === "code" && (
            <>
              <div className="ide-scroll flex h-9 shrink-0 overflow-x-auto border-b border-ide-border bg-ide-editor">
                {Object.keys(files).map((path) => (
                  <button
                    type="button"
                    key={path}
                    onClick={() => setActiveFile(path)}
                    className={cn(
                      "flex shrink-0 items-center gap-2 border-r border-ide-border px-3 text-xs",
                      activeFile === path
                        ? "border-t border-t-ide-blue bg-ide-panel text-ide-fg"
                        : "text-ide-muted hover:bg-ide-hover",
                    )}
                  >
                    <FileIcon path={path} className="h-3.5 w-3.5" />
                    <span>{path.split("/").pop()}</span>
                    {activeFile === path && phase !== "watch" && (
                      <span className="h-1.5 w-1.5 rounded-full bg-ide-muted" />
                    )}
                  </button>
                ))}
              </div>
              <div className="relative min-h-0 flex-1">
                {activeFile ? (
                  <CodeEditor
                    path={activeFile}
                    value={currentCode}
                    readOnly={playing || !!busy}
                    onChange={(value) => {
                      if (playing || busy || value === currentCode) return;
                      setPhase(manualEditPhase(phase));
                      setTyped("");
                      setReviewScore(undefined);
                      setChallengeScore(undefined);
                      setReviewSummary("");
                      setComments([]);
                      setFiles((old) => ({ ...old, [activeFile]: value }));
                    }}
                    overlays={overlays}
                    followLine={playing ? activeLine : followLine}
                    onCursor={(line, col) => setCursor({ line, col })}
                  />
                ) : (
                  <EmptyWorkspace onCreate={() => setExplorerOpen(true)} phase={phase} />
                )}
                {activeFile && phase !== "watch" && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuestion(`Can you explain line ${cursor.line} in ${activeFile}?`);
                      setTeacherTab("chat");
                      setTeacherOpen(true);
                    }}
                    className="absolute bottom-3 right-4 flex items-center gap-1.5 rounded-full border border-ide-border bg-ide-side px-3 py-1.5 text-[11px] text-ide-fg shadow-bubble hover:bg-ide-hover"
                  >
                    <CircleHelp className="h-3.5 w-3.5 text-pin-question" />
                    Ask Ada about line {cursor.line}
                  </button>
                )}
              </div>
            </>
          )}
          {workspaceTab === "preview" && (
            <div className="min-h-0 flex-1">
              <PreviewPane
                runtime={lesson.runtime}
                files={files}
                device={device}
                onDevice={setDevice}
                onLog={addLog}
              />
            </div>
          )}
          {workspaceTab === "connections" && <ConnectionMap connections={connections} />}
          {workspaceTab === "api" && (
            <div className="min-h-0 flex-1">
              <ApiClient files={files} onLog={addLog} />
            </div>
          )}

          <TerminalPanel
            logs={logs}
            problems={problems}
            tab={terminalTab}
            onTab={setTerminalTab}
            onClear={() => setLogs([])}
            expanded={terminalOpen}
            onExpanded={setTerminalOpen}
            onProblem={(problem) => {
              setActiveFile(problem.file);
              setWorkspaceTab("code");
              setFollowLine(problem.line);
              window.setTimeout(() => setFollowLine(undefined), 100);
            }}
          />
        </main>

        <aside
          className={cn(
            "min-h-0 border-l border-ide-border bg-ide-side max-xl:absolute max-xl:inset-y-0 max-xl:right-0 max-xl:z-30 max-xl:w-[330px] max-xl:shadow-bubble",
            !teacherOpen && "max-xl:hidden",
          )}
          aria-label="Ada AI teacher"
        >
          <div className="flex h-10 items-center border-b border-ide-border px-3">
            <img src={teacher} alt="" className="mr-2 h-7 w-7" />
            <div>
              <div className="text-xs font-semibold">Ada</div>
              <div className="flex items-center gap-1 text-[10px] text-ide-muted">
                <span className="h-1.5 w-1.5 rounded-full bg-pin-praise" />
                AI teacher
              </div>
            </div>
            <button
              type="button"
              className="ml-auto rounded p-1 hover:bg-ide-hover xl:hidden"
              onClick={() => setTeacherOpen(false)}
              aria-label="Close Ada panel"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex h-9 border-b border-ide-border">
            <button
              type="button"
              onClick={() => setTeacherTab("lesson")}
              className={cn(
                "flex-1 text-xs",
                teacherTab === "lesson"
                  ? "border-b-2 border-ide-blue text-ide-fg"
                  : "text-ide-muted",
              )}
            >
              Lesson guide
            </button>
            <button
              type="button"
              onClick={() => setTeacherTab("chat")}
              className={cn(
                "flex-1 text-xs",
                teacherTab === "chat" ? "border-b-2 border-ide-blue text-ide-fg" : "text-ide-muted",
              )}
            >
              Ask Ada
            </button>
          </div>
          {teacherTab === "lesson" ? (
            <div className="ide-scroll h-[calc(100%-76px)] overflow-y-auto p-4">
              <div className="mb-4 flex items-center justify-between">
                <span className="rounded bg-ide-active px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-ide-blue">
                  {phaseLabel}
                </span>
                <span className="text-[11px] text-ide-muted">
                  {lesson.minutes} min · {lesson.xp} XP
                </span>
              </div>
              <h2 className="font-display text-xl font-bold leading-tight">{lesson.title}</h2>
              <p className="mt-2 text-xs leading-relaxed text-ide-muted">{lesson.summary}</p>
              <LessonStepper phase={phase} />
              <div className="rounded-lg border border-ide-border bg-ide-panel p-3 text-xs leading-relaxed">
                {phase === "watch" && (
                  <>
                    <div className="mb-2 flex items-center gap-2 font-semibold">
                      <Bot className="h-4 w-4 text-pin-teacher" />
                      {currentStep?.kind === "preview"
                        ? "See the result"
                        : currentStep?.kind === "type"
                          ? "Follow the highlighted line"
                          : currentStep
                            ? "Watch the workspace grow"
                            : "Guided build complete"}
                    </div>
                    <p className="text-ide-muted">
                      {currentStep && "say" in currentStep
                        ? currentStep.say
                        : "You have seen every step. Select Your turn when you are ready to write it yourself."}
                    </p>
                    {currentLine?.note && (
                      <p className="mt-2 border-l-2 border-pin-teacher pl-2 text-ide-fg">
                        {currentLine.note}
                      </p>
                    )}
                  </>
                )}
                {phase === "repeat" && (
                  <>
                    <div className="mb-2 font-semibold">Your turn to build</div>
                    <p className="text-ide-muted">{lesson.practice}</p>
                    <div className="mt-3">
                      <div className="mb-1 flex justify-between text-[11px]">
                        <span>Local code check</span>
                        <span>{localScore}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-ide-editor">
                        <div
                          className="h-full rounded-full bg-ide-blue transition-all"
                          style={{ width: `${localScore}%` }}
                        />
                      </div>
                    </div>
                  </>
                )}
                {phase === "review" && (
                  <>
                    <div className="mb-2 font-semibold">Review and code quiz</div>
                    <p className="whitespace-pre-wrap text-ide-muted">
                      {reviewSummary ||
                        "Answer Ada's pinned questions. She will check your reasoning, award XP, and suggest a small exercise when needed."}
                    </p>
                    {reviewScore !== undefined && (
                      <ScoreRing score={reviewScore} label="Review score" />
                    )}
                  </>
                )}
                {phase === "challenge" && (
                  <>
                    <div className="mb-2 font-semibold">Build from scratch</div>
                    <p className="text-ide-muted">{lesson.challenge}</p>
                    <p className="mt-2 text-ide-muted">
                      Create your own folders and files. Ada checks structure, correctness and code
                      quality.
                    </p>
                    {challengeScore !== undefined && (
                      <ScoreRing
                        score={challengeScore}
                        label={challengeScore >= 70 ? "Passed" : "Keep improving"}
                      />
                    )}
                  </>
                )}
                {phase === "done" && (
                  <div className="text-center">
                    <Trophy className="mx-auto mb-2 h-8 w-8 text-sun" />
                    <strong>You completed this lesson.</strong>
                    <p className="mt-1 text-ide-muted">
                      Your best score is {progress.completed[lessonKey] ?? challengeScore}%.
                    </p>
                  </div>
                )}
              </div>
              {teacherError && (
                <div className="mt-3 rounded-lg border border-pin-issue/40 bg-pin-issue/10 p-3 text-xs leading-relaxed text-ide-fg">
                  <strong>Ada needs attention</strong>
                  <p className="mt-1 text-ide-muted">{teacherError}</p>
                </div>
              )}
              {comments.length > 0 && (
                <div className="mt-5">
                  <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ide-muted">
                    Pinned notes · {comments.length}
                  </h3>
                  <div className="space-y-1.5">
                    {comments.map((comment) => (
                      <button
                        type="button"
                        key={comment.id}
                        onClick={() => jumpToComment(comment)}
                        className="flex w-full items-start gap-2 rounded-md p-2 text-left hover:bg-ide-hover"
                      >
                        <span
                          className={cn(
                            "mt-1 h-2 w-2 shrink-0 rounded-full",
                            comment.type === "question"
                              ? "bg-pin-question"
                              : comment.type === "issue"
                                ? "bg-pin-issue"
                                : "bg-pin-praise",
                          )}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs">{comment.message}</span>
                          <span className="mt-0.5 block text-[10px] text-ide-muted">
                            {comment.file}:{comment.line}
                            {comment.verdict ? ` · ${comment.verdict}` : ""}
                          </span>
                        </span>
                        <SquareArrowOutUpRight className="mt-1 h-3 w-3 text-ide-muted" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="mt-5 flex gap-2">
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() => void getHint()}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-ide-border px-2 py-2 text-xs hover:bg-ide-hover"
                >
                  <Lightbulb className="h-3.5 w-3.5 text-sun" />
                  {busy === "hint" ? "Thinking…" : "Give me a hint"}
                </button>
                {phase === "watch" && (
                  <button
                    type="button"
                    onClick={startWatch}
                    className="flex items-center justify-center gap-1.5 rounded-md border border-ide-border px-3 py-2 text-xs hover:bg-ide-hover"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Restart
                  </button>
                )}
                {phase !== "watch" && (
                  <StudioButton onClick={startRepeat} disabled={!!busy} icon={RotateCcw}>
                    Reset practice
                  </StudioButton>
                )}
              </div>
              <div className="mt-5 rounded-lg bg-ide-panel p-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold">{rankFor(level.level)}</span>
                  <span>
                    {level.into}/{level.span} XP
                  </span>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-ide-editor">
                  <div
                    className="h-full rounded-full bg-sun"
                    style={{ width: `${(level.into / level.span) * 100}%` }}
                  />
                </div>
                <div className="mt-2 flex items-center gap-3 text-[10px] text-ide-muted">
                  <span className="flex items-center gap-1">
                    <Flame className="h-3 w-3 text-pin-issue" />
                    {progress.streak} day streak
                  </span>
                  <span>{Object.keys(progress.completed).length} completed</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-[calc(100%-76px)] min-h-0 flex-col">
              <div className="ide-scroll min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
                {chat.map((message, index) => (
                  <div
                    key={index}
                    className={cn(
                      "rounded-xl p-3 text-xs leading-relaxed",
                      message.role === "teacher"
                        ? "mr-3 rounded-tl-sm bg-ide-panel"
                        : "ml-6 rounded-br-sm bg-ide-active",
                    )}
                  >
                    <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-ide-muted">
                      {message.role === "teacher" ? (
                        <>
                          <Bot className="h-3 w-3" />
                          Ada
                        </>
                      ) : (
                        "You"
                      )}
                    </div>
                    <div className="markdown-body">
                      <ReactMarkdown>{message.text}</ReactMarkdown>
                    </div>
                  </div>
                ))}
                {busy === "chat" && (
                  <div className="mr-3 flex items-center gap-2 rounded-xl bg-ide-panel p-3 text-xs text-ide-muted">
                    <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                    Ada is reading your code…
                  </div>
                )}
                {teacherError && (
                  <div className="rounded-lg border border-pin-issue/40 p-3 text-xs text-ide-fg">
                    {teacherError}
                  </div>
                )}
              </div>
              <div className="shrink-0 border-t border-ide-border p-3">
                <div className="mb-2 flex items-center gap-1 text-[10px] text-ide-muted">
                  <Braces className="h-3 w-3" />
                  {activeFile ? `${activeFile}:${cursor.line}` : "Whole workspace"}
                </div>
                <textarea
                  aria-label="Ask Ada a question"
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void sendChat();
                    }
                  }}
                  placeholder="Ask about a line, error or concept…"
                  className="h-20 w-full resize-none rounded-lg border border-ide-border bg-ide-editor p-2.5 text-xs text-ide-fg outline-none placeholder:text-ide-muted focus:border-ide-blue"
                />
                <div className="mt-2 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() =>
                      setQuestion(
                        `Can you explain line ${cursor.line} in ${activeFile || "this file"}?`,
                      )
                    }
                    className="text-[10px] text-ide-muted hover:text-ide-fg"
                  >
                    Use current line
                  </button>
                  <button
                    type="button"
                    aria-label="Send question to Ada"
                    disabled={!!busy || !question.trim()}
                    onClick={() => void sendChat()}
                    className="rounded-md bg-ide-blue p-2 text-primary-foreground disabled:opacity-40"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </aside>
      </div>

      <footer className="flex h-6 shrink-0 items-center gap-3 bg-ide-status px-3 text-[10px] text-primary-foreground">
        <span className="flex items-center gap-1">
          <Braces className="h-3 w-3" />
          {lesson.runtime}
        </span>
        <span>Saved locally</span>
        <span className="hidden sm:inline">{phaseLabel}</span>
        <span className="ml-auto">
          Ln {cursor.line}, Col {cursor.col}
        </span>
        <span className="hidden sm:inline">UTF-8</span>
        <span className="hidden md:inline">{isCompleted ? "Completed" : "Auto-save on"}</span>
      </footer>
      <Achievements
        open={achievementsOpen}
        onOpenChange={setAchievementsOpen}
        progress={progress}
      />
      <Celebration
        open={celebrationOpen}
        onOpenChange={setCelebrationOpen}
        title={lesson.title}
        score={challengeScore ?? 0}
        xp={awardedXp}
      />
    </div>
  );
}

function StudioButton({
  children,
  icon: Icon,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  icon: typeof Play;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1.5 rounded-md bg-ide-blue px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
    >
      <Icon className={cn("h-3.5 w-3.5", disabled && "animate-spin")} />
      {children}
    </button>
  );
}

function ActivityButton({
  label,
  icon: Icon,
  active = false,
  onClick,
}: {
  label: string;
  icon: typeof Play;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "relative flex h-11 w-11 items-center justify-center text-ide-muted hover:text-ide-fg",
        active &&
          "text-ide-fg before:absolute before:inset-y-1 before:left-0 before:w-0.5 before:bg-ide-blue",
      )}
    >
      <Icon className="h-5 w-5" />
    </button>
  );
}

function LessonStepper({ phase }: { phase: Phase }) {
  const phases = [
    { id: "watch", label: "Watch Ada build" },
    { id: "repeat", label: "Repeat it yourself" },
    { id: "review", label: "Review and quiz" },
    { id: "challenge", label: "Build from scratch" },
  ];
  const current = phase === "done" ? 4 : phases.findIndex((item) => item.id === phase);
  return (
    <ol className="my-5 space-y-0">
      {phases.map((item, index) => (
        <li key={item.id} className="relative flex gap-2.5 pb-4 last:pb-0">
          {index < phases.length - 1 && (
            <span
              className={cn(
                "absolute left-[9px] top-5 h-[calc(100%-14px)] w-px bg-ide-border",
                index < current && "bg-pin-praise",
              )}
            />
          )}
          <span
            className={cn(
              "z-10 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-ide-border bg-ide-side text-[10px]",
              index < current && "border-pin-praise bg-pin-praise text-primary-foreground",
              index === current && "border-ide-blue bg-ide-active text-ide-blue",
            )}
          >
            {index < current ? <Check className="h-3 w-3" /> : index + 1}
          </span>
          <span
            className={cn(
              "pt-0.5 text-xs",
              index === current ? "font-semibold text-ide-fg" : "text-ide-muted",
            )}
          >
            {item.label}
          </span>
        </li>
      ))}
    </ol>
  );
}

function ScoreRing({ score, label }: { score: number; label: string }) {
  return (
    <div className="mt-4 flex items-center gap-3 rounded-md bg-ide-editor p-3">
      <div className="flex h-12 w-12 items-center justify-center rounded-full border-4 border-ide-blue font-display text-lg font-bold">
        {score}
      </div>
      <div>
        <div className="text-xs font-semibold">{label}</div>
        <div className="text-[10px] text-ide-muted">
          {score >= 70 ? "Ready for the next step" : "Review the pinned feedback"}
        </div>
      </div>
    </div>
  );
}

function EmptyWorkspace({ onCreate, phase }: { onCreate: () => void; phase: Phase }) {
  return (
    <div className="flex h-full items-center justify-center bg-ide-editor p-8 text-center">
      <div>
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-ide-panel">
          <FileCode2 className="h-7 w-7 text-ide-muted" />
        </div>
        <h3 className="font-display text-lg font-semibold">A blank canvas</h3>
        <p className="mx-auto mt-2 max-w-xs text-xs leading-relaxed text-ide-muted">
          {phase === "challenge"
            ? "This challenge starts empty on purpose. Create the files and folders your solution needs."
            : "Select a file in the Explorer or create a new one."}
        </p>
        <button
          type="button"
          onClick={onCreate}
          className="mt-4 rounded-md border border-ide-border px-3 py-2 text-xs hover:bg-ide-hover"
        >
          Create your first file
        </button>
      </div>
    </div>
  );
}

function ConnectionMap({ connections }: { connections: ReturnType<typeof findConnections> }) {
  return (
    <div className="ide-scroll h-full overflow-auto bg-ide-editor p-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6">
          <h2 className="font-display text-xl font-semibold">How your code connects</h2>
          <p className="mt-1 text-xs text-ide-muted">
            A living map of styles, scripts, components, selectors and API routes in this workspace.
          </p>
        </div>
        {connections.length ? (
          <div className="space-y-3">
            {connections.map((connection, index) => (
              <div
                key={`${connection.from}-${connection.to}-${index}`}
                className="grid items-center gap-3 rounded-lg border border-ide-border bg-ide-panel p-4 md:grid-cols-[1fr_150px_1fr]"
              >
                <div className="flex items-center gap-2 font-mono text-xs">
                  <FileCode2 className="h-4 w-4 shrink-0 text-ide-blue" />
                  <span className="break-all">{connection.from}</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-ide-muted">
                  <span className="h-px flex-1 bg-ide-border" />
                  <span>{connection.label}</span>
                  <ArrowRight className="h-3 w-3 shrink-0" />
                </div>
                <div className="flex items-center gap-2 font-mono text-xs">
                  <FileCode2 className="h-4 w-4 shrink-0 text-pin-praise" />
                  <span className="break-all">{connection.to}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-ide-border py-16 text-center">
            <Map className="mx-auto mb-3 h-8 w-8 text-ide-muted" />
            <h3 className="text-sm font-semibold">Connections appear as you build</h3>
            <p className="mt-2 text-xs text-ide-muted">
              Link a stylesheet, load a script, use a CSS class, or call an API route.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
