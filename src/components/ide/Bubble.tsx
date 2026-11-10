import { useState, type ReactNode } from "react";
import teacher from "@/assets/sticker-teacher.png";
import { cn } from "@/lib/utils";

const PIN: Record<string, string> = {
  teacher: "bg-pin-teacher",
  praise: "bg-pin-praise",
  issue: "bg-pin-issue",
  question: "bg-pin-question",
};

export function Pin({ kind, label }: { kind: keyof typeof PIN; label?: string }) {
  return (
    <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full rounded-bl-none border-2 border-bubble text-[11px] font-bold text-bubble shadow-bubble", PIN[kind])}>
      {label ?? <img src={teacher} alt="" className="h-5 w-5 rounded-full object-contain" />}
    </span>
  );
}

export function CommentBubble({
  kind,
  title,
  children,
  collapsible = false,
  defaultOpen = true,
  pinLabel,
}: {
  kind: "teacher" | "praise" | "issue" | "question";
  title: string;
  children: ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
  pinLabel?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bubble-in flex items-start gap-1.5">
      <button type="button" onClick={() => collapsible && setOpen((o) => !o)} aria-label={open ? "Collapse comment" : "Open comment"}>
        <Pin kind={kind} {...(pinLabel ? { label: pinLabel } : {})} />
      </button>
      {open && (
        <div className="w-[280px] max-w-[60vw] rounded-xl rounded-tl-sm bg-bubble p-3 text-bubble-fg shadow-bubble">
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold">{title}</span>
            {collapsible && (
              <button type="button" onClick={() => setOpen(false)} className="text-[11px] text-muted-foreground hover:text-foreground">
                Hide
              </button>
            )}
          </div>
          <div className="text-[13px] leading-relaxed">{children}</div>
        </div>
      )}
    </div>
  );
}
