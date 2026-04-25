# pi-cavekit

## §G
pi package bundling cavekit spec-driven-dev skills + spec-tracker TUI widget for pi.

## §C
- pi package format per docs/packages.md
- skills auto-discoverable from `skills/` dir
- extension TypeScript, no compile step (jiti)
- widget reconstructs state from session branch entries
- tests via vitest

## §I
- package: `pi install git:github.com/dnevb/pi-cavekit`
- skills: `/skill:spec`, `/skill:build`, `/skill:check`, `/skill:caveman`, `/skill:backprop`
- extension tool: `spec_tracker({ action: "scan"|"status"|"clear" })`
- widget: persistent TUI panel showing §T progress + §V/§B counts

## §V
V1: skills dir layout matches pi convention (`skills/<name>/SKILL.md`)
V2: each SKILL.md frontmatter has `name` + `description` fields
V3: spec-tracker widget updates on every `read`/`write`/`edit` tool call targeting `SPEC.md`
V4: spec-tracker reconstructs state from `toolResult` details on session events
V5: spec-tracker renders `§T` progress as `x/~/.` icons + counts + current task name
V6: tests validate all skills have valid frontmatter + all file refs resolve

## §T
id|status|task|cites
T1|x|copy cavekit skills into package|T1,V1,V2
T2|x|create spec-tracker extension core + widget|T2,V3,V4,V5
T3|x|create spec-tracker extension tool registration|T3,V3
T4|x|add vitest tests for skills + spec-tracker core|T4,V6
T5|x|write package.json + README|T5,V1

## §B
id|date|cause|fix
B1|2026-04-25|edit tool_result skips SPEC.md scan, widget stale|V3
B2|2026-04-25|widget renders ✓→○ not x/~/. per §V.5|V5
