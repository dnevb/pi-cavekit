/**
 * Spec Tracker Core Logic
 *
 * Pure functions for parsing SPEC.md and tracking progress.
 * No pi dependencies — operates on plain strings.
 */

export type TaskStatus = "pending" | "in_progress" | "complete";

export interface Task {
  id: string;
  name: string;
  status: TaskStatus;
  cites: string;
}

export interface SpecState {
  tasks: Task[];
  invariantCount: number;
  bugCount: number;
  goal: string;
}

export interface SpecTrackerDetails {
  action: "scan" | "status" | "clear";
  state: SpecState;
  error?: string;
}

export interface ActionResult {
  text: string;
  state: SpecState;
  error?: string;
}

// --- Parsing ---

export function parseSpec(text: string): SpecState {
  const tasks: Task[] = [];
  let invariantCount = 0;
  let bugCount = 0;
  let goal = "";

  const lines = text.split("\n");
  let inTaskTable = false;
  let inBugTable = false;
  let headerSeen = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Goal
    if (line.startsWith("## §G")) {
      const next = lines[i + 1];
      if (next) goal = next.trim();
      continue;
    }

    // Invariant count
    if (line.startsWith("## §V")) {
      // Count V<n>: lines until next section
      for (let j = i + 1; j < lines.length; j++) {
        const l = lines[j].trim();
        if (l.startsWith("## ")) break;
        if (/^V\d+:/.test(l)) invariantCount++;
      }
      continue;
    }

    // Task table
    if (line.startsWith("## §T")) {
      inTaskTable = true;
      inBugTable = false;
      headerSeen = false;
      continue;
    }

    // Bug table
    if (line.startsWith("## §B")) {
      inTaskTable = false;
      inBugTable = true;
      headerSeen = false;
      continue;
    }

    // End of section
    if (line.startsWith("## ")) {
      inTaskTable = false;
      inBugTable = false;
      headerSeen = false;
      continue;
    }

    // Skip header row
    if ((inTaskTable || inBugTable) && line.startsWith("id|")) {
      headerSeen = true;
      continue;
    }
    if ((inTaskTable || inBugTable) && line.startsWith("---")) {
      continue;
    }

    // Parse task row
    if (inTaskTable && headerSeen && line.includes("|")) {
      const parts = line.split("|").map((p) => p.trim());
      if (parts.length >= 3) {
        const statusChar = parts[1];
        let status: TaskStatus = "pending";
        if (statusChar === "x") status = "complete";
        else if (statusChar === "~") status = "in_progress";
        tasks.push({
          id: parts[0],
          name: parts[2],
          status,
          cites: parts[3] || "",
        });
      }
      continue;
    }

    // Parse bug row
    if (inBugTable && headerSeen && line.includes("|")) {
      const parts = line.split("|").map((p) => p.trim());
      if (parts.length >= 2 && parts[0].startsWith("B")) {
        bugCount++;
      }
      continue;
    }
  }

  return { tasks, invariantCount, bugCount, goal };
}

// --- Actions ---

export function handleScan(specText: string | undefined): ActionResult {
  if (!specText || specText.trim().length === 0) {
    return {
      text: "Error: no SPEC.md content provided",
      state: emptyState(),
      error: "no spec content",
    };
  }
  const state = parseSpec(specText);
  return {
    text: formatStatus(state),
    state,
  };
}

export function handleStatus(state: SpecState): ActionResult {
  return {
    text: formatStatus(state),
    state: { ...state },
  };
}

export function handleClear(): ActionResult {
  return {
    text: "Spec tracker cleared.",
    state: emptyState(),
  };
}

function emptyState(): SpecState {
  return { tasks: [], invariantCount: 0, bugCount: 0, goal: "" };
}

// --- Formatting ---

export function formatStatus(state: SpecState): string {
  if (state.tasks.length === 0 && state.invariantCount === 0) {
    return "No SPEC.md parsed.";
  }

  const complete = state.tasks.filter((t) => t.status === "complete").length;
  const inProgress = state.tasks.filter((t) => t.status === "in_progress").length;
  const pending = state.tasks.filter((t) => t.status === "pending").length;

  const lines: string[] = [];
  if (state.goal) {
    lines.push(`Goal: ${state.goal}`);
    lines.push("");
  }
  lines.push(
    `Tasks: ${complete}/${state.tasks.length} complete (${inProgress} in progress, ${pending} pending)`
  );
  lines.push(`Invariants: ${state.invariantCount} | Bugs: ${state.bugCount}`);
  lines.push("");
  for (const t of state.tasks) {
    const icon = t.status === "complete" ? "x" : t.status === "in_progress" ? "~" : ".";
    lines.push(`  ${icon} [${t.id}] ${t.name}`);
  }
  return lines.join("\n");
}

export interface WidgetData {
  icons: string[];
  complete: number;
  total: number;
  currentName: string;
  invariantCount: number;
  bugCount: number;
}

export function formatWidgetData(state: SpecState): WidgetData {
  if (state.tasks.length === 0) {
    return { icons: [], complete: 0, total: 0, currentName: "", invariantCount: state.invariantCount, bugCount: state.bugCount };
  }

  const complete = state.tasks.filter((t) => t.status === "complete").length;
  const icons = state.tasks.map((t) => {
    switch (t.status) {
      case "complete":
        return "x";
      case "in_progress":
        return "~";
      default:
        return ".";
    }
  });

  const current =
    state.tasks.find((t) => t.status === "in_progress") ??
    state.tasks.find((t) => t.status === "pending");
  const currentName = current ? current.name : "";

  return { icons, complete, total: state.tasks.length, currentName, invariantCount: state.invariantCount, bugCount: state.bugCount };
}

// --- State Reconstruction ---

export interface BranchEntry {
  type: string;
  message?: {
    role: string;
    toolName?: string;
    details?: SpecTrackerDetails;
  };
}

export function reconstructFromBranch(entries: BranchEntry[]): SpecState {
  let state: SpecState = emptyState();
  for (const entry of entries) {
    if (entry.type !== "message") continue;
    const msg = entry.message;
    if (!msg || msg.role !== "toolResult" || msg.toolName !== "spec_tracker") continue;
    const details = msg.details as SpecTrackerDetails | undefined;
    if (details && !details.error) {
      state = details.state;
    }
  }
  return state;
}
