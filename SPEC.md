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
- widget: auto-updates on SPEC.md read/write/edit + session events

## §V
V1: skills dir layout matches pi convention (`skills/<name>/SKILL.md`)
V2: each SKILL.md frontmatter has `name` + `description` fields
V3: spec-tracker widget updates on SPEC.md read/write/edit AND on session_start when branch has no prior state
V4: spec-tracker reconstructs state from `toolResult` details on session events
V5: spec-tracker renders `§T` progress as `x/~/.` icons + counts + current task name
V6: tests validate all skills have valid frontmatter + all file refs resolve

## §T
id|status|task|cites
T1|x|copy cavekit skills into package|T1,V1,V2
T2|x|create spec-tracker extension core + widget|T2,V3,V4,V5

T4|x|add vitest tests for skills + spec-tracker core|T4,V6
T5|x|write package.json + README|T5,V1
T6|x|add biome lint + format config|V1

## §B
id|date|cause|fix
B1|2026-04-25|edit tool_result skips SPEC.md scan, widget stale|V3
B2|2026-04-25|widget renders ✓→○ not x/~/. per §V.5|V5
B3|2026-04-25|session_start reconstructs state but skips scan when branch empty, widget not loaded on pi open|V3
