import { AlertCircle, AlertTriangle, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import type { LogEntry, Problem } from "@/lib/studio";
import { cn } from "@/lib/utils";

export type TerminalTab = "terminal" | "console" | "problems";

export function TerminalPanel({
  logs,
  problems,
  tab,
  onTab,
  onClear,
  expanded,
  onExpanded,
  onProblem,
}: {
  logs: LogEntry[];
  problems: Problem[];
  tab: TerminalTab;
  onTab: (tab: TerminalTab) => void;
  onClear: () => void;
  expanded: boolean;
  onExpanded: (expanded: boolean) => void;
  onProblem: (problem: Problem) => void;
}) {
  const visible = tab === "console" ? logs.filter((log) => log.source === "preview") : logs;
  return (
    <section
      className={cn(
        "flex shrink-0 flex-col border-t border-ide-border bg-ide-panel",
        expanded ? "h-[42%] min-h-[190px]" : "h-9",
      )}
      aria-label="Terminal panel"
    >
      <div className="flex h-9 shrink-0 items-center border-b border-ide-border px-3">
        <div className="flex h-full items-center gap-4">
          {(["terminal", "console", "problems"] as TerminalTab[]).map((name) => (
            <button
              type="button"
              key={name}
              onClick={() => {
                onTab(name);
                onExpanded(true);
              }}
              className={cn(
                "relative h-full text-[11px] uppercase tracking-wide text-ide-muted hover:text-ide-fg",
                tab === name &&
                  expanded &&
                  "text-ide-fg after:absolute after:inset-x-0 after:top-0 after:h-px after:bg-ide-blue",
              )}
            >
              {name === "problems"
                ? `Problems ${problems.length}`
                : name[0]!.toUpperCase() + name.slice(1)}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            title="Clear output"
            aria-label="Clear output"
            onClick={onClear}
            className="rounded p-1 text-ide-muted hover:bg-ide-hover hover:text-ide-fg"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            title={expanded ? "Collapse panel" : "Expand panel"}
            aria-label={expanded ? "Collapse terminal" : "Expand terminal"}
            onClick={() => onExpanded(!expanded)}
            className="rounded p-1 text-ide-muted hover:bg-ide-hover hover:text-ide-fg"
          >
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>
        </div>
      </div>
      {expanded && (
        <div className="ide-scroll min-h-0 flex-1 overflow-auto px-4 py-2 font-mono text-xs leading-6">
          {tab === "problems" ? (
            problems.length ? (
              problems.map((problem, index) => (
                <button
                  type="button"
                  key={`${problem.file}-${problem.line}-${index}`}
                  onClick={() => onProblem(problem)}
                  className="flex w-full items-start gap-2 text-left text-ide-fg hover:bg-ide-hover"
                >
                  {problem.severity === "error" ? (
                    <AlertCircle className="mt-1 h-3.5 w-3.5 shrink-0 text-pin-issue" />
                  ) : (
                    <AlertTriangle className="mt-1 h-3.5 w-3.5 shrink-0 text-sun" />
                  )}
                  <span>{problem.message}</span>
                  <span className="ml-auto shrink-0 text-ide-muted">
                    {problem.file}:{problem.line}
                  </span>
                </button>
              ))
            ) : (
              <Empty text="No problems detected in your workspace." />
            )
          ) : visible.length ? (
            visible.map((log) => (
              <div
                key={log.id}
                className={cn(
                  "whitespace-pre-wrap break-words",
                  log.level === "error"
                    ? "text-pin-issue"
                    : log.level === "warn"
                      ? "text-sun"
                      : log.level === "info"
                        ? "text-ide-blue"
                        : "text-ide-fg",
                )}
              >
                <span className="mr-2 select-none text-ide-muted">
                  {log.source === "preview" ? "preview" : "studio"}
                </span>
                {log.text}
              </div>
            ))
          ) : (
            <Empty
              text={
                tab === "console"
                  ? "Console output from your preview appears here."
                  : "Run the preview or your server to see output."
              }
            />
          )}
        </div>
      )}
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="py-2 font-sans text-xs text-ide-muted">{text}</p>;
}
