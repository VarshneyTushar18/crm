/**
 * TESTING thresholds — tune before production.
 * Absent: < 1s | Half Day: 1s–29s | Full Day: ≥ 30s
 */
const HALF_DAY_MIN_SECONDS = 1;
const FULL_DAY_MIN_SECONDS = 30;

function getStatusFromSeconds(totalSeconds) {
  const sec = Math.max(0, Math.floor(Number(totalSeconds || 0)));
  if (sec >= FULL_DAY_MIN_SECONDS) return "Full Day";
  if (sec >= HALF_DAY_MIN_SECONDS) return "Half Day";
  return "Absent";
}

function getStatusFromHours(hours) {
  const seconds = Math.max(0, Number(hours || 0)) * 3600;
  return getStatusFromSeconds(seconds);
}

function getStatusFromMinutes(totalMinutes) {
  const seconds = Math.max(0, Number(totalMinutes || 0)) * 60;
  return getStatusFromSeconds(seconds);
}

function hoursFromSeconds(totalSeconds) {
  const sec = Math.max(0, Number(totalSeconds || 0));
  return Number((sec / 3600).toFixed(2));
}

function hoursFromMinutes(totalMinutes) {
  return hoursFromSeconds(Number(totalMinutes || 0) * 60);
}

function sessionDurationSeconds(checkInTime, checkOutTime) {
  const start = new Date(checkInTime).getTime();
  const end = new Date(checkOutTime).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0;
  return Math.max(0, Math.round((end - start) / 1000));
}

module.exports = {
  HALF_DAY_MIN_SECONDS,
  FULL_DAY_MIN_SECONDS,
  getStatusFromSeconds,
  getStatusFromMinutes,
  getStatusFromHours,
  hoursFromSeconds,
  hoursFromMinutes,
  sessionDurationSeconds,
};
