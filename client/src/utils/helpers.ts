/**
 * General-purpose utility helpers
 */

/** Generate a short random room ID (6 chars) */
export function generateRoomId(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

/** Format a Unix timestamp as HH:MM:SS */
export function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
}

/** Truncate a string to maxLength with ellipsis */
export function truncate(str: string, maxLength: number): string {
  return str.length > maxLength ? str.slice(0, maxLength - 1) + '…' : str;
}

/** Debounce a function by delayMs */
export function debounce<T extends (...args: any[]) => void>(fn: T, delayMs: number): T {
  let timer: ReturnType<typeof setTimeout>;
  return ((...args: any[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delayMs);
  }) as T;
}

/** Deep clone a plain object */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}
