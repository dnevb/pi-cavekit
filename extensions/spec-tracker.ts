import * as fs from 'node:fs';
import * as path from 'node:path';
import { StringEnum } from '@mariozechner/pi-ai';
import type { ExtensionAPI, ExtensionContext, Theme } from '@mariozechner/pi-coding-agent';
import {
  isEditToolResult,
  isReadToolResult,
  isToolCallEventType,
} from '@mariozechner/pi-coding-agent';
import { Text } from '@mariozechner/pi-tui';
import { Type } from 'typebox';
import {
  type BranchEntry,
  formatWidgetData,
  handleClear,
  handleScan,
  handleStatus,
  reconstructFromBranch,
  type SpecState,
  type SpecTrackerDetails,
} from './spec-tracker-core.js';

const SpecTrackerParams = Type.Object({
  action: StringEnum(['scan', 'status', 'clear'] as const, {
    description: 'Action to perform',
  }) as any,
});

export type SpecTrackerInput = {
  action: 'scan' | 'status' | 'clear';
};

const SPEC_PATH = 'SPEC.md';

function isSpecPath(p: string | undefined): boolean {
  if (!p) return false;
  return p === SPEC_PATH || p.endsWith(`/${SPEC_PATH}`);
}

function renderWidgetText(state: SpecState, theme: Theme): string {
  const data = formatWidgetData(state);
  if (data.total === 0 && data.invariantCount === 0) return '';

  const icons = data.icons
    .map((icon) => {
      switch (icon) {
        case 'x':
          return theme.fg('success', 'x');
        case '~':
          return theme.fg('warning', '~');
        default:
          return theme.fg('dim', '.');
      }
    })
    .join('');

  const counts = `(${data.complete}/${data.total})`;
  const meta = `V${data.invariantCount} B${data.bugCount}`;
  const currentName = data.currentName ? `  ${data.currentName}` : '';

  if (data.total === 0) {
    return `${theme.fg('muted', 'Spec:')} ${theme.fg('muted', meta)}`;
  }

  return `${theme.fg('muted', 'Spec:')} ${icons} ${theme.fg('muted', counts)} ${theme.fg('dim', meta)}${currentName}`;
}

export default function (pi: ExtensionAPI) {
  let state: SpecState = { tasks: [], invariantCount: 0, bugCount: 0, goal: '' };

  const reconstructState = (ctx: ExtensionContext) => {
    state = reconstructFromBranch(ctx.sessionManager.getBranch() as BranchEntry[]);
  };

  const updateWidget = (ctx: ExtensionContext) => {
    if (!ctx.hasUI) return;
    if (state.tasks.length === 0 && state.invariantCount === 0) {
      ctx.ui.setWidget('spec_tracker', undefined);
    } else {
      ctx.ui.setWidget('spec_tracker', (_tui, theme) => {
        return new Text(renderWidgetText(state, theme), 0, 0);
      });
    }
  };

  const scanFromText = (text: string, ctx: ExtensionContext) => {
    const result = handleScan(text);
    if (!result.error) {
      state = result.state;
      updateWidget(ctx);
    }
    return result;
  };

  pi.on('session_start', async (_event: any, ctx: ExtensionContext) => {
    reconstructState(ctx);
    if (state.tasks.length === 0 && state.invariantCount === 0) {
      try {
        const specPath = path.resolve(ctx.cwd, SPEC_PATH);
        const text = fs.readFileSync(specPath, 'utf-8');
        scanFromText(text, ctx);
      } catch {
        // ignore missing SPEC.md
      }
    } else {
      updateWidget(ctx);
    }
  });
  pi.on('session_tree', async (_event: any, ctx: ExtensionContext) => {
    reconstructState(ctx);
    updateWidget(ctx);
  });

  pi.on('tool_result', async (event, ctx) => {
    let text: string | undefined;
    const inputPath = (event.input as { path?: string }).path;

    if (isReadToolResult(event) && isSpecPath(inputPath)) {
      const contentItem = event.content.find((c) => c.type === 'text');
      if (contentItem?.type === 'text') {
        text = contentItem.text;
      }
    }

    if (isEditToolResult(event) && isSpecPath(inputPath)) {
      try {
        const specPath = path.resolve(ctx.cwd, SPEC_PATH);
        text = fs.readFileSync(specPath, 'utf-8');
      } catch {
        // ignore
      }
    }

    if (text) scanFromText(text, ctx);
  });

  pi.on('tool_call', async (event, ctx) => {
    const callInputPath = (event.input as { path?: string }).path;
    if (isToolCallEventType('write', event) && isSpecPath(callInputPath)) {
      const content = (event.input as { content?: string }).content;
      if (content) scanFromText(content, ctx);
    }
  });

  pi.registerTool({
    name: 'spec_tracker',
    label: 'Spec Tracker',
    description:
      'Track SPEC.md progress. Actions: scan (parse current SPEC.md), status (show cached state), clear (reset). Auto-scans on SPEC.md reads.',
    parameters: SpecTrackerParams,

    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      let result;

      switch (params.action) {
        case 'scan': {
          const specPath = path.resolve(ctx.cwd, SPEC_PATH);
          let text = '';
          try {
            text = fs.readFileSync(specPath, 'utf-8');
          } catch {
            return {
              content: [{ type: 'text', text: 'Error: SPEC.md not found' }],
              details: {
                action: 'scan',
                state: { tasks: [], invariantCount: 0, bugCount: 0, goal: '' },
                error: 'SPEC.md not found',
              } as SpecTrackerDetails,
            };
          }
          result = handleScan(text);
          if (!result.error) {
            state = result.state;
            updateWidget(ctx);
          }
          break;
        }
        case 'status': {
          result = handleStatus(state);
          break;
        }
        case 'clear': {
          result = handleClear();
          state = result.state;
          updateWidget(ctx);
          break;
        }
        default:
          return {
            content: [{ type: 'text', text: `Unknown action: ${params.action}` }],
            details: {
              action: params.action as 'scan',
              state: { ...state },
              error: 'unknown action',
            } as SpecTrackerDetails,
          };
      }

      const details: SpecTrackerDetails = {
        action: params.action,
        state: result.state,
        ...(result.error ? { error: result.error } : {}),
      };

      return {
        content: [{ type: 'text', text: result.text }],
        details,
      };
    },

    renderCall(args, theme) {
      const a = args as SpecTrackerInput;
      let text = theme.fg('toolTitle', theme.bold('spec_tracker '));
      text += theme.fg('muted', a.action);
      return new Text(text, 0, 0);
    },

    renderResult(result, _options, theme) {
      const details = result.details as SpecTrackerDetails | undefined;
      if (!details) {
        const text = result.content[0] as { type?: string; text?: string } | undefined;
        return new Text(text?.type === 'text' ? text.text : '', 0, 0);
      }

      if (details.error) {
        return new Text(theme.fg('error', `Error: ${details.error}`), 0, 0);
      }

      const s = details.state;
      switch (details.action) {
        case 'scan':
          return new Text(
            theme.fg('success', '✓ ') +
              theme.fg(
                'muted',
                `Scanned SPEC.md — ${s.tasks.length} tasks, ${s.invariantCount} invariants, ${s.bugCount} bugs`,
              ),
            0,
            0,
          );
        case 'status': {
          if (s.tasks.length === 0) {
            return new Text(theme.fg('dim', 'No spec tracked'), 0, 0);
          }
          const complete = s.tasks.filter((t) => t.status === 'complete').length;
          return new Text(
            theme.fg(
              'muted',
              `${complete}/${s.tasks.length} complete, V${s.invariantCount}, B${s.bugCount}`,
            ),
            0,
            0,
          );
        }
        case 'clear':
          return new Text(theme.fg('success', '✓ ') + theme.fg('muted', 'Tracker cleared'), 0, 0);
        default:
          return new Text(theme.fg('dim', 'Done'), 0, 0);
      }
    },
  });
}
