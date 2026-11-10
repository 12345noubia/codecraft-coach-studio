import { createFileRoute } from "@tanstack/react-router";
import hero from "@/assets/hero-meadow.jpg";
import logo from "@/assets/logo.png";
import teacher from "@/assets/sticker-teacher.png";
import trophy from "@/assets/sticker-trophy.png";
import { tracks } from "@/lib/curriculum";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CodeCraft Academy — Learn to code with an AI teacher" },
      { name: "description", content: "A VS Code style learning studio where an AI teacher codes with you, explains every line and grades your work." },
      { property: "og:title", content: "CodeCraft Academy" },
      { property: "og:description", content: "Learn HTML, CSS, JavaScript, React, Vue, Node and Express with an AI teacher." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-background paper-grain">
      <header className="mx-auto flex max-w-6xl items-center gap-3 px-6 py-5">
        <img src={logo} alt="CodeCraft logo" width={40} height={40} className="h-10 w-10" />
        <span className="font-display text-xl font-bold">CodeCraft Academy</span>
      </header>
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-6 py-10 md:grid-cols-2">
        <div>
          <h1 className="font-display text-5xl font-extrabold leading-tight md:text-6xl">
            Learn to code with a teacher who <span className="crayon-underline">codes beside you</span>
          </h1>
          <p className="mt-5 text-lg text-muted-foreground">
            Watch Ada build line by line, repeat it yourself, answer her questions, then rebuild from scratch and earn your score.
          </p>
          <div className="mt-6 flex items-center gap-4">
            <img src={teacher} alt="Ada the teacher" width={96} height={96} className="float-y h-24 w-24" />
            <img src={trophy} alt="Trophy" width={72} height={72} className="h-18 w-18" loading="lazy" />
          </div>
        </div>
        <img src={hero} alt="Child flying a code kite" width={1536} height={864} className="rounded-3xl shadow-soft" />
      </section>
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <h2 className="font-display mb-6 text-3xl font-bold">Learning paths</h2>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {tracks.map((t) => (
            <article key={t.id} className="overflow-hidden rounded-2xl border bg-card shadow-soft">
              <img src={t.image} alt={t.name} loading="lazy" className="h-32 w-full object-cover" />
              <div className="p-4">
                <h3 className="font-display text-lg font-bold">{t.name}</h3>
                <p className="text-sm text-muted-foreground">{t.tagline}</p>
                <ul className="mt-3 space-y-1 text-sm">
                  {t.lessons.map((l) => (
                    <li key={l.id} className="flex justify-between gap-2">
                      <span className="min-w-0 truncate">{l.title}</span>
                      <span className="shrink-0 text-muted-foreground">{l.xp} XP</span>
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
