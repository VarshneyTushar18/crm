import dayjs from "dayjs";

export function leaveOverlapsDay(leave, date) {
  if (!leave?.startDate || !leave?.endDate) return false;
  const day = dayjs(date).startOf("day");
  const start = dayjs(leave.startDate).startOf("day");
  const end = dayjs(leave.endDate).startOf("day");
  return !day.isBefore(start) && !day.isAfter(end);
}

export function leavesForDay(leaves, date) {
  if (!Array.isArray(leaves)) return [];
  return leaves.filter((leave) => leaveOverlapsDay(leave, date));
}
