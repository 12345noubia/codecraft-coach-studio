import { useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, Monitor, RefreshCw, Server, Smartphone, Tablet } from "lucide-react";
import { buildPreview } from "@/lib/runtime";
import type { Runtime } from "@/lib/curriculum";
import type { LogEntry } from "@/lib/studio";
import { cn } from "@/lib/utils";

export type Device = "mobile" | "tablet" | "desktop";

export function PreviewPane({
  runtime,
  files,
  device,
  onDevice,
  onLog,
}: {
  runtime: Runtime;
  files: Record<string, string>;
  device: Device;
  onDevice: (device: Device) => void;
  onLog: (entry: Omit<LogEntry, "id">) => void;
}) {
  const iframe = useRef<HTMLIFrameElement>(null);
  const [nonce, setNonce] = useState(0);
  const built = useMemo(() => buildPreview(runtime, files), [runtime, files]);
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (
        event.source !== iframe.current?.contentWindow ||
        !event.data ||
        event.data.__cc !== "log"
      )
        return;
      const level = ["log", "info", "warn", "error"].includes(event.data.level)
        ? event.data.level
        : "log";
      onLog({ level, text: String(event.data.text ?? ""), source: "preview" });
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [onLog]);

  return (
    <section className="flex h-full min-h-0 flex-col bg-ide-panel" aria-label="Live preview">
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-ide-border px-3">
        <div className="flex items-center gap-1 rounded-md bg-ide-editor p-1">
          {(
            [
              ["mobile", Smartphone, "Phone"],
              ["tablet", Tablet, "Tablet"],
              ["desktop", Monitor, "Desktop"],
            ] as const
          ).map(([value, Icon, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => onDevice(value)}
              className={cn(
                "flex items-center gap-1.5 rounded px-2.5 py-1 text-xs text-ide-muted transition-colors hover:text-ide-fg",
                device === value && "bg-ide-hover text-ide-fg shadow-sm",
              )}
              aria-pressed={device === value}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <span className="mr-2 hidden items-center gap-1.5 text-[11px] text-ide-muted md:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-pin-praise" />
            Live
          </span>
          <button
            type="button"
            onClick={() => setNonce((n) => n + 1)}
            className="rounded p-1.5 text-ide-muted hover:bg-ide-hover hover:text-ide-fg"
            title="Refresh preview"
            aria-label="Refresh preview"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <span
            className="rounded p-1.5 text-ide-muted"
            title="Preview runs safely inside the studio"
          >
            <ExternalLink className="h-4 w-4" />
          </span>
        </div>
      </div>
      <div className="ide-scroll min-h-0 flex-1 overflow-auto p-4">
        {built.error && (
          <div className="mx-auto mb-3 max-w-lg rounded-lg border border-pin-question/40 bg-pin-question/10 px-4 py-3 text-sm text-ide-fg">
            {built.error}
          </div>
        )}
        <div
          className={cn(
            "mx-auto h-full min-h-[420px] transition-all duration-300",
            device === "mobile" && "max-w-[340px]",
            device === "tablet" && "max-w-[720px]",
            device === "desktop" && "max-w-full",
          )}
        >
          {device === "mobile" ? (
            <div className="phone-frame mx-auto h-full min-h-[560px] w-[310px] rounded-[2.6rem] p-2.5 shadow-bubble">
              <div className="relative h-full overflow-hidden rounded-[2rem] bg-card">
                <div className="phone-notch absolute left-1/2 top-2 z-10 h-5 w-24 -translate-x-1/2 rounded-full" />
                <PreviewFrame
                  iframeRef={iframe}
                  nonce={nonce}
                  html={built.html}
                  runtime={runtime}
                />
              </div>
            </div>
          ) : device === "tablet" ? (
            <div className="tablet-frame mx-auto h-full min-h-[560px] rounded-[1.6rem] p-4 shadow-bubble">
              <div className="h-full overflow-hidden rounded-lg bg-card">
                <PreviewFrame
                  iframeRef={iframe}
                  nonce={nonce}
                  html={built.html}
                  runtime={runtime}
                />
              </div>
            </div>
          ) : (
            <div className="flex h-full min-h-[520px] flex-col overflow-hidden rounded-lg border border-ide-border bg-card shadow-bubble">
              <div className="flex h-8 shrink-0 items-center gap-1.5 border-b border-ide-border bg-ide-side px-3">
                <span className="h-2 w-2 rounded-full bg-pin-issue" />
                <span className="h-2 w-2 rounded-full bg-sun" />
                <span className="h-2 w-2 rounded-full bg-pin-praise" />
                <span className="ml-3 h-4 flex-1 rounded bg-ide-editor" />
              </div>
              <div className="min-h-0 flex-1">
                <PreviewFrame
                  iframeRef={iframe}
                  nonce={nonce}
                  html={built.html}
                  runtime={runtime}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function PreviewFrame({
  iframeRef,
  nonce,
  html,
  runtime,
}: {
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  nonce: number;
  html: string;
  runtime: Runtime;
}) {
  if (runtime === "node") {
    return (
      <>
        <iframe
          key={nonce}
          ref={iframeRef}
          title="Node sandbox"
          sandbox="allow-scripts"
          srcDoc={html}
          className="hidden"
        />
        <div className="flex h-full min-h-[400px] items-center justify-center bg-ide-editor p-8 text-center">
          <div>
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-pin-praise/15">
              <Server className="h-8 w-8 text-pin-praise" />
            </div>
            <h3 className="font-display text-xl font-semibold text-ide-fg">
              Your server is running
            </h3>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ide-muted">
              Open the API tab to send requests. Route logs and responses appear in the terminal.
            </p>
          </div>
        </div>
      </>
    );
  }
  return (
    <iframe
      key={nonce}
      ref={iframeRef}
      title="Application preview"
      sandbox="allow-scripts allow-forms allow-modals"
      srcDoc={html}
      className="h-full min-h-[480px] w-full border-0 bg-card"
    />
  );
}

export function ApiClient({
  files,
  onLog,
}: {
  files: Record<string, string>;
  onLog: (entry: Omit<LogEntry, "id">) => void;
}) {
  const runner = useRef<HTMLIFrameElement>(null);
  const [method, setMethod] = useState("GET");
  const [path, setPath] = useState("/api/");
  const [body, setBody] = useState('{\n  "title": "My new item"\n}');
  const [response, setResponse] = useState("Send a request to inspect the JSON response.");
  const [busy, setBusy] = useState(false);
  const built = useMemo(() => buildPreview("node", files), [files]);

  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.source !== runner.current?.contentWindow) return;
      if (event.data?.__cc === "log")
        onLog({ level: event.data.level, text: String(event.data.text), source: "preview" });
      if (event.data?.__cc === "response") {
        setBusy(false);
        setResponse(
          `HTTP ${event.data.status}\n\n${typeof event.data.body === "string" ? event.data.body : JSON.stringify(event.data.body, null, 2)}`,
        );
      }
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [onLog]);

  const send = () => {
    let parsed: unknown;
    if (method !== "GET" && method !== "DELETE") {
      try {
        parsed = JSON.parse(body);
      } catch {
        setResponse("The request body is not valid JSON.");
        return;
      }
    }
    setBusy(true);
    setResponse("Sending request…");
    runner.current?.contentWindow?.postMessage(
      { __cc: "request", id: Date.now(), method, path, body: parsed },
      "*",
    );
  };

  return (
    <div className="grid h-full min-h-0 bg-ide-editor lg:grid-cols-2">
      <iframe
        ref={runner}
        title="API sandbox"
        sandbox="allow-scripts"
        srcDoc={built.html}
        className="hidden"
      />
      <div className="border-r border-ide-border p-5">
        <h3 className="font-display text-lg font-semibold text-ide-fg">API request builder</h3>
        <p className="mt-1 text-xs text-ide-muted">
          Requests go directly to the Express app in your workspace.
        </p>
        <div className="mt-5 flex gap-2">
          <select
            aria-label="HTTP method"
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="rounded border border-ide-border bg-ide-side px-2 py-2 font-mono text-xs text-ide-fg"
          >
            <option>GET</option>
            <option>POST</option>
            <option>PUT</option>
            <option>DELETE</option>
          </select>
          <input
            aria-label="API path"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            className="min-w-0 flex-1 rounded border border-ide-border bg-ide-side px-3 py-2 font-mono text-xs text-ide-fg outline-none focus:border-ide-blue"
          />
        </div>
        {method !== "GET" && method !== "DELETE" && (
          <textarea
            aria-label="JSON request body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="mt-3 h-48 w-full resize-none rounded border border-ide-border bg-ide-side p-3 font-mono text-xs text-ide-fg outline-none focus:border-ide-blue"
          />
        )}
        <button
          type="button"
          disabled={busy}
          onClick={send}
          className="mt-3 rounded bg-ide-blue px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Sending…" : "Send request"}
        </button>
      </div>
      <div className="p-5">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ide-muted">
          Response
        </h3>
        <pre className="ide-scroll h-[calc(100%-2rem)] overflow-auto whitespace-pre-wrap rounded bg-ide-side p-4 font-mono text-xs leading-relaxed text-ide-fg">
          {response}
        </pre>
      </div>
    </div>
  );
}
