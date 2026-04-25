import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ExtensionAPI, ExtensionContext, Theme } from '@mariozechner/pi-coding-agent';
import {
  type BranchEntry,
  handleScan,
  reconstructFromBranch,
  type ScanResult,
  type SpecState,
} from './spec-tracker-core.js';
import { createWidgetText, hasWidgetData } from './spec-tracker-renderer.js';

export {
  type BranchEntry,
  formatWidgetData,
  parseSpec,
  type Task,
  type TaskStatus,
  type WidgetData,
} from './spec-tracker-core.js';

export { createWidgetText, hasWidgetData, renderWidgetText } from './spec-tracker-renderer.js';

const SPEC_PATH = 'SPEC.md';
const WIDGET_ID = 'spec_tracker';

const isSpecPath = (p: string | undefined): boolean =>
  !p ? false : p === SPEC_PATH || p.endsWith(`/${SPEC_PATH}`);

const readSpecFile = (cwd: string): string | undefined => {
  try {
    return fs.readFileSync(path.resolve(cwd, SPEC_PATH), 'utf-8');
  } catch {
    return undefined;
  }
};

export default function (pi: ExtensionAPI) {
  let state: SpecState = { tasks: [], invariantCount: 0, bugCount: 0, goal: '' };

  const updateWidget = (ctx: ExtensionContext) => {
    if (!ctx.hasUI) return;
    ctx.ui.setWidget(
      WIDGET_ID,
      hasWidgetData(state)
        ? (_tui: any, theme: Theme) => createWidgetText(state, theme)
        : undefined,
    );
  };

  const scanFromText = (text: string, ctx: ExtensionContext) => {
    const result: ScanResult = handleScan(text);
    if (!result.error) {
      state = result.state;
      updateWidget(ctx);
    }
  };

  pi.on('session_start', async (_event: any, ctx: ExtensionContext) => {
    const branch = ctx.sessionManager.getBranch() as BranchEntry[];
    const reconstructed = reconstructFromBranch(branch);

    if (reconstructed.tasks.length > 0 || reconstructed.invariantCount > 0) {
      state = reconstructed;
      updateWidget(ctx);
      return;
    }

    const specText = readSpecFile(ctx.cwd);
    if (specText) scanFromText(specText, ctx);
  });

  pi.on('session_tree', async (_event: any, ctx: ExtensionContext) => {
    state = reconstructFromBranch(ctx.sessionManager.getBranch() as BranchEntry[]);
    updateWidget(ctx);
  });

  pi.on('tool_result', async (event: any, ctx: ExtensionContext) => {
    const inputPath = event.input?.path;

    if (event.type === 'read' && isSpecPath(inputPath)) {
      const contentItem = event.content?.find((c: any) => c.type === 'text');
      if (contentItem?.type === 'text') scanFromText(contentItem.text, ctx);
      return;
    }

    if (event.type === 'edit' && isSpecPath(inputPath)) {
      const text = readSpecFile(ctx.cwd);
      if (text) scanFromText(text, ctx);
    }
  });

  pi.on('tool_call', async (event: any, ctx: ExtensionContext) => {
    const inputPath = event.input?.path;
    if (event.name === 'write' && isSpecPath(inputPath)) {
      const content = event.input?.content;
      if (content) scanFromText(content, ctx);
    }
  });
}
