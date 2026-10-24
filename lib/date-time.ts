export type TimestampValue = string | number | Date | null | undefined;

type NormalizeTimestampOptions = {
  fallback?: TimestampValue;
  migrationNow?: TimestampValue;
};

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

function validDate(value: Date) {
  return Number.isNaN(value.getTime()) ? null : value;
}

function numericTimestamp(value: number) {
  const milliseconds = Math.abs(value) < 1_000_000_000_000 ? value * 1000 : value;
  return validDate(new Date(milliseconds));
}

function parseClockTime(value: string, reference: Date) {
  const match = value.match(/^(\d{1,2}):(\d{2})(?:\s*([AP]M))?$/i);
  if (!match) return null;

  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const meridiem = match[3]?.toUpperCase();
  if (minutes > 59 || hours > (meridiem ? 12 : 23)) return null;
  if (meridiem === "PM" && hours !== 12) hours += 12;
  if (meridiem === "AM" && hours === 12) hours = 0;

  const result = new Date(reference);
  result.setHours(hours, minutes, 0, 0);
  return validDate(result);
}

function parseLegacyTimestamp(value: string, reference: Date) {
  const normalized = value
    .trim()
    .replace(/[·]/g, "-")
    .replace(/\s+/g, " ");
  const lower = normalized.toLowerCase();

  if (lower === "just now" || lower === "today") return new Date(reference);
  if (lower === "yesterday") {
    return new Date(reference.getTime() - DAY_MS);
  }

  const relative = lower.match(
    /^(\d+)\s*(s|sec|secs|second|seconds|m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days)\s+ago$/
  );
  if (relative) {
    const amount = Number(relative[1]);
    const unit = relative[2];
    const multiplier = unit.startsWith("s")
      ? 1000
      : unit.startsWith("m")
        ? MINUTE_MS
        : unit.startsWith("h")
          ? HOUR_MS
          : DAY_MS;
    return new Date(reference.getTime() - amount * multiplier);
  }

  const dayAndTime = normalized.match(/^(today|yesterday)\s*-\s*(.+)$/i);
  if (dayAndTime) {
    const dayReference = new Date(reference);
    if (dayAndTime[1].toLowerCase() === "yesterday") {
      dayReference.setDate(dayReference.getDate() - 1);
    }
    return parseClockTime(dayAndTime[2].trim(), dayReference);
  }

  return parseClockTime(normalized, reference);
}

export function parseTimestamp(value: TimestampValue) {
  if (value instanceof Date) return validDate(new Date(value.getTime()));
  if (typeof value === "number" && Number.isFinite(value)) {
    return numericTimestamp(value);
  }
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) {
    return numericTimestamp(Number(trimmed));
  }

  if (
    /^\d{4}-\d{2}-\d{2}(?:[T\s].*)?$/.test(trimmed) ||
    /^[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4}/.test(trimmed) ||
    /^\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}/.test(trimmed)
  ) {
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      const [year, month, day] = trimmed.slice(0, 10).split("-").map(Number);
      const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
      if (month < 1 || month > 12 || day < 1 || day > days) return null;
      // Historical ISO-like values without an offset are UTC, independent of the viewer.
      const iso = trimmed.replace(" ", "T");
      return validDate(new Date(iso.includes("T") && !/(Z|[+-]\d{2}:?\d{2})$/i.test(iso) ? `${iso}Z` : iso));
    }
    return validDate(new Date(trimmed));
  }

  return null;
}

export function isValidTimestamp(value: TimestampValue) {
  return Boolean(parseTimestamp(value));
}

export function createTimestamp(now: TimestampValue = Date.now()) {
  return (parseTimestamp(now) ?? new Date()).toISOString();
}

export function normalizeTimestamp(
  value: TimestampValue,
  options: NormalizeTimestampOptions = {}
) {
  const parsed = parseTimestamp(value);
  if (parsed) return parsed.toISOString();

  const migrationNow =
    parseTimestamp(options.migrationNow);
  if (typeof value === "string" && migrationNow) {
    const legacy = parseLegacyTimestamp(value, migrationNow);
    if (legacy) return legacy.toISOString();
  }

  return parseTimestamp(options.fallback)?.toISOString() ?? (typeof value === "string" ? value : "");
}

export function timestampToMilliseconds(value: TimestampValue) {
  return parseTimestamp(value)?.getTime() ?? 0;
}

export function formatFullDateTime(value: TimestampValue, timeZone?: string) {
  const timestamp = parseTimestamp(value);
  if (!timestamp) return "Time unavailable";
  return new Intl.DateTimeFormat(undefined, {
    timeZone,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(timestamp);
}

export function formatRelativeTime(
  value: TimestampValue,
  now: TimestampValue = Date.now()
) {
  const timestamp = parseTimestamp(value);
  const current = parseTimestamp(now);
  if (!timestamp || !current) return "Time unavailable";

  const difference = current.getTime() - timestamp.getTime();
  if (difference < -MINUTE_MS) return formatFullDateTime(timestamp);
  if (difference < MINUTE_MS) return "Just now";

  const timestampDay = new Date(
    timestamp.getFullYear(),
    timestamp.getMonth(),
    timestamp.getDate()
  );
  const currentDay = new Date(
    current.getFullYear(),
    current.getMonth(),
    current.getDate()
  );
  const calendarDays = Math.round(
    (currentDay.getTime() - timestampDay.getTime()) / DAY_MS
  );

  if (calendarDays === 0) {
    const minutes = Math.floor(difference / MINUTE_MS);
    if (minutes < 60) {
      return minutes === 1 ? "1 min ago" : `${minutes} mins ago`;
    }
    const hours = Math.floor(difference / HOUR_MS);
    return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  }
  if (calendarDays === 1) return "Yesterday";
  if (calendarDays >= 2 && calendarDays <= 6) {
    return `${calendarDays} days ago`;
  }

  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    ...(timestamp.getFullYear() === current.getFullYear()
      ? {}
      : { year: "numeric" })
  }).format(timestamp);
}
