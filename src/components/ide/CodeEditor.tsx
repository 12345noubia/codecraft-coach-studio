import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import CodeMirror, { EditorView, type ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { python } from "@codemirror/lang-python";
import { java } from "@codemirror/lang-java";
import { cpp } from "@codemirror/lang-cpp";
import { rust } from "@codemirror/lang-rust";
import { sql } from "@codemirror/lang-sql";
import { markdown } from "@codemirror/lang-markdown";
import { yaml } from "@codemirror/lang-yaml";
import { StreamLanguage } from "@codemirror/language";
import { go } from "@codemirror/legacy-modes/mode/go";
import { ruby } from "@codemirror/legacy-modes/mode/ruby";
import { shell } from "@codemirror/legacy-modes/mode/shell";
import { csharp } from "@codemirror/legacy-modes/mode/clike";
import { vscodeDark } from "@uiw/codemirror-theme-vscode";

export type Overlay = {
  key: string;
  line: number;
  node: ReactNode;
  highlight?: "teacher" | "issue" | "question" | "praise";
};

function langFor(path: string) {
  const ext = path.split(".").pop()?.toLowerCase();
  if (ext === "html" || ext === "vue") return [html()];
  if (ext === "css") return [css()];
  if (ext === "json") return [json()];
  if (ext === "py" || ext === "pyw") return [python()];
  if (ext === "java") return [java()];
  if (["c", "h", "cpp", "hpp", "cc"].includes(ext ?? "")) return [cpp()];
  if (ext === "cs") return [StreamLanguage.define(csharp)];
  if (ext === "rs") return [rust()];
  if (ext === "sql") return [sql()];
  if (ext === "md" || ext === "markdown") return [markdown()];
  if (ext === "yaml" || ext === "yml") return [yaml()];
  if (ext === "go") return [StreamLanguage.define(go)];
  if (ext === "rb") return [StreamLanguage.define(ruby)];
  if (ext === "sh" || ext === "bash") return [StreamLanguage.define(shell)];
  if (ext === "js" || ext === "jsx" || ext === "ts" || ext === "tsx")
    return [javascript({ jsx: true, typescript: ext.startsWith("t") })];
  return [];
}

const HL: Record<string, string> = {
  teacher: "bg-pin-teacher/15 border-l-2 border-pin-teacher",
  issue: "bg-pin-issue/12 border-l-2 border-pin-issue",
  question: "bg-pin-question/12 border-l-2 border-pin-question",
  praise: "bg-pin-praise/10 border-l-2 border-pin-praise",
};

export function CodeEditor({
  path,
  value,
  onChange,
  readOnly,
  overlays,
  followLine,
  onCursor,
}: {
  path: string;
  value: string;
  onChange: (v: string) => void;
  readOnly: boolean;
  overlays: Overlay[];
  followLine?: number | undefined;
  onCursor?: (line: number, col: number) => void;
}) {
  const ref = useRef<ReactCodeMirrorRef>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const [tick, setTick] = useState(0);
  const extensions = useMemo(
    () => [
      ...langFor(path),
      EditorView.lineWrapping,
      EditorView.updateListener.of((u) => {
        if (u.geometryChanged || u.viewportChanged || u.docChanged) setTick((t) => t + 1);
        if (u.selectionSet && onCursor) {
          const head = u.state.selection.main.head;
          const line = u.state.doc.lineAt(head);
          onCursor(line.number, head - line.from + 1);
        }
      }),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [path],
  );

  useEffect(() => {
    const view = ref.current?.view;
    if (!view) return;
    const onScroll = () => setTick((t) => t + 1);
    view.scrollDOM.addEventListener("scroll", onScroll);
    return () => view.scrollDOM.removeEventListener("scroll", onScroll);
  }, [path, tick === 0]);

  useEffect(() => {
    const view = ref.current?.view;
    if (!view || !followLine) return;
    const n = Math.min(Math.max(1, followLine), view.state.doc.lines);
    const pos = view.state.doc.line(n).to;
    view.dispatch({ effects: EditorView.scrollIntoView(pos, { y: "center" }) });
  }, [followLine, value]);

  const position = useCallback(
    (lineNo: number) => {
      const view = ref.current?.view;
      const box = wrap.current?.getBoundingClientRect();
      if (!view || !box) return null;
      const n = Math.min(Math.max(1, lineNo), view.state.doc.lines);
      const line = view.state.doc.line(n);
      const start = view.coordsAtPos(line.from);
      const end = view.coordsAtPos(line.to) ?? start;
      if (!start || !end) return null;
      const top = start.top - box.top;
      if (top < -10 || top > box.height - 10) return null;
      const contentLeft = view.contentDOM.getBoundingClientRect().left - box.left;
      return {
        top,
        height: start.bottom - start.top,
        right: end.right - box.left,
        contentLeft,
        width: box.width,
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tick],
  );

  return (
    <div ref={wrap} className="relative h-full overflow-hidden bg-ide-editor">
      <CodeMirror
        ref={ref}
        value={value}
        height="100%"
        theme={vscodeDark}
        extensions={extensions}
        editable={!readOnly}
        readOnly={readOnly}
        onChange={onChange}
        basicSetup={{
          lineNumbers: true,
          foldGutter: true,
          highlightActiveLine: !readOnly,
          autocompletion: true,
          bracketMatching: true,
          closeBrackets: true,
        }}
        className="h-full"
      />
      <div className="pointer-events-none absolute inset-0">
        {overlays.map((o) => {
          const p = position(o.line);
          if (!p) return null;
          const left = Math.min(
            Math.max(p.right + 18, p.contentLeft + 80),
            Math.max(p.contentLeft + 40, p.width - 300),
          );
          return (
            <div key={o.key}>
              {o.highlight && (
                <div
                  className={`absolute ${HL[o.highlight]}`}
                  style={{ top: p.top, height: p.height, left: p.contentLeft - 4, right: 0 }}
                />
              )}
              <div className="pointer-events-auto absolute z-10" style={{ top: p.top - 4, left }}>
                {o.node}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
