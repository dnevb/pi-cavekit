import { describe, expect, it } from 'vitest';
import {
  type BranchEntry,
  formatWidgetData,
  handleScan,
  parseSpec,
  reconstructFromBranch,
} from '../../extensions/spec-tracker-core.js';

const SAMPLE_SPEC = `# my-project

## §G
build auth service

## §C
- node.js 20
- postgres

## §I
api: POST /auth → 200 {token}

## §V
V1: ∀ req → auth check before handler
V2: token expiry ≤ current_time → reject

## §T
id|status|task|cites
T1|x|scaffold repo|-
T2|~|impl auth mw|V1
T3|.|add tests|V2

## §B
id|date|cause|fix
B1|2026-04-20|token \`<\` not \`≤\`|V2
`;

const EMPTY_SPEC = `# project

## §G
goal here

## §V

## §T
id|status|task|cites

## §B
id|date|cause|fix
`;

const NO_SPEC_TASKS = `## §G
no tasks

## §V
V1: foo
`;

const TITLED_SPEC = `## §G GOAL
build auth service

## §C CONSTRAINTS
- node.js 20

## §I INTERFACE
api: POST /auth → 200 {token}

## §V INVARIANTS
V1: ∀ req → auth check before handler

## §T TASKS
id|status|task|cites
T1|x|scaffold repo|-

## §B BUGS
id|date|cause|fix
B1|2026-04-20|token typo|V1
`;

describe('parseSpec', () => {
  it('parses full spec', () => {
    const s = parseSpec(SAMPLE_SPEC);
    expect(s.goal).toBe('build auth service');
    expect(s.invariantCount).toBe(2);
    expect(s.bugCount).toBe(1);
    expect(s.tasks).toHaveLength(3);
    expect(s.tasks[0]).toEqual({ id: 'T1', name: 'scaffold repo', status: 'complete', cites: '-' });
    expect(s.tasks[1]).toEqual({
      id: 'T2',
      name: 'impl auth mw',
      status: 'in_progress',
      cites: 'V1',
    });
    expect(s.tasks[2]).toEqual({ id: 'T3', name: 'add tests', status: 'pending', cites: 'V2' });
  });

  it('parses empty tables', () => {
    const s = parseSpec(EMPTY_SPEC);
    expect(s.goal).toBe('goal here');
    expect(s.invariantCount).toBe(0);
    expect(s.bugCount).toBe(0);
    expect(s.tasks).toHaveLength(0);
  });

  it('parses spec with no tasks', () => {
    const s = parseSpec(NO_SPEC_TASKS);
    expect(s.goal).toBe('no tasks');
    expect(s.invariantCount).toBe(1);
    expect(s.bugCount).toBe(0);
    expect(s.tasks).toHaveLength(0);
  });

  it('parses titled section headers', () => {
    const s = parseSpec(TITLED_SPEC);
    expect(s.goal).toBe('build auth service');
    expect(s.invariantCount).toBe(1);
    expect(s.bugCount).toBe(1);
    expect(s.tasks).toHaveLength(1);
    expect(s.tasks[0]).toEqual({ id: 'T1', name: 'scaffold repo', status: 'complete', cites: '-' });
  });
});

describe('formatWidgetData', () => {
  it('formats widget data for full spec', () => {
    const s = parseSpec(SAMPLE_SPEC);
    const d = formatWidgetData(s);
    expect(d.icons).toEqual(['x', '~', '.']);
    expect(d.complete).toBe(1);
    expect(d.total).toBe(3);
    expect(d.currentName).toBe('impl auth mw');
    expect(d.invariantCount).toBe(2);
    expect(d.bugCount).toBe(1);
  });

  it('returns empty for no tasks', () => {
    const s = parseSpec(NO_SPEC_TASKS);
    const d = formatWidgetData(s);
    expect(d.icons).toEqual([]);
    expect(d.complete).toBe(0);
    expect(d.total).toBe(0);
    expect(d.currentName).toBe('');
    expect(d.invariantCount).toBe(1);
    expect(d.bugCount).toBe(0);
  });
});

describe('handleScan', () => {
  it('scans valid spec', () => {
    const r = handleScan(SAMPLE_SPEC);
    expect(r.error).toBeUndefined();
    expect(r.state.tasks).toHaveLength(3);
    expect(r.state.invariantCount).toBe(2);
    expect(r.state.bugCount).toBe(1);
  });

  it('errors on empty content', () => {
    const r = handleScan('');
    expect(r.error).toBe('no spec content');
    expect(r.state.tasks).toHaveLength(0);
  });

  it('errors on undefined', () => {
    const r = handleScan(undefined);
    expect(r.error).toBe('no spec content');
  });
});

describe('reconstructFromBranch', () => {
  it('reconstructs from tool results', () => {
    const entries: BranchEntry[] = [
      { type: 'message', message: { role: 'user' } },
      {
        type: 'message',
        message: {
          role: 'toolResult',
          toolName: 'spec_tracker',
          details: {
            action: 'scan',
            state: {
              tasks: [{ id: 'T1', name: 'x', status: 'complete', cites: '' }],
              invariantCount: 2,
              bugCount: 1,
              goal: 'g',
            },
          },
        },
      },
    ];
    const state = reconstructFromBranch(entries);
    expect(state.tasks).toHaveLength(1);
    expect(state.invariantCount).toBe(2);
    expect(state.bugCount).toBe(1);
  });

  it('ignores errors', () => {
    const entries: BranchEntry[] = [
      {
        type: 'message',
        message: {
          role: 'toolResult',
          toolName: 'spec_tracker',
          details: {
            action: 'scan',
            state: { tasks: [], invariantCount: 0, bugCount: 0, goal: '' },
            error: 'bad',
          },
        },
      },
      {
        type: 'message',
        message: {
          role: 'toolResult',
          toolName: 'spec_tracker',
          details: {
            action: 'scan',
            state: {
              tasks: [{ id: 'T1', name: 'x', status: 'complete', cites: '' }],
              invariantCount: 1,
              bugCount: 0,
              goal: 'g',
            },
          },
        },
      },
    ];
    const state = reconstructFromBranch(entries);
    expect(state.tasks).toHaveLength(1);
  });

  it('returns empty on no matches', () => {
    const state = reconstructFromBranch([]);
    expect(state.tasks).toHaveLength(0);
  });
});
