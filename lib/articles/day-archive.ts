const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

function toUtcDate(day: string): Date {
  return new Date(`${day}T00:00:00Z`);
}

function fromUtcDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Returns the day when it is a real YYYY-MM-DD date no later than todayJst, else null. */
export function parseDayParam(value: string, todayJst: string): string | null {
  if (!DAY_PATTERN.test(value)) return null;
  const date = toUtcDate(value);
  if (Number.isNaN(date.getTime()) || fromUtcDate(date) !== value) return null;
  return value <= todayJst ? value : null;
}

/** Keeps the articles published on the given JST day, preserving input order. */
export function selectArticlesForDay<T extends { publishedAtJst: string }>(
  articles: T[],
  day: string,
): T[] {
  return articles.filter((article) => article.publishedAtJst.startsWith(day));
}

/** Previous day always; next day only when it is not after today (JST). */
export function adjacentDays(
  day: string,
  todayJst: string,
): { prev: string; next: string | null } {
  const time = toUtcDate(day).getTime();
  const prev = fromUtcDate(new Date(time - DAY_MS));
  const nextDay = fromUtcDate(new Date(time + DAY_MS));
  return { prev, next: day < todayJst ? nextDay : null };
}

/** Unpadded month and day for display (e.g. 11 and 9). */
export function formatDayLabel(day: string): { month: number; day: number } {
  const date = toUtcDate(day);
  return { month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}
