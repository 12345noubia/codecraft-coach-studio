import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import ReactMarkdown from "react-markdown";
import {
  ArrowLeft,
  Check,
  Code2,
  Download,
  LoaderCircle,
  Monitor,
  Send,
  Sparkles,
  Undo2,
} from "lucide-react";
import logo from "@/assets/logo.png";
import teacher from "@/assets/sticker-teacher.png";
import { Button } from "@/components/ui/button";
import { CodeEditor } from "@/components/ide/CodeEditor";
import { CommentBubble } from "@/components/ide/Bubble";
import { FileExplorer } from "@/components/studio/FileExplorer";
import { PreviewPane, type Device } from "@/components/studio/PreviewPane";
import { TerminalPanel, type TerminalTab } from "@/components/studio/TerminalPanel";
import {
  applyProjectCorrection,
  getProjects,
  projectReviewSchema,
  saveProject,
  type PersonalProject,
  type ProjectReview,
} from "@/lib/projects";
import { normalizePath, safeComments, validNewPath, type LogEntry } from "@/lib/studio";
import { askTeacher } from "@/lib/teacher.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/projects/$projectId")({
  head: () => ({
    meta: [
      { title: "Personal coding project — CodeCraft Studio" },
      {
        name: "description",
        content:
          "Build your own projects in any programming language with Ada's code reviews and proposed corrections.",
      },
      { property: "og:title", content: "Personal projects — CodeCraft Studio" },
      {
        property: "og:description",
        content: "An independent coding workspace with files, previews and AI code review.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PersonalWorkspace,
});

function PersonalWorkspace() {
  const { projectId } = Route.useParams();
  const ask = useServerFn(askTeacher);
  const [project, setProject] = useState<PersonalProject | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [tab, setTab] = useState<"code" | "preview">("code");
  const [device, setDevice] = useState<Device>("desktop");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [terminalTab, setTerminalTab] = useState<TerminalTab>("terminal");
  const [expanded, setExpanded] = useState(false);
  const [review, setReview] = useState<ProjectReview | null>(null);
  const [reviewedFiles, setReviewedFiles] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [intent, setIntent] = useState("");
  const [question, setQuestion] = useState("");
  const [chat, setChat] = useState<{ role: "user" | "teacher"; text: string }[]>([]);
  const [openPin, setOpenPin] = useState("");
  const [followLine, setFollowLine] = useState(1);
  const [undo, setUndo] = useState<Record<string, string> | null>(null);
  const current = useRef<PersonalProject | null>(null);
  const requestPending = useRef(false);
  const addLog = useCallback(
    (entry: Omit<LogEntry, "id">) =>
      setLogs((old) => [...old.slice(-199), { ...entry, id: Date.now() + Math.random() }]),
    [],
  );

  useEffect(() => {
    setProject(getProjects().find((item) => item.id === projectId) ?? null);
    setLoaded(true);
    setReview(null);
    setChat([]);
  }, [projectId]);
  useEffect(() => {
    current.current = project;
  }, [project]);
  const persist = (next: PersonalProject) => {
    current.current = next;
    setProject(next);
    try {
      saveProject(next);
      setSaveError("");
    } catch {
      setSaveError(
        "Not saved: browser storage is unavailable or full. Download your project before leaving.",
      );
    }
  };
  const edit = (next: PersonalProject) => {
    setReview(null);
    setError("");
    persist({ ...next, updatedAt: Date.now() });
  };
  const comments = useMemo(
    () => (project && review ? safeComments(review, project.files) : []),
    [review, project],
  );
  const overlays = comments
    .filter((comment) => comment.file === project?.activeFile)
    .map((comment) => ({
      key: comment.id,
      line: comment.line,
      highlight: comment.type === "teacher" ? ("teacher" as const) : comment.type,
      node: (
        <CommentBubble
          kind={comment.type}
          title={`Ada · line ${comment.line}`}
          collapsible
          open={openPin === comment.id}
          onOpenChange={(open) => setOpenPin(open ? comment.id : "")}
        >
          <p>{comment.message}</p>
        </CommentBubble>
      ),
    }));

  const request = async (mode: "project-review" | "chat") => {
    const snapshot = current.current;
    if (
      !snapshot ||
      requestPending.current ||
      !Object.values(snapshot.files).some((content) => content.trim())
    )
      return;
    const prompt = question.trim();
    if (mode === "chat" && !prompt) return;
    requestPending.current = true;
    setBusy(true);
    setError("");
    if (mode === "chat") {
      setChat((old) => [...old, { role: "user", text: prompt }]);
      setQuestion("");
    }
    try {
      const result = await ask({
        data: {
          mode,
          lessonTitle: snapshot.name,
          goal: `Independent project. Language: ${snapshot.language}. ${intent}`,
          files: snapshot.files,
          reference: {},
          question: prompt,
          answer: "",
          line: "",
          history: chat.slice(-20),
        },
      });
      if (!result.ok) throw new Error(result.error);
      if (
        current.current?.id !== snapshot.id ||
        JSON.stringify(current.current.files) !== JSON.stringify(snapshot.files)
      ) {
        setError("Your code changed while Ada was responding. Ask again for an up-to-date review.");
        return;
      }
      if (mode === "project-review") {
        const parsed = projectReviewSchema.parse(JSON.parse(result.json));
        setReview({
          ...parsed,
          corrections: parsed.corrections.filter(
            (fix) =>
              fix.file in snapshot.files &&
              (snapshot.files[fix.file]?.length ?? 0) <= 8000 &&
              Object.keys(snapshot.files).slice(0, 20).includes(fix.file),
          ),
        });
        setReviewedFiles(snapshot.files);
      } else {
        const parsed: unknown = JSON.parse(result.json);
        if (
          !parsed ||
          typeof parsed !== "object" ||
          !("text" in parsed) ||
          typeof parsed.text !== "string"
        )
          throw new Error("Ada's reply could not be read. Please try again.");
        setChat((old) => [...old, { role: "teacher", text: parsed.text as string }]);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Ada could not respond. Try again.");
    } finally {
      requestPending.current = false;
      setBusy(false);
    }
  };

  if (!loaded)
    return (
      <div className="flex min-h-screen items-center justify-center bg-ide-editor text-ide-fg">
        <LoaderCircle className="mr-2 animate-spin" />
        Opening project…
      </div>
    );
  if (!project)
    return (
      <main className="min-h-screen bg-background p-8">
        <h1 className="font-display text-2xl font-bold">Your projects</h1>
        <p className="my-4">This project is not saved on this browser.</p>
        <Button asChild>
          <Link to="/studio">Open project library</Link>
        </Button>
      </main>
    );
  const hasCode = Object.values(project.files).some((content) => content.trim());
  return (
    <div className="flex min-h-screen flex-col bg-ide-editor text-ide-fg lg:h-screen lg:overflow-hidden">
      <header className="flex min-h-12 shrink-0 flex-wrap items-center gap-3 border-b border-ide-border bg-ide-panel px-3 py-2">
        <Button
          asChild
          size="icon"
          variant="ghost"
          title="Project library"
          className="hover:bg-ide-hover"
        >
          <Link to="/studio" aria-label="Project library">
            <ArrowLeft />
          </Link>
        </Button>
        <img src={logo} alt="CodeCraft" className="h-7 w-7" />
        <h1 className="min-w-0 flex-1 truncate text-sm font-semibold">{project.name}</h1>
        <span className={cn("text-xs", saveError ? "text-pin-issue" : "text-pin-praise")}>
          {saveError ? "Not saved" : "Saved on this device"}
        </span>
        <Button
          variant="ghost"
          size="icon"
          title="Download project files as JSON"
          aria-label="Download project"
          className="hover:bg-ide-hover"
          onClick={() => {
            const url = URL.createObjectURL(
              new Blob([JSON.stringify(project, null, 2)], { type: "application/json" }),
            );
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = `${project.name.replace(/[^a-z0-9-]/gi, "-")}.json`;
            anchor.click();
            URL.revokeObjectURL(url);
          }}
        >
          <Download />
        </Button>
      </header>
      {saveError && (
        <p role="alert" className="bg-pin-issue/10 px-4 py-2 text-xs text-pin-issue">
          {saveError}
        </p>
      )}
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[200px_minmax(0,1fr)_340px]">
        <div className="max-h-64 border-r border-ide-border lg:max-h-none">
          <FileExplorer
            workspaceName="Personal project"
            files={project.files}
            folders={project.folders}
            activeFile={project.activeFile}
            onSelect={(path) => persist({ ...project, activeFile: path })}
            onCreate={(kind, path) => {
              const clean = normalizePath(path);
              const issue = validNewPath(
                clean,
                project.files,
                project.folders,
                kind === "folder",
                false,
              );
              if (issue) return issue;
              edit(
                kind === "folder"
                  ? { ...project, folders: [...project.folders, clean] }
                  : { ...project, files: { ...project.files, [clean]: "" }, activeFile: clean },
              );
              setTab("code");
              return null;
            }}
            onDelete={(path, kind) => {
              if (!window.confirm(`Delete ${path}${kind === "folder" ? " and its contents" : ""}?`))
                return;
              const files = Object.fromEntries(
                Object.entries(project.files).filter(
                  ([file]) => file !== path && !(kind === "folder" && file.startsWith(path + "/")),
                ),
              );
              edit({
                ...project,
                files,
                folders: project.folders.filter(
                  (folder) => folder !== path && !folder.startsWith(path + "/"),
                ),
                activeFile:
                  project.activeFile in files ? project.activeFile : (Object.keys(files)[0] ?? ""),
              });
            }}
          />
        </div>
        <main className="flex h-[700px] min-w-0 flex-col lg:h-full lg:min-h-0">
          <div className="flex h-10 shrink-0 items-center gap-1 border-b border-ide-border bg-ide-panel px-2">
            <Button
              variant="ghost"
              size="sm"
              className={cn("hover:bg-ide-hover", tab === "code" && "bg-ide-active")}
              onClick={() => setTab("code")}
            >
              <Code2 />
              Code
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={project.runtime === "none"}
              className={cn("hover:bg-ide-hover", tab === "preview" && "bg-ide-active")}
              onClick={() => setTab("preview")}
            >
              <Monitor />
              Preview
            </Button>
            {undo && (
              <Button
                variant="ghost"
                size="icon"
                title="Undo Ada correction"
                aria-label="Undo Ada correction"
                className="ml-auto hover:bg-ide-hover"
                onClick={() => {
                  edit({ ...project, files: undo });
                  setUndo(null);
                }}
              >
                <Undo2 />
              </Button>
            )}
          </div>
          {tab === "code" && (
            <div className="flex h-9 shrink-0 overflow-x-auto border-b border-ide-border bg-ide-side">
              {Object.keys(project.files).map((path) => (
                <Button
                  key={path}
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-9 shrink-0 rounded-none border-r border-ide-border hover:bg-ide-hover",
                    project.activeFile === path && "bg-ide-editor",
                  )}
                  onClick={() => persist({ ...project, activeFile: path })}
                >
                  {path}
                </Button>
              ))}
            </div>
          )}
          <div className="min-h-0 flex-1">
            {tab === "preview" && project.runtime !== "none" ? (
              <PreviewPane
                runtime={project.runtime}
                files={project.files}
                device={device}
                onDevice={setDevice}
                onLog={addLog}
              />
            ) : project.activeFile in project.files ? (
              <CodeEditor
                key={project.activeFile}
                path={project.activeFile}
                value={project.files[project.activeFile] ?? ""}
                readOnly={false}
                onChange={(value) =>
                  edit({ ...project, files: { ...project.files, [project.activeFile]: value } })
                }
                overlays={overlays}
                followLine={followLine}
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-ide-muted">
                <Code2 className="h-12 w-12" />
                <h2 className="font-display text-xl text-ide-fg">{project.name}</h2>
                <p className="text-sm">No files yet.</p>
              </div>
            )}
          </div>
          <TerminalPanel
            logs={logs}
            problems={comments
              .filter((comment) => comment.type === "issue")
              .map((comment) => ({
                file: comment.file,
                line: comment.line,
                message: comment.message,
                severity: "warning" as const,
              }))}
            tab={terminalTab}
            onTab={setTerminalTab}
            onClear={() => setLogs([])}
            expanded={expanded}
            onExpanded={setExpanded}
            onProblem={(problem) => {
              persist({ ...project, activeFile: problem.file });
              setFollowLine(problem.line);
              setTab("code");
            }}
          />
        </main>
        <aside
          className="ide-scroll min-h-0 overflow-y-auto border-l border-ide-border bg-ide-side p-4"
          aria-label="Ada project assistant"
        >
          <div className="mb-4 flex items-center gap-3">
            <img src={teacher} alt="" className="h-10 w-10" />
            <div>
              <h2 className="font-display font-semibold">Ada</h2>
              <span className="text-xs text-ide-muted">{project.language}</span>
            </div>
          </div>
          <label className="text-xs text-ide-muted">
            Project goal
            <textarea
              value={intent}
              onChange={(event) => {
                setIntent(event.target.value);
                setReview(null);
              }}
              maxLength={3500}
              placeholder="What should your code do?"
              className="mt-2 h-20 w-full resize-y rounded-md border border-ide-border bg-ide-editor p-2 text-sm text-ide-fg"
            />
          </label>
          <Button
            className="my-3 w-full bg-ide-blue text-primary-foreground hover:bg-ide-blue/90"
            disabled={busy || !hasCode}
            onClick={() => void request("project-review")}
          >
            {busy ? <LoaderCircle className="animate-spin" /> : <Sparkles />}Review my code
          </Button>
          {project.runtime === "none" && (
            <p className="mb-4 text-xs leading-relaxed text-ide-muted">
              Code editing and Ada review are available for any language. Running Python, Java, Rust
              and other non-web languages is not supported here.
            </p>
          )}
          {Object.keys(project.files).length > 20 ||
          Object.values(project.files).some((value) => value.length > 8000) ? (
            <p className="mb-3 text-xs text-pin-question">
              Ada can review the first 20 files, up to 8,000 characters each. Larger files receive
              feedback only, not replacements.
            </p>
          ) : null}
          {error && (
            <p role="alert" className="mb-3 rounded-md bg-pin-issue/10 p-3 text-xs text-pin-issue">
              {error}
            </p>
          )}
          {review && (
            <section aria-label="Code review" className="space-y-3 border-y border-ide-border py-4">
              <h3 className="text-sm font-semibold">Code review</h3>
              <p className="text-sm leading-relaxed">{review.summary}</p>
              {comments.map((comment) => (
                <Button
                  key={comment.id}
                  variant="ghost"
                  className="h-auto w-full justify-start whitespace-normal px-2 py-2 text-left text-xs hover:bg-ide-hover"
                  onClick={() => {
                    persist({ ...project, activeFile: comment.file });
                    setFollowLine(comment.line);
                    setOpenPin(comment.id);
                    setTab("code");
                  }}
                >
                  <span
                    className={cn(
                      "shrink-0",
                      comment.type === "issue" ? "text-pin-issue" : "text-pin-praise",
                    )}
                  >
                    {comment.file}:{comment.line}
                  </span>
                  <span>{comment.message}</span>
                </Button>
              ))}
              {review.corrections.map((fix, index) => (
                <div key={`${fix.file}-${index}`} className="border-t border-ide-border pt-3">
                  <h4 className="break-words text-xs font-semibold">{fix.file}</h4>
                  <p className="my-2 text-xs leading-relaxed text-ide-muted">{fix.explanation}</p>
                  <details>
                    <summary className="cursor-pointer text-xs text-ide-blue">
                      Proposed code
                    </summary>
                    <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words bg-ide-editor p-2 font-mono text-xs">
                      {fix.content}
                    </pre>
                  </details>
                  <Button
                    size="sm"
                    className="mt-2 bg-ide-blue text-primary-foreground hover:bg-ide-blue/90"
                    onClick={() => {
                      const files = applyProjectCorrection(project.files, reviewedFiles, fix);
                      if (!files) {
                        setError(
                          "This file changed. Review it again before applying a correction.",
                        );
                        return;
                      }
                      setUndo(project.files);
                      edit({ ...project, files, activeFile: fix.file });
                      setTab("code");
                    }}
                  >
                    <Check />
                    Apply correction
                  </Button>
                </div>
              ))}
            </section>
          )}
          <section className="mt-5 space-y-3" aria-label="Ask Ada">
            <h3 className="text-sm font-semibold">Ask Ada</h3>
            {chat.map((message, index) => (
              <div
                key={index}
                className={cn(
                  "break-words text-sm",
                  message.role === "user" ? "border-l-2 border-ide-blue pl-3" : "lesson-markdown",
                )}
              >
                <span className="text-xs font-semibold text-ide-muted">
                  {message.role === "user" ? "You" : "Ada"}
                </span>
                <ReactMarkdown>{message.text}</ReactMarkdown>
              </div>
            ))}
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void request("chat");
              }}
            >
              <textarea
                aria-label="Ask Ada about your project"
                value={question}
                maxLength={4000}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="Ask about your code…"
                className="h-24 w-full rounded-md border border-ide-border bg-ide-editor p-2 text-sm"
              />
              <Button
                type="submit"
                size="sm"
                disabled={busy || !hasCode || !question.trim()}
                className="mt-2 bg-ide-blue text-primary-foreground hover:bg-ide-blue/90"
              >
                <Send />
                Send
              </Button>
            </form>
          </section>
        </aside>
      </div>
      <footer className="flex h-7 shrink-0 items-center justify-between bg-ide-blue px-3 text-[11px] text-primary-foreground">
        <span>CodeCraft · Personal project</span>
        <span>{project.language}</span>
      </footer>
    </div>
  );
}
