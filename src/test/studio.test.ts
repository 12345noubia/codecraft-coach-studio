import { describe, expect, it } from "vitest";
import { findLesson, referenceFiles } from "@/lib/curriculum";
import { buildPreview } from "@/lib/runtime";
import {
  blankPractice,
  inspectFiles,
  normalizePath,
  similarity,
  validNewPath,
  watchThrough,
} from "@/lib/studio";

const found = findLesson("html", "first-page");
if (!found) throw new Error("Missing test lesson");
const lesson = found.lesson;

describe("studio rules", () => {
  it("starts repeat mode with empty expected files", () => {
    expect(blankPractice(lesson)).toEqual({ "index.html": "" });
  });

  it("awards full local similarity only for the complete reference", () => {
    const { files } = watchThrough(lesson, lesson.steps.length);
    expect(similarity(files, files)).toBe(100);
    expect(similarity({ "index.html": "<h1>Hello</h1>" }, files)).toBeLessThan(100);
  });

  it("rejects duplicate files and missing extensions", () => {
    expect(validNewPath("index.html", { "index.html": "" }, [])).toBe(
      "That file or folder already exists.",
    );
    expect(validNewPath("README", {}, [])).toBe(
      "Add a file extension, such as .html, .css or .js.",
    );
    expect(validNewPath("src/App.jsx", {}, [])).toBeNull();
  });

  it("normalizes safe workspace paths", () => {
    expect(normalizePath("./src//App.jsx")).toBe("src/App.jsx");
  });

  it("reports unclosed JavaScript braces", () => {
    expect(inspectFiles({ "index.js": "function hello() {" })).toEqual([
      { file: "index.js", line: 1, message: "1 opening brace is not closed.", severity: "error" },
    ]);
  });

  it("uses the stable React compiler and removes module imports", () => {
    const react = findLesson("react", "components-props");
    if (!react) throw new Error("Missing React lesson");
    const preview = buildPreview("react", referenceFiles(react.lesson)).html;
    expect(preview).toContain("@babel/standalone@7.26.4");
    expect(preview).not.toContain('import { Card } from "./components/Card"');
    expect(preview).toContain("function Card({ name, role })");
  });
});
