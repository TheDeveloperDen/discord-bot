function getDuration(duration: string): number {
  switch (duration) {
    case "years":
    case "year":
    case "y":
      return 1000 * 60 * 60 * 24 * 7 * 4.3 * 365;
    case "months":
    case "month":
    case "M":
      return 1000 * 60 * 60 * 24 * 7 * 4.3;
    case "weeks":
    case "week":
    case "w":
      return 1000 * 60 * 60 * 24 * 7;
    case "days":
    case "day":
    case "d":
      return 1000 * 60 * 60 * 24;
    case "hours":
    case "hour":
    case "h":
      return 1000 * 60 * 60;
    case "minutes":
    case "minute":
    case "m":
      return 1000 * 60;

    case "seconds":
    case "second":
    case "s":
      return 1000;

    default:
      return 0;
  }
}

/**
 * Parses a timespan to milliseconds.
 * @param span the timespan. The following specifiers may be used:
 *    - y for years
 *    - M for months
 *    - w for weeks
 *    - d for days
 *    - h for hours
 *    - m for minutes
 *    - s for seconds
 */
export function parseTimespan(span: string): number {
  const inputSplit = span.matchAll(/(\d+)(\D+)/g);
  if (!inputSplit) throw new Error("Invalid timespan");
  let out = 0;

  for (const element of inputSplit) {
    const number = parseInt(element.groups?.[1] ?? "0", 10);
    if (isNaN(number)) continue;
    out += number * getDuration(element.groups?.[2] ?? "");
  }
  return out;
}
