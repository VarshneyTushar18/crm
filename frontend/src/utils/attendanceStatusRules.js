/**
 * TESTING thresholds — tune before production.
 * Absent: < 1s | Half Day: 1s–29s | Full Day: ≥ 30s
 */
export const HALF_DAY_MIN_SECONDS = 1;
export const FULL_DAY_MIN_SECONDS = 30;

export function getStatusFromSeconds(totalSeconds) {
  const sec = Math.max(0, Math.floor(Number(totalSeconds || 0)));
  if (sec >= FULL_DAY_MIN_SECONDS) return "Full Day";
  if (sec >= HALF_DAY_MIN_SECONDS) return "Half Day";
  return "Absent";
}

export function getStatusFromHours(hours) {
  const seconds = Math.max(0, Number(hours || 0)) * 3600;
  return getStatusFromSeconds(seconds);
}

export function getStatusFromMinutes(totalMinutes) {
  const seconds = Math.max(0, Number(totalMinutes || 0)) * 60;
  return getStatusFromSeconds(seconds);
}

export function hoursFromSeconds(totalSeconds) {
  const sec = Math.max(0, Number(totalSeconds || 0));
  return Number((sec / 3600).toFixed(2));
}

export function hoursFromMinutes(totalMinutes) {
  return hoursFromSeconds(Number(totalMinutes || 0) * 60);
}
