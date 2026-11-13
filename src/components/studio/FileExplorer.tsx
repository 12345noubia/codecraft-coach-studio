import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  FilePlus2,
  FolderPlus,
  MoreHorizontal,
  Trash2,
} from "lucide-react";
import { FileIcon, FolderIcon } from "@/components/ide/FileIcon";
import { cn } from "@/lib/utils";

type Node = { name: string; path: string; children: Node[]; file?: true };

function makeTree(files: Record<string, string>, folders: string[]) {
  const root: Node = { name: "", path: "", children: [] };
  const add = (path: string, file: boolean) => {
    const parts = path.split("/");
    let parent = root;
    parts.forEach((part, index) => {
      const currentPath = parts.slice(0, index + 1).join("/");
      let child = parent.children.find((node) => node.name === part);
      if (!child) {
        child = {
          name: part,
          path: currentPath,
          children: [],
          ...(index === parts.length - 1 && file ? { file: true as const } : {}),
        };
        parent.children.push(child);
      }
      parent = child;
    });
  };
  folders.forEach((path) => add(path, false));
  Object.keys(files).forEach((path) => add(path, true));
  const sort = (nodes: Node[]): Node[] =>
    nodes
      .sort((a, b) => Number(!a.file) - Number(!b.file) || a.name.localeCompare(b.name))
      .map((node) => ({ ...node, children: sort(node.children) }));
  return sort(root.children);
}

export function FileExplorer({
  files,
  folders,
  activeFile,
  onSelect,
  onCreate,
  onDelete,
  workspaceName = "Lesson workspace",
}: {
  files: Record<string, string>;
  folders: string[];
  activeFile: string;
  onSelect: (path: string) => void;
  onCreate: (kind: "file" | "folder", path: string) => string | null;
  onDelete: (path: string, kind: "file" | "folder") => void;
  workspaceName?: string;
}) {
  const tree = useMemo(() => makeTree(files, folders), [files, folders]);
  const [open, setOpen] = useState<Set<string>>(() => new Set(folders));
  const [creating, setCreating] = useState<"file" | "folder" | null>(null);
  const [path, setPath] = useState("");
  const [error, setError] = useState("");

  const submit = () => {
    if (!creating) return;
    const result = onCreate(creating, path);
    if (result) return setError(result);
    setOpen((old) => {
      const next = new Set(old);
      const parts = path.trim().replace(/\\/g, "/").split("/");
      const count = creating === "folder" ? parts.length : parts.length - 1;
      for (let i = 1; i <= count; i++) next.add(parts.slice(0, i).join("/"));
      return next;
    });
    setCreating(null);
    setPath("");
    setError("");
  };

  const renderNode = (node: Node, depth = 0): React.ReactNode => {
    const isOpen = open.has(node.path);
    if (node.file) {
      return (
        <div
          key={node.path}
          className={cn(
            "group relative flex items-center pr-1",
            activeFile === node.path && "bg-ide-active",
          )}
        >
          <button
            type="button"
            onClick={() => onSelect(node.path)}
            className="flex min-w-0 flex-1 items-center gap-1.5 py-[3px] text-left text-[13px] text-ide-fg"
            style={{ paddingLeft: 8 + depth * 13 }}
          >
            <FileIcon path={node.path} className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{node.name}</span>
          </button>
          <button
            type="button"
            aria-label={`Delete ${node.path}`}
            title={`Delete ${node.path}`}
            onClick={() => onDelete(node.path, "file")}
            className="hidden rounded p-0.5 text-ide-muted hover:bg-ide-hover hover:text-ide-fg group-hover:block"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      );
    }
    return (
      <div key={node.path}>
        <div className="group flex items-center pr-1 hover:bg-ide-hover">
          <button
            type="button"
            aria-expanded={isOpen}
            className="flex min-w-0 flex-1 items-center gap-1 py-[3px] text-left text-[13px] text-ide-fg"
            style={{ paddingLeft: 4 + depth * 13 }}
            onClick={() =>
              setOpen((old) => {
                const next = new Set(old);
                if (next.has(node.path)) next.delete(node.path);
                else next.add(node.path);
                return next;
              })
            }
          >
            {isOpen ? (
              <ChevronDown className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 shrink-0" />
            )}
            <FolderIcon open={isOpen} className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{node.name}</span>
          </button>
          <button
            type="button"
            aria-label={`Delete folder ${node.path}`}
            title={`Delete ${node.path}`}
            onClick={() => onDelete(node.path, "folder")}
            className="hidden rounded p-0.5 text-ide-muted hover:bg-ide-hover hover:text-ide-fg group-hover:block"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
        {isOpen && node.children.map((child) => renderNode(child, depth + 1))}
      </div>
    );
  };

  return (
    <aside
      className="flex h-full min-h-0 flex-col bg-ide-side text-ide-fg"
      aria-label="File explorer"
    >
      <div className="flex h-9 shrink-0 items-center justify-between px-3 text-[11px] font-semibold uppercase tracking-wider">
        <span>Explorer</span>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            title="New file"
            aria-label="New file"
            onClick={() => {
              setCreating("file");
              setError("");
            }}
            className="rounded p-1 hover:bg-ide-hover"
          >
            <FilePlus2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            title="New folder"
            aria-label="New folder"
            onClick={() => {
              setCreating("folder");
              setError("");
            }}
            className="rounded p-1 hover:bg-ide-hover"
          >
            <FolderPlus className="h-3.5 w-3.5" />
          </button>
          <MoreHorizontal className="ml-1 h-3.5 w-3.5 text-ide-muted" />
        </div>
      </div>
      <div className="border-y border-ide-border bg-ide-panel px-3 py-1 text-[11px] font-semibold uppercase tracking-wide">
        {workspaceName}
      </div>
      {creating && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
          className="border-b border-ide-border p-2"
        >
          <label className="mb-1 block text-[11px] text-ide-muted" htmlFor="new-path">
            New {creating} path
          </label>
          <input
            id="new-path"
            autoFocus
            value={path}
            onChange={(event) => setPath(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") setCreating(null);
            }}
            placeholder={creating === "file" ? "src/App.jsx" : "src/components"}
            className="w-full rounded border border-ide-blue bg-ide-editor px-2 py-1 font-mono text-xs text-ide-fg outline-none"
          />
          {error && <p className="mt-1 text-[11px] text-pin-issue">{error}</p>}
          <div className="mt-1.5 flex gap-1">
            <button
              className="rounded bg-ide-blue px-2 py-0.5 text-[11px] text-primary-foreground"
              type="submit"
            >
              Create
            </button>
            <button
              className="rounded px-2 py-0.5 text-[11px] hover:bg-ide-hover"
              type="button"
              onClick={() => setCreating(null)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      <div className="ide-scroll min-h-0 flex-1 overflow-auto py-1">
        {tree.length ? (
          tree.map((node) => renderNode(node))
        ) : (
          <div className="px-4 py-8 text-center text-xs text-ide-muted">
            Your workspace is empty.
            <br />
            Create a file to begin.
          </div>
        )}
      </div>
      <div className="border-t border-ide-border p-3 text-[11px] leading-relaxed text-ide-muted">
        Files save automatically on this device.
      </div>
    </aside>
  );
}
