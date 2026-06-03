/**
 * Minimal cron expression matcher (5 fields: minute hour dom month dow).
 * Supports: *, single numbers, lists (1,2,3), ranges (1-5), and steps (* /15).
 * Day-of-week: 0 or 7 = Sunday.
 *
 * Good enough to decide "should this job run at this minute?" when the runner
 * ticks once per minute (or per few minutes — we match the current minute).
 */

function matchField(
  field: string,
  value: number,
  min: number,
  max: number
): boolean {
  if (field === "*") {
    return true;
  }
  for (const part of field.split(",")) {
    // Step: */n or a-b/n
    if (part.includes("/")) {
      const [range, stepStr] = part.split("/");
      const step = Number(stepStr);
      if (!Number.isFinite(step) || step <= 0) {
        continue;
      }
      let lo = min;
      let hi = max;
      if (range !== "*" && range.includes("-")) {
        const [a, b] = range.split("-").map(Number);
        lo = a;
        hi = b;
      } else if (range !== "*") {
        lo = Number(range);
        hi = max;
      }
      for (let v = lo; v <= hi; v += step) {
        if (v === value) {
          return true;
        }
      }
      continue;
    }
    // Range: a-b
    if (part.includes("-")) {
      const [a, b] = part.split("-").map(Number);
      if (value >= a && value <= b) {
        return true;
      }
      continue;
    }
    // Single number
    if (Number(part) === value) {
      return true;
    }
  }
  return false;
}

/**
 * Returns true if the cron expression matches the given date (UTC).
 */
export function cronMatches(expr: string, date = new Date()): boolean {
  const fields = expr.trim().split(/\s+/);
  if (fields.length !== 5) {
    return false;
  }
  const [min, hour, dom, mon, dow] = fields;

  const minute = date.getUTCMinutes();
  const hours = date.getUTCHours();
  const dayOfMonth = date.getUTCDate();
  const month = date.getUTCMonth() + 1;
  const dayOfWeek = date.getUTCDay(); // 0 = Sunday

  if (!matchField(min, minute, 0, 59)) {
    return false;
  }
  if (!matchField(hour, hours, 0, 23)) {
    return false;
  }
  if (!matchField(mon, month, 1, 12)) {
    return false;
  }

  // dom/dow: standard cron OR semantics when both are restricted.
  const domRestricted = dom !== "*";
  const dowRestricted = dow !== "*";
  // Normalize 7 → 0 for Sunday in the expression by also testing 7.
  const dowMatch =
    matchField(dow, dayOfWeek, 0, 6) ||
    (dayOfWeek === 0 && matchField(dow, 7, 0, 7));
  const domMatch = matchField(dom, dayOfMonth, 1, 31);

  if (domRestricted && dowRestricted) {
    return domMatch || dowMatch;
  }
  if (domRestricted) {
    return domMatch;
  }
  if (dowRestricted) {
    return dowMatch;
  }
  return true;
}
