import { FileCode2, FileJson, FileText, Folder, FolderOpen, Hash, Braces, Atom, Hexagon, Triangle } from "lucide-react";

export function FileIcon({ path, className = "h-4 w-4" }: { path: string; className?: string }) {
  const ext = path.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "html":
      return <FileCode2 className={`${className} text-tok-html`} />;
    case "css":
      return <Hash className={`${className} text-tok-css`} />;
    case "js":
      return <Braces className={`${className} text-tok-js`} />;
    case "jsx":
    case "tsx":
      return <Atom className={`${className} text-tok-react`} />;
    case "vue":
      return <Triangle className={`${className} text-tok-vue`} />;
    case "json":
      return <FileJson className={`${className} text-tok-json`} />;
    case "ts":
      return <Hexagon className={`${className} text-ide-blue`} />;
    default:
      return <FileText className={`${className} text-ide-muted`} />;
  }
}

export function FolderIcon({ open, className = "h-4 w-4" }: { open: boolean; className?: string }) {
  return open ? <FolderOpen className={`${className} text-tok-json`} /> : <Folder className={`${className} text-tok-json`} />;
}
