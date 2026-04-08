/**
 * Shared date utilities for consistent local-time handling.
 * All date grouping and labeling uses local calendar days.
 */

/**
 * Format a Date as YYYY-MM-DD in LOCAL time (not UTC).
 * Use this everywhere instead of toISOString().slice(0, 10).
 */
export function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Parse a YYYY-MM-DD string as local midnight.
 * Unlike `new Date("2026-03-18")` which parses as UTC midnight,
 * this always creates a Date at local midnight.
 */
export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Get today's date as YYYY-MM-DD in local time.
 */
export function todayLocalDate(): string {
  return formatLocalDate(new Date());
}
