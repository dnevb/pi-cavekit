# pi-cavekit

[Cavekit](https://github.com/JuliusBrussee/cavekit) spec-driven development skills for [pi](https://github.com/badlogic/pi-mono), plus a live TUI spec tracker widget.

## Install

```bash
pi install git:github.com/dnevb/pi-cavekit
```

## Skills

| Skill | Description | Invoke |
|-------|-------------|--------|
| **spec** | Create, amend, backprop `SPEC.md` | `/skill:spec` |
| **build** | Plan-then-execute against spec | `/skill:build` |
| **check** | Read-only drift detector | `/skill:check` |
| **caveman** | Token-compressed spec encoding | `/skill:caveman` |
| **backprop** | Bug → invariant protocol | `/skill:backprop` |

## Spec Tracker Widget

A persistent TUI widget that auto-detects `SPEC.md` changes and shows progress:

```
Spec: x~.. (1/4) V2 B1  impl auth middleware
```

Updates automatically when `SPEC.md` is:
- **Read** (via the read tool)
- **Written** (via the write tool)
- **Edited** (via the edit tool)
- **Session start** (reconstructs from branch or scans filesystem)

## Format

See [`FORMAT.md`](./FORMAT.md) for the `SPEC.md` schema and caveman encoding rules.

## Development

```bash
npm test
npm run test:watch
```

Tests cover:
- Spec tracker parsing, formatting, state reconstruction
- Skill validation (frontmatter, cross-references, file refs)
