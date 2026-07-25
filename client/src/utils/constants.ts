// ── Application-wide constants ────────────────────────────

export const APP_NAME = 'SyncSpace';

export const DEFAULT_ROOM_TIMEOUT_MS = 30 * 60 * 1000; // 30 min

export const MAX_COLLABORATORS = 10;

export const CURSOR_COLORS = [
  '#F44336', '#E91E63', '#9C27B0', '#673AB7',
  '#3F51B5', '#2196F3', '#00BCD4', '#009688',
  '#4CAF50', '#FF9800',
] as const;

export const WHITEBOARD_TOOLS = {
  PEN:    'pen',
  LINE:   'line',
  RECT:   'rect',
  CIRCLE: 'circle',
  TEXT:   'text',
  ERASER: 'eraser',
} as const;

export type WhiteboardTool = typeof WHITEBOARD_TOOLS[keyof typeof WHITEBOARD_TOOLS];

export const SOCKET_EVENTS = {
  JOIN_ROOM:   'room:join',
  LEAVE_ROOM:  'room:leave',
  DRAW_EVENT:  'whiteboard:draw',
  CODE_CHANGE: 'editor:change',
  USER_CURSOR: 'awareness:cursor',
  NOTIFICATION:'room:notification',
} as const;
