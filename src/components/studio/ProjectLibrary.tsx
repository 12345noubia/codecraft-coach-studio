import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { FolderCode, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  createProject,
  deleteProject,
  getProjects,
  saveProject,
  type PersonalProject,
  type ProjectRuntime,
} from "@/lib/projects";

export function ProjectLibrary() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<PersonalProject[]>([]);
  const [name, setName] = useState("");
  const [language, setLanguage] = useState("");
  const [runtime, setRuntime] = useState<ProjectRuntime>("none");
  const [error, setError] = useState("");
  useEffect(() => setProjects(getProjects()), []);
  return (
    <section className="mb-10 border-y py-8" aria-label="Personal projects">
      <div className="mb-5 flex items-center gap-3">
        <FolderCode className="h-7 w-7 text-accent" />
        <h2 className="font-display text-2xl font-bold">Your own projects</h2>
      </div>
      <form
        className="grid items-end gap-3 md:grid-cols-[1fr_1fr_1fr_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          try {
            const project = createProject(name, language, runtime);
            saveProject(project);
            void navigate({ to: "/projects/$projectId", params: { projectId: project.id } });
          } catch {
            setError("Could not save this project. Check available browser storage and try again.");
          }
        }}
      >
        <label className="text-sm font-medium">
          Project name
          <input
            required
            maxLength={120}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="My new project"
            className="mt-1 block h-10 w-full rounded-md border bg-background px-3"
          />
        </label>
        <label className="text-sm font-medium">
          Language
          <input
            maxLength={120}
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
            placeholder="Python, JavaScript, Rust, any language…"
            className="mt-1 block h-10 w-full rounded-md border bg-background px-3"
          />
        </label>
        <label className="text-sm font-medium">
          Preview
          <select
            value={runtime}
            onChange={(event) => setRuntime(event.target.value as ProjectRuntime)}
            className="mt-1 block h-10 w-full rounded-md border bg-background px-3"
          >
            <option value="none">Code only · any language</option>
            <option value="web">HTML / CSS / JavaScript</option>
            <option value="react">React</option>
            <option value="vue">Vue</option>
            <option value="node">JavaScript / Express sandbox</option>
            <option value="fullstack">Full-stack web sandbox</option>
          </select>
        </label>
        <Button type="submit" className="h-10">
          <Plus />
          Create empty project
        </Button>
      </form>
      {error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      )}
      {projects.length > 0 && (
        <div className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <article
              key={project.id}
              className="flex items-center gap-3 rounded-lg border bg-card p-4"
            >
              <FolderCode className="h-5 w-5 shrink-0 text-accent" />
              <Link
                to="/projects/$projectId"
                params={{ projectId: project.id }}
                className="min-w-0 flex-1"
              >
                <h3 className="truncate font-semibold">{project.name}</h3>
                <p className="truncate text-xs text-muted-foreground">
                  {project.language} · {Object.keys(project.files).length} files
                </p>
              </Link>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Delete project ${project.name}`}
                title="Delete project"
                onClick={() => {
                  if (!window.confirm(`Delete “${project.name}” and all its files?`)) return;
                  try {
                    deleteProject(project.id);
                    setProjects(getProjects());
                  } catch {
                    setError("Could not delete the saved project.");
                  }
                }}
              >
                <Trash2 />
              </Button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
