/** Models often stringify large 2D `values` arrays (and sometimes add a trailing `]`). */

export function parseJsonIfString(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return value;
  const attempts = [trimmed, trimmed.replace(/\]+$/, ']')];
  for (const candidate of attempts) {
    try {
      return JSON.parse(candidate);
    } catch {
      /* try next */
    }
  }
  return value;
}
