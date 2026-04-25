export type TaskStatus = 'pending' | 'in_progress' | 'complete';

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
  action: 'scan' | 'status' | 'clear';
  state: SpecState;
  error?: string;
}

export interface WidgetData {
  icons: string[];
  complete: number;
  total: number;
  currentName: string;
  invariantCount: number;
  bugCount: number;
}

export interface BranchEntry {
  type: string;
  message?: {
    role: string;
    toolName?: string;
    details?: SpecTrackerDetails;
  };
}

export function emptyState(): SpecState {
  return { tasks: [], invariantCount: 0, bugCount: 0, goal: '' };
}

export function countComplete(tasks: Task[]): number {
  return tasks.filter((t) => t.status === 'complete').length;
}

export function parseSpec(text: string): SpecState {
  const lines = text.split('\n');
  let inTaskTable = false;
  let inBugTable = false;
  let headerSeen = false;
  let invariantCount = 0;
  let bugCount = 0;
  let goal = '';
  const tasks: Task[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line === '## §G') {
      goal = lines[++i]?.trim() ?? '';
      continue;
    }

    if (line === '## §V') {
      for (let j = i + 1; j < lines.length; j++) {
        if (/^V\d+:/.test(lines[j].trim())) {
          invariantCount++;
        } else if (lines[j].trim().startsWith('## ')) {
          break;
        }
      }
      continue;
    }

    if (line === '## §T') {
      inTaskTable = true;
      inBugTable = false;
      headerSeen = false;
      continue;
    }

    if (line === '## §B') {
      inTaskTable = false;
      inBugTable = true;
      headerSeen = false;
      continue;
    }

    if (line.startsWith('## ')) {
      inTaskTable = false;
      inBugTable = false;
      headerSeen = false;
      continue;
    }

    if ((inTaskTable || inBugTable) && line.startsWith('id|')) {
      headerSeen = true;
      continue;
    }
    if ((inTaskTable || inBugTable) && line.startsWith('---')) {
      continue;
    }

    if (headerSeen && line.includes('|')) {
      const parts = line.split('|').map((p) => p.trim());
      if (inTaskTable && parts.length >= 3) {
        const statusChar = parts[1];
        tasks.push({
          id: parts[0],
          name: parts[2],
          status: statusChar === 'x' ? 'complete' : statusChar === '~' ? 'in_progress' : 'pending',
          cites: parts[3] ?? '',
        });
      } else if (inBugTable && parts.length >= 2 && parts[0].startsWith('B')) {
        bugCount++;
      }
    }
  }

  return { tasks, invariantCount, bugCount, goal };
}

export interface ScanResult {
  state: SpecState;
  error?: string;
}

export function handleScan(specText: string | undefined): ScanResult {
  if (!specText?.trim()) {
    return { state: emptyState(), error: 'no spec content' };
  }
  return { state: parseSpec(specText) };
}

export function formatWidgetData(state: SpecState): WidgetData {
  const complete = countComplete(state.tasks);
  const icons = state.tasks.map((t) =>
    t.status === 'complete' ? 'x' : t.status === 'in_progress' ? '~' : '.',
  );
  const current =
    state.tasks.find((t) => t.status === 'in_progress') ??
    state.tasks.find((t) => t.status === 'pending');

  return {
    icons,
    complete,
    total: state.tasks.length,
    currentName: current?.name ?? '',
    invariantCount: state.invariantCount,
    bugCount: state.bugCount,
  };
}

export function reconstructFromBranch(entries: BranchEntry[]): SpecState {
  let state = emptyState();
  for (const entry of entries) {
    if (entry.type !== 'message') continue;
    const msg = entry.message;
    if (msg?.role !== 'toolResult' || msg?.toolName !== 'spec_tracker') continue;
    const details = msg.details;
    if (details && !details.error) {
      state = details.state;
    }
  }
  return state;
}
