// AC-5 Coding / AC-7 Integrity screens: the current problem tab must be visible. jsdom cannot compute SCSS,
// so this checks the rule in student.module.scss: tokens only, scoped to .problemTabs, no animation.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const scss = readFileSync(resolve(process.cwd(), "src/components/student/student.module.scss"), "utf8").replace(/\/\*[\s\S]*?\*\//g, ""); // drop comments
const start = scss.indexOf(".problemTabs {");
let depth = 0;
let end = start;
for (let i = scss.indexOf("{", start); i < scss.length; i++) {
  if (scss[i] === "{") depth++;
  if (scss[i] === "}" && --depth === 0) {
    end = i;
    break;
  }
}
const block = scss.slice(start, end + 1);
const rule = (selector: string) => {
  const i = block.indexOf(`${selector} {`);
  return i < 0 ? "" : block.slice(i, block.indexOf("}", i));
};

describe(".problemTabs selected tab style", () => {
  it("fills the selected tab with primary and light text", () => {
    const selected = rule('[role="tab"][aria-selected="true"]');
    expect(selected).toContain("background: var(--ui-color-primary)");
    expect(selected).toContain("color: var(--ui-color-primary-fg)");
  });

  it("gives unselected tabs readable text and a visible border", () => {
    const tab = rule('[role="tab"]');
    expect(tab).toContain("color: var(--ui-color-text)");
    expect(tab).toContain("border: 1px solid var(--ui-color-border-input)");
  });

  it("uses tokens only, no animation, and leaves the shared .segmentBtn alone", () => {
    expect(block).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(block).not.toMatch(/transition|animation/);
    expect(block).not.toMatch(/outline/); // the focus ring still comes from .segmentBtn
    expect(scss).not.toMatch(/\.segmentBtn/); // not restyled globally from here
  });
});
