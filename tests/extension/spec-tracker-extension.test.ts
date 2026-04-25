import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:fs', () => ({
  readFileSync: vi.fn(() => ''),
}));

vi.mock('node:path', () => ({
  resolve: vi.fn((...args: string[]) => args.join('/')),
}));

import extension from '../../extensions/spec-tracker.js';

describe('spec-tracker extension event handlers', () => {
  let pi: any;
  let handlers: Record<string, Function>;
  let ctx: any;

  beforeEach(() => {
    handlers = {};
    pi = {
      on: vi.fn((event: string, handler: Function) => {
        handlers[event] = handler;
      }),
      registerTool: vi.fn(),
    };
    ctx = {
      hasUI: true,
      ui: { setWidget: vi.fn() },
      cwd: '/project',
      sessionManager: { getBranch: vi.fn(() => []) },
    };
  });

  it('scans SPEC.md on session_start when no prior state exists', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(`## §G
goal
## §T
id|status|task|cites
T1|x|task1|-
`);

    extension(pi);
    expect(handlers.session_start).toBeDefined();

    ctx.sessionManager.getBranch.mockReturnValue([]);

    await handlers.session_start({}, ctx);

    expect(path.resolve).toHaveBeenCalledWith('/project', 'SPEC.md');
    expect(fs.readFileSync).toHaveBeenCalledWith('/project/SPEC.md', 'utf-8');
    expect(ctx.ui.setWidget).toHaveBeenCalledWith('spec_tracker', expect.any(Function));
  });

  it('calls setWidget on session_start', async () => {
    ctx.sessionManager.getBranch.mockReturnValue([
      {
        type: 'message',
        message: {
          role: 'toolResult',
          toolName: 'spec_tracker',
          details: {
            action: 'scan',
            state: {
              tasks: [{ id: 'T1', name: 'task1', status: 'complete', cites: '' }],
              invariantCount: 1,
              bugCount: 0,
              goal: 'goal',
            },
          },
        },
      },
    ]);

    extension(pi);
    expect(handlers.session_start).toBeDefined();

    await handlers.session_start({}, ctx);

    expect(ctx.ui.setWidget).toHaveBeenCalledWith('spec_tracker', expect.any(Function));
  });

  it('updates widget on write tool_call', async () => {
    extension(pi);
    expect(handlers.tool_call).toBeDefined();

    const event = {
      toolName: 'write',
      input: {
        path: 'SPEC.md',
        content: '## §G\nwrite goal\n\n## §T\nid|status|task|cites\nT1|x|write task|-\n',
      },
    };

    await handlers.tool_call(event, ctx);
    expect(ctx.ui.setWidget).toHaveBeenCalledWith('spec_tracker', expect.any(Function));
  });

  it('updates widget on read tool_result', async () => {
    extension(pi);
    expect(handlers.tool_result).toBeDefined();

    const event = {
      toolName: 'read',
      input: { path: 'SPEC.md' },
      content: [{ type: 'text', text: '## §G\nread goal\n\n## §T\nid|status|task|cites\nT1|x|read task|-\n' }],
      isError: false,
    };

    await handlers.tool_result(event, ctx);
    expect(ctx.ui.setWidget).toHaveBeenCalledWith('spec_tracker', expect.any(Function));
  });

  it('updates widget on edit tool_result', async () => {
    const fs = await import('node:fs');
    (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(
      '## §G\nedit goal\n\n## §T\nid|status|task|cites\nT1|x|edit task|-\n',
    );

    extension(pi);
    expect(handlers.tool_result).toBeDefined();

    const event = {
      toolName: 'edit',
      input: { path: 'SPEC.md' },
      content: [],
      isError: false,
    };

    await handlers.tool_result(event, ctx);
    expect(fs.readFileSync).toHaveBeenCalledWith('/project/SPEC.md', 'utf-8');
    expect(ctx.ui.setWidget).toHaveBeenCalledWith('spec_tracker', expect.any(Function));
  });
});
