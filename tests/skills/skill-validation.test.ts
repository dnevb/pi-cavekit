import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

const skillsDir = join(process.cwd(), "skills");

interface Skill {
  dir: string;
  name: string;
  description: string;
  content: string;
}

function loadSkills(): Skill[] {
  const dirs = readdirSync(skillsDir).filter((d) => {
    const p = join(skillsDir, d);
    return statSync(p).isDirectory();
  });

  return dirs.map((dir) => {
    const path = join(skillsDir, dir, "SKILL.md");
    const content = readFileSync(path, "utf-8");

    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n/);
    let name = "";
    let description = "";

    if (frontmatterMatch) {
      const fm = frontmatterMatch[1];
      const nameMatch = fm.match(/^name:\s*(.+)$/m);
      const descMatch = fm.match(/^description:\s*\|[\s\S]*?^(\s+\S.*)$/m);
      if (nameMatch) name = nameMatch[1].trim();
      if (descMatch) description = descMatch[1].trim();
      // Also try single-line description
      if (!description) {
        const simpleDesc = fm.match(/^description:\s*(.+)$/m);
        if (simpleDesc) description = simpleDesc[1].trim();
      }
    }

    return { dir, name, description, content };
  });
}

const skills = loadSkills();
const skillNames = new Set(skills.map((s) => s.name));

describe("skills", () => {
  it("loads at least 5 skills", () => {
    expect(skills.length).toBeGreaterThanOrEqual(5);
  });

  for (const skill of skills) {
    describe(skill.dir, () => {
      it("has frontmatter with name", () => {
        expect(skill.name).toBeTruthy();
      });

      it("has frontmatter with description", () => {
        expect(skill.description).toBeTruthy();
      });

      it("name matches directory", () => {
        expect(skill.name).toBe(skill.dir);
      });

      it("name is lowercase with hyphens", () => {
        expect(skill.name).toMatch(/^[a-z0-9-]+$/);
      });

      it("name ≤ 64 chars", () => {
        expect(skill.name.length).toBeLessThanOrEqual(64);
      });

      it("references only existing skills", () => {
        const regex = /\/skill:([a-z0-9-]+)/g;
        let match;
        while ((match = regex.exec(skill.content)) !== null) {
          const ref = match[1];
          expect(skillNames).toContain(ref);
        }
      });

      it("references only existing files", () => {
        const regex = /\b([\w/.-]+\.(md|sh|ts))\b/g;
        let match;
        while ((match = regex.exec(skill.content)) !== null) {
          const ref = match[1];
          if (ref.includes("/")) {
            const base = join(skillsDir, skill.dir);
            const resolved = join(base, ref);
            if (!existsSync(resolved)) {
              const pkgRoot = join(__dirname, "../..");
              const alt = join(pkgRoot, ref);
              expect(existsSync(alt) || existsSync(resolved)).toBe(true);
            }
          }
        }
      });
    });
  }
});
