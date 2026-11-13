import { beforeEach, describe, expect, it } from "vitest";
import { applyProjectCorrection, createProject, getProjects, saveProject } from "@/lib/projects";
import { validNewPath } from "@/lib/studio";

describe("personal projects", () => {
  it("allows extensionless project files without bypassing path conflicts", () => {
    expect(validNewPath("src/Makefile", {}, [], false, false)).toBeNull();
    expect(validNewPath("src/Makefile", { "src/Makefile": "" }, [], false, false)).toBe(
      "That file or folder already exists.",
    );
    expect(validNewPath("README", {}, ["README"], false, false)).toBe(
      "That file or folder already exists.",
    );
  });
  beforeEach(() => localStorage.clear());
  it("starts an independent project with no files or folders", () => {
    const project = createProject("My Python project", "Python", "none");
    expect(project.files).toEqual({});
    expect(project.folders).toEqual([]);
    expect(project.runtime).toBe("none");
  });
  it("saves arbitrary language source separately from lessons", () => {
    const project = createProject("Python", "Python", "none");
    project.files = { "main.py": "print('hello')" };
    saveProject(project);
    expect(getProjects()[0]?.files["main.py"]).toBe("print('hello')");
    expect(localStorage.getItem("codecraft:progress")).toBeNull();
  });
  it("applies an approved correction to the reviewed file", () => {
    expect(
      applyProjectCorrection(
        { "main.py": "print('hello'" },
        { "main.py": "print('hello'" },
        { file: "main.py", explanation: "Close parenthesis", content: "print('hello')" },
      ),
    ).toEqual({ "main.py": "print('hello')" });
  });
  it("never overwrites edits made after review", () => {
    expect(
      applyProjectCorrection(
        { "main.py": "print('new')" },
        { "main.py": "print('old')" },
        { file: "main.py", explanation: "Fix", content: "print('fixed')" },
      ),
    ).toBeNull();
  });
});
