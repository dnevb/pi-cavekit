import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("node:fs", () => ({
  readFileSync: vi.fn(() => ""),
}));

vi.mock("node:path", () => ({
  resolve: vi.fn((...args: string[]) => args.join("/")),
}));

import extension from "../../extensions/spec-tracker.js";

describe("spec-tracker extension event handlers", () => {
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
      cwd: "/project",
      sessionManager: { getBranch: vi.fn(() => []) },
    };
  });

  it("reads SPEC.md on edit tool_result and updates widget", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(`## §G
goal
## §T
id|status|task|cites
T1|x|task1|-
`);

    extension(pi);
    expect(handlers.tool_result).toBeDefined();

    await handlers.tool_result(
      {
        type: "tool_result",
        toolName: "edit",
        toolCallId: "1",
        input: { path: "SPEC.md", edits: [{ oldText: "a", newText: "b" }] },
        content: [],
        isError: false,
      },
      ctx
    );

    expect(path.resolve).toHaveBeenCalledWith("/project", "SPEC.md");
    expect(fs.readFileSync).toHaveBeenCalledWith("/project/SPEC.md", "utf-8");
    expect(ctx.ui.setWidget).toHaveBeenCalledWith("spec_tracker", expect.any(Function));
  });
});
