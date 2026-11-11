import { Award, Flame, Star, Trophy, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import trophy from "@/assets/sticker-trophy.png";
import type { Progress } from "@/lib/progress";
import { levelFor, rankFor } from "@/lib/progress";

const BADGES = [
  { id: "First steps", name: "First steps", detail: "Complete your first lesson", icon: Star },
  { id: "Curious mind", name: "Curious mind", detail: "Answer Ada's code question", icon: Award },
  {
    id: "Challenge accepted",
    name: "Challenge accepted",
    detail: "Pass a from-scratch challenge",
    icon: Trophy,
  },
  { id: "On a roll", name: "On a roll", detail: "Learn on two days in a row", icon: Flame },
];

export function Celebration({
  open,
  onOpenChange,
  title,
  score,
  xp,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  score: number;
  xp: number;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden text-center sm:max-w-md">
        {open && (
          <div aria-hidden>
            {Array.from({ length: 36 }, (_, index) => (
              <span
                key={index}
                className={`confetti confetti-${index % 4}`}
                style={{
                  left: `${(index * 37) % 100}%`,
                  animationDuration: `${2.4 + (index % 5) * 0.3}s`,
                  animationDelay: `${(index % 7) * 0.08}s`,
                }}
              />
            ))}
          </div>
        )}
        <img src={trophy} alt="Lesson trophy" className="pop mx-auto h-32 w-32" />
        <DialogHeader>
          <DialogTitle className="font-display text-3xl">Lesson complete</DialogTitle>
          <DialogDescription className="text-base">
            You finished <strong>{title}</strong>. Your code, score and achievement are saved.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-secondary p-4">
            <div className="font-display text-3xl font-bold">{score}%</div>
            <div className="text-xs text-muted-foreground">Challenge score</div>
          </div>
          <div className="rounded-xl bg-secondary p-4">
            <div className="font-display text-3xl font-bold">+{xp}</div>
            <div className="text-xs text-muted-foreground">Experience earned</div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="mx-auto rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground"
        >
          Keep learning
        </button>
      </DialogContent>
    </Dialog>
  );
}

export function Achievements({
  open,
  onOpenChange,
  progress,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  progress: Progress;
}) {
  const level = levelFor(progress.xp);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Your learning collection</DialogTitle>
          <DialogDescription>
            Level {level.level} · {rankFor(level.level)} · {progress.xp} XP
          </DialogDescription>
        </DialogHeader>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-accent transition-all"
            style={{ width: `${Math.min(100, (level.into / level.span) * 100)}%` }}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {BADGES.map(({ id, name, detail, icon: Icon }) => {
            const earned =
              progress.badges.includes(id) || (id === "On a roll" && progress.streak >= 2);
            return (
              <div
                key={id}
                className={`rounded-xl border p-4 ${earned ? "bg-card" : "opacity-45 grayscale"}`}
              >
                <Icon className="mb-3 h-7 w-7 text-accent" />
                <h3 className="font-display font-semibold">{name}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
                <span className="mt-2 inline-block text-[11px] font-semibold uppercase tracking-wide">
                  {earned ? "Earned" : "Locked"}
                </span>
              </div>
            );
          })}
        </div>
        <div className="rounded-xl bg-secondary p-4 text-sm">
          <strong>{Object.keys(progress.completed).length}</strong> lessons completed ·{" "}
          <strong>{progress.streak}</strong> day streak
        </div>
      </DialogContent>
    </Dialog>
  );
}
