import type { Theme } from '@mariozechner/pi-coding-agent';
import { Text } from '@mariozechner/pi-tui';
import { formatWidgetData, type SpecState } from './spec-tracker-core.js';

const EMPTY_WIDGET = '';

/**
 * Render widget content as styled text
 */
export function renderWidgetText(state: SpecState, theme: Theme): string {
  const data = formatWidgetData(state);

  // Empty state: no tasks and no invariants
  if (data.total === 0 && data.invariantCount === 0) {
    return EMPTY_WIDGET;
  }

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

  // No tasks but has invariants/bugs
  if (data.total === 0) {
    return `${theme.fg('muted', 'Spec:')} ${theme.fg('muted', meta)}`;
  }

  return `${theme.fg('muted', 'Spec:')} ${icons} ${theme.fg('muted', counts)} ${theme.fg('dim', meta)}${currentName}`;
}

/**
 * Create a Text widget from state and theme
 */
export function createWidgetText(state: SpecState, theme: Theme): Text {
  return new Text(renderWidgetText(state, theme), 0, 0);
}

/**
 * Check if state has meaningful data to display
 */
export function hasWidgetData(state: SpecState): boolean {
  return state.tasks.length > 0 || state.invariantCount > 0;
}
