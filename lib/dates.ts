/**
 * Parse a date-only string from the database (e.g. "2026-01-01") as LOCAL time,
 * not UTC. Plain `new Date("2026-01-01")` parses as UTC midnight, which in
 * negative-UTC timezones renders as the *previous* day/month — that's why
 * a Jan 1 payment shows up as "Dec" in the UI for users in Pacific time.
 *
 * For full ISO timestamps (e.g. created_at "2026-01-01T...Z"), defer to
 * the native parser so timezone info is respected.
 */
export function parseDbDate(value: string | Date | null | undefined): Date {
  if (!value) return new Date(NaN);
  if (value instanceof Date) return value;
  // Date-only "YYYY-MM-DD" — parse in local time
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (m) {
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  return new Date(value);
}
