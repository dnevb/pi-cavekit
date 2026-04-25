/**
 * Spec Tracker Extension
 *
 * Auto-scans SPEC.md on read/write/edit. Shows persistent TUI widget.
 * Manual scan via spec_tracker tool.
 * State stored in tool result details for branch support.
 */

import { StringEnum } from "@mariozechner/pi-ai";
import type { ExtensionAPI, ExtensionContext, Theme } from "@mariozechner/pi-coding-agent";
import { isToolCallEventType, isReadToolResult, isWriteToolResult, isEditToolResult } from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import { Type, type Static } from "typebox";
import {
  type SpecState,
  type BranchEntry,
  type SpecTrackerDetails,
  parseSpec,
  handleScan,
  handleStatus,
  handleClear,
  formatWidgetData,
  reconstructFromBranch,
} from "./spec-tracker-core.js";

const SpecTrackerParams = Type.Object({
  action: StringEnum(["scan", "status", "clear"] as const, {
    description: "Action to perform",
  }) as any,
});

export type SpecTrackerInput = {
  action: "scan" | "status" | "clear";
};

const SPEC_PATH = "SPEC.md";

function isSpecPath(path: string | undefined): boolean {
  if (!path) return false;
  return path === SPEC_PATH || path.endsWith("/" + SPEC_PATH);
}

function renderWidgetText(state: SpecState, theme: Theme): string {
  const data = formatWidgetData(state);
  if (data.total === 0 && data.invariantCount === 0) return "";

  const icons = data.icons
    .map((icon) => {
      switch (icon) {
        case "✓":
          return theme.fg("success", "✓");
        case "→":
          return theme.fg("warning", "→");
        default:
          return theme.fg("dim", "○");
      }
    })
    .join("");

  const counts = `(${data.complete}/${data.total})`;
  const meta = `V${data.invariantCount} B${data.bugCount}`;
  const currentName = data.currentName ? `  ${data.currentName}` : "";

  if (data.total === 0) {
    return `${theme.fg("muted", "Spec:")} ${theme.fg("muted", meta)}`;
  }

  return `${theme.fg("muted", "Spec:")} ${icons} ${theme.fg("muted", counts)} ${theme.fg("dim", meta)}${currentName}`;
}

export default function (pi: ExtensionAPI) {
  let state: SpecState = { tasks: [], invariantCount: 0, bugCount: 0, goal: "" };

  const reconstructState = (ctx: ExtensionContext) => {
    state = reconstructFromBranch(ctx.sessionManager.getBranch() as BranchEntry[]);
  };

  const updateWidget = (ctx: ExtensionContext) => {
    if (!ctx.hasUI) return;
    if (state.tasks.length === 0 && state.invariantCount === 0) {
      ctx.ui.setWidget("spec_tracker", undefined);
    } else {
      ctx.ui.setWidget("spec_tracker", (_tui, theme) => {
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

  // Reconstruct state + widget on session events
  pi.on("session_start", async (_event: any, ctx: ExtensionContext) => {
    reconstructState(ctx);
    updateWidget(ctx);
  });
  pi.on("session_tree", async (_event: any, ctx: ExtensionContext) => {
    reconstructState(ctx);
    updateWidget(ctx);
  });

  // Auto-scan on SPEC.md read
  pi.on("tool_result", async (event, ctx) => {
    let text: string | undefined;

    const inputPath = (event.input as { path?: string }).path;
    if (isReadToolResult(event) && isSpecPath(inputPath)) {
      const contentItem = event.content.find((c) => c.type === "text");
      if (contentItem && contentItem.type === "text") {
        text = contentItem.text;
      }
    }

    if (isWriteToolResult(event) && isSpecPath(inputPath)) {
      // After write, we need to re-read to get content. Use empty for now,
      // but ideally we should parse from the write input. However write
      // result doesn't include content. Let's try to get from input or skip.
      // Actually, let's just not auto-scan on write — the next read will catch it.
      // Or we can try to use the write input if available via tool_call event.
    }

    if (isEditToolResult(event) && isSpecPath(inputPath)) {
      // Same issue — edit result doesn't include full file content.
      // We'll handle this via tool_call mutation or just rely on next read.
    }

    if (text) {
      scanFromText(text, ctx);
    }
  });

  // Auto-scan on SPEC.md tool_call — capture input content for write/edit
  pi.on("tool_call", async (event, ctx) => {
    const callInputPath = (event.input as { path?: string }).path;
    if (isToolCallEventType("write", event) && isSpecPath(callInputPath)) {
      // write input has `content` field
      const content = (event.input as { content?: string }).content;
      if (content) {
        scanFromText(content, ctx);
      }
    }
    if (isToolCallEventType("edit", event) && isSpecPath(callInputPath)) {
      // edit doesn't have full content — we'll need to read after
      // Schedule a read? No, let's just let the next explicit read handle it
      // or we could store a flag to scan on next read result.
      // For simplicity, we skip auto-scan on edit and let the user read or
      // use the spec_tracker tool.
    }
  });

  pi.registerTool({
    name: "spec_tracker",
    label: "Spec Tracker",
    description:
      "Track SPEC.md progress. Actions: scan (parse current SPEC.md), status (show cached state), clear (reset). Auto-scans on SPEC.md reads.",
    parameters: SpecTrackerParams,

    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      let result;

      switch (params.action) {
        case "scan": {
          // Try to read SPEC.md
          const fs = await import("node:fs");
          const path = await import("node:path");
          const specPath = path.resolve(ctx.cwd, SPEC_PATH);
          let text = "";
          try {
            text = fs.readFileSync(specPath, "utf-8");
          } catch {
            return {
              content: [{ type: "text", text: "Error: SPEC.md not found" }],
              details: {
                action: "scan",
                state: { tasks: [], invariantCount: 0, bugCount: 0, goal: "" },
                error: "SPEC.md not found",
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
        case "status": {
          result = handleStatus(state);
          break;
        }
        case "clear": {
          result = handleClear();
          state = result.state;
          updateWidget(ctx);
          break;
        }
        default:
          return {
            content: [{ type: "text", text: `Unknown action: ${params.action}` }],
            details: {
              action: params.action as "scan",
              state: { ...state },
              error: "unknown action",
            } as SpecTrackerDetails,
          };
      }

      const details: SpecTrackerDetails = {
        action: params.action,
        state: result.state,
        ...(result.error ? { error: result.error } : {}),
      };

      return {
        content: [{ type: "text", text: result.text }],
        details,
      };
    },

    renderCall(args, theme) {
      const a = args as SpecTrackerInput;
      let text = theme.fg("toolTitle", theme.bold("spec_tracker "));
      text += theme.fg("muted", a.action);
      return new Text(text, 0, 0);
    },

    renderResult(result, _options, theme) {
      const details = result.details as SpecTrackerDetails | undefined;
      if (!details) {
        const text = result.content[0] as { type?: string; text?: string } | undefined;
        return new Text(text?.type === "text" ? text.text : "", 0, 0);
      }

      if (details.error) {
        return new Text(theme.fg("error", `Error: ${details.error}`), 0, 0);
      }

      const s = details.state;
      switch (details.action) {
        case "scan":
          return new Text(
            theme.fg("success", "✓ ") +
              theme.fg("muted", `Scanned SPEC.md — ${s.tasks.length} tasks, ${s.invariantCount} invariants, ${s.bugCount} bugs`),
            0,
            0
          );
        case "status": {
          if (s.tasks.length === 0) {
            return new Text(theme.fg("dim", "No spec tracked"), 0, 0);
          }
          const complete = s.tasks.filter((t) => t.status === "complete").length;
          return new Text(
            theme.fg("muted", `${complete}/${s.tasks.length} complete, V${s.invariantCount}, B${s.bugCount}`),
            0,
            0
          );
        }
        case "clear":
          return new Text(
            theme.fg("success", "✓ ") + theme.fg("muted", "Tracker cleared"),
            0,
            0
          );
        default:
          return new Text(theme.fg("dim", "Done"), 0, 0);
      }
    },
  });
}
