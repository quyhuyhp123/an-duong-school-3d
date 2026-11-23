const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const START = 18.5 * HOUR;
const END = 5 * HOUR;

// All players follow the school's clock (UTC+7).
const schoolTime = now => ((now + 7 * HOUR) % DAY + DAY) % DAY;

export function isEventNight(now = Date.now()) {
 const time = schoolTime(now);
 return time >= START || time < END;
}

export function msUntilEventBoundary(now = Date.now()) {
 const time = schoolTime(now);
 if (time < END) return END - time;
 if (time < START) return START - time;
 return DAY - time + END;
}
