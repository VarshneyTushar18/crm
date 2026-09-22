import dayjs from "dayjs";

function isWeekend(date) {
  const d = dayjs(date).day();
  return d === 0 || d === 6;
}

function eachDayInRange(start, end) {
  const days = [];
  let cursor = dayjs(start).startOf("day");
  const last = dayjs(end).startOf("day");
  while (cursor.isBefore(last) || cursor.isSame(last, "day")) {
    days.push(cursor.format("YYYY-MM-DD"));
    cursor = cursor.add(1, "day");
  }
  return days;
}

function leaveCoversDay(leave, dayStr) {
  if (leave.status !== "Approved") return false;
  const day = dayjs(dayStr).startOf("day");
  const start = dayjs(leave.startDate).startOf("day");
  const end = dayjs(leave.endDate).startOf("day");
  return !day.isBefore(start) && !day.isAfter(end);
}

export function getTimeGreeting() {
  const hour = dayjs().hour();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function assignmentScheduledMs(assignment) {
  if (!assignment?.startTime || !assignment?.endTime) return 0;
  return Math.max(0, dayjs(assignment.endTime).diff(dayjs(assignment.startTime)));
}

export function computeMonthAttendanceStats(history = [], leaves = [], month = dayjs()) {
  const monthStart = month.startOf("month");
  const monthEnd = month.endOf("month");
  const today = dayjs().startOf("day");

  const presentDays = new Set();
  for (const session of history) {
    if (!session?.checkInTime) continue;
    const d = dayjs(session.checkInTime);
    if (d.isBefore(monthStart) || d.isAfter(monthEnd)) continue;
    presentDays.add(d.format("YYYY-MM-DD"));
  }

  const leaveDays = new Set();
  for (const leave of leaves) {
    const leaveStart = dayjs(leave.startDate).startOf("day");
    const leaveEnd = dayjs(leave.endDate).startOf("day");
    const rangeStart = leaveStart.isAfter(monthStart) ? leaveStart : monthStart;
    const rangeEnd = leaveEnd.isBefore(monthEnd) ? leaveEnd : monthEnd;
    if (rangeEnd.isBefore(rangeStart)) continue;
    for (const dayStr of eachDayInRange(rangeStart, rangeEnd)) {
      if (leaveCoversDay(leave, dayStr)) leaveDays.add(dayStr);
    }
  }

  let absent = 0;
  let cursor = monthStart;
  while (!cursor.isAfter(today) && !cursor.isAfter(monthEnd)) {
    const key = cursor.format("YYYY-MM-DD");
    if (!isWeekend(cursor) && !presentDays.has(key) && !leaveDays.has(key)) {
      absent += 1;
    }
    cursor = cursor.add(1, "day");
  }

  return {
    present: presentDays.size,
    leave: leaveDays.size,
    absent,
    presentDays,
    leaveDays,
  };
}

export function dayAttendanceStatus(dayStr, { presentDays, leaveDays }) {
  const d = dayjs(dayStr);
  if (d.isAfter(dayjs(), "day")) return "future";
  if (leaveDays.has(dayStr)) return "leave";
  if (presentDays.has(dayStr)) return "present";
  if (isWeekend(d)) return "weekend";
  return "absent";
}

export function todayWorkedMsFromHistory(history, checkedIn, checkInAt, liveElapsedMs) {
  if (checkedIn && checkInAt && dayjs(checkInAt).isSame(dayjs(), "day")) {
    return liveElapsedMs;
  }
  let total = 0;
  for (const session of history) {
    if (!session?.checkInTime) continue;
    if (!dayjs(session.checkInTime).isSame(dayjs(), "day")) continue;
    if (session.status === "checked_in") {
      total += Math.max(0, Date.now() - new Date(session.checkInTime).getTime());
    } else if (session.totalMinutes) {
      total += session.totalMinutes * 60 * 1000;
    } else if (session.checkOutTime) {
      total += Math.max(
        0,
        new Date(session.checkOutTime).getTime() - new Date(session.checkInTime).getTime()
      );
    }
  }
  return total;
}
