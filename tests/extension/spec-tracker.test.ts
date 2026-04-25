import { describe, expect, it } from 'vitest';
import {
  type BranchEntry,
  formatStatus,
  formatWidgetData,
  handleClear,
  handleScan,
  handleStatus,
  parseSpec,
  reconstructFromBranch,
  type SpecState,
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
});

describe('formatStatus', () => {
  it('formats full spec status', () => {
    const s = parseSpec(SAMPLE_SPEC);
    const out = formatStatus(s);
    expect(out).toContain('Goal: build auth service');
    expect(out).toContain('Tasks: 1/3 complete (1 in progress, 1 pending)');
    expect(out).toContain('Invariants: 2 | Bugs: 1');
    expect(out).toContain('x [T1] scaffold repo');
    expect(out).toContain('~ [T2] impl auth mw');
    expect(out).toContain('. [T3] add tests');
  });

  it('handles empty state', () => {
    const out = formatStatus({ tasks: [], invariantCount: 0, bugCount: 0, goal: '' });
    expect(out).toBe('No SPEC.md parsed.');
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
    expect(r.text).toContain('Tasks: 1/3 complete');
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

describe('handleStatus', () => {
  it('returns current state', () => {
    const state: SpecState = {
      tasks: [{ id: 'T1', name: 'foo', status: 'complete', cites: '' }],
      invariantCount: 1,
      bugCount: 0,
      goal: 'g',
    };
    const r = handleStatus(state);
    expect(r.error).toBeUndefined();
    expect(r.state.tasks).toHaveLength(1);
    expect(r.text).toContain('x [T1] foo');
  });
});

describe('handleClear', () => {
  it('returns empty state', () => {
    const r = handleClear();
    expect(r.error).toBeUndefined();
    expect(r.state.tasks).toHaveLength(0);
    expect(r.state.invariantCount).toBe(0);
    expect(r.text).toBe('Spec tracker cleared.');
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
