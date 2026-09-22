import dayjs from "dayjs";
import { parseAttendanceDate } from "@/utils/parseAttendanceDate";

export const CELL_STATUS = {
  HOLIDAY: "holiday",
  PRESENT: "present",
  HALF: "half",
  LATE: "late",
  ABSENT: "absent",
  LEAVE: "leave",
  FUTURE: "future",
};

/** Default shift start for "Late" (HH:mm). */
export const LATE_AFTER_TIME = "09:00";

export function toAttendanceDateString(date) {
  return dayjs(date).format("DD-MM-YYYY");
}

function parseCheckinMinutes(timeStr) {
  if (!timeStr || typeof timeStr !== "string") return null;
  const [h, m] = timeStr.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function parseThresholdMinutes(timeStr) {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
}

export function isLateCheckin(checkin, threshold = LATE_AFTER_TIME) {
  const inMin = parseCheckinMinutes(checkin);
  const thresholdMin = parseThresholdMinutes(threshold);
  if (inMin === null) return false;
  return inMin > thresholdMin;
}

export function isWeekend(date) {
  const d = dayjs(date).day();
  return d === 0 || d === 6;
}

function isEmployeeOnApprovedLeave(employeeId, date, leave) {
  if (!employeeId || leave.status !== "Approved") return false;
  const empId = leave.employeeId?._id || leave.employeeId;
  if (String(empId) !== String(employeeId)) return false;
  const day = dayjs(date).startOf("day");
  const start = dayjs(leave.startDate).startOf("day");
  const end = dayjs(leave.endDate).endOf("day");
  return (
    (day.isAfter(start, "day") || day.isSame(start, "day")) &&
    (day.isBefore(end, "day") || day.isSame(end, "day"))
  );
}

export function isDateOnApprovedLeave(employeeId, date, leaves = []) {
  if (!employeeId) return false;
  return leaves.some((leave) => isEmployeeOnApprovedLeave(employeeId, date, leave));
}

function findApprovedLeaveForDate(employeeId, date, leaves = []) {
  return leaves.find((leave) => isEmployeeOnApprovedLeave(employeeId, date, leave)) || null;
}

export function buildMonthAttendanceIndex(attendanceRows, monthRef) {
  const index = new Map();
  for (const row of attendanceRows) {
    const d = parseAttendanceDate(row.date);
    if (!d || !d.isSame(monthRef, "month")) continue;
    index.set(`${row.workerEmail}|${row.date}`, row);
    if (row.employeeId) {
      index.set(`${row.employeeId}|${row.date}`, row);
    }
  }
  return index;
}

export function getAttendanceRecord(index, employee, dateStr) {
  return (
    index.get(`${employee.email}|${dateStr}`) ||
    index.get(`${employee.employeeId}|${dateStr}`) ||
    null
  );
}

export function resolveCellStatus({ date, employee, attendanceRecord, leaves, today = dayjs() }) {
  const day = dayjs(date).startOf("day");

  if (isDateOnApprovedLeave(employee._id, day, leaves)) {
    return { status: CELL_STATUS.LEAVE, record: null };
  }

  if (day.isAfter(today, "day")) {
    return { status: CELL_STATUS.FUTURE, record: null };
  }

  if (isWeekend(day)) {
    return { status: CELL_STATUS.HOLIDAY, record: attendanceRecord };
  }

  if (!attendanceRecord) {
    return { status: CELL_STATUS.ABSENT, record: null };
  }

  const { status, checkin } = attendanceRecord;
  if (status === "Half Day") {
    return { status: CELL_STATUS.HALF, record: attendanceRecord };
  }
  if (status === "Absent") {
    return { status: CELL_STATUS.ABSENT, record: attendanceRecord };
  }
  if (status === "Full Day") {
    if (isLateCheckin(checkin)) {
      return { status: CELL_STATUS.LATE, record: attendanceRecord };
    }
    return { status: CELL_STATUS.PRESENT, record: attendanceRecord };
  }

  return { status: CELL_STATUS.ABSENT, record: attendanceRecord };
}

export function countPresentDays(statuses) {
  let count = 0;
  for (const s of statuses) {
    if (s === CELL_STATUS.PRESENT || s === CELL_STATUS.LATE) count += 1;
    else if (s === CELL_STATUS.HALF) count += 0.5;
  }
  return count;
}

export function buildMatrixForMonth({ employees, attendanceRows, leaves, monthRef }) {
  const daysInMonth = monthRef.daysInMonth();
  const index = buildMonthAttendanceIndex(attendanceRows, monthRef);
  const today = dayjs().startOf("day");

  const rows = employees.map((employee) => {
    const dayStatuses = [];
    const dayDetails = [];

    for (let d = 1; d <= daysInMonth; d += 1) {
      const date = monthRef.date(d);
      const dateStr = toAttendanceDateString(date);
      const record = getAttendanceRecord(index, employee, dateStr);
      const resolved = resolveCellStatus({
        date,
        employee,
        attendanceRecord: record,
        leaves,
        today,
      });
      dayStatuses.push(resolved.status);
      dayDetails.push({ date, dateStr, ...resolved });
    }

    const presentCount = countPresentDays(dayStatuses);

    return {
      key: employee._id || employee.employeeId,
      employee,
      dayDetails,
      dayStatuses,
      totalLabel: `${presentCount % 1 === 0 ? presentCount : presentCount.toFixed(1)}/${daysInMonth}`,
      presentCount,
    };
  });

  return { daysInMonth, rows };
}

/**
 * Single pass over active employees for today (matrix rules).
 * Returns counts plus named lists for half day / late / on leave.
 */
export function computeTodayAttendanceDetail({
  employees = [],
  attendanceRows = [],
  leaves = [],
  refDate = dayjs(),
}) {
  const today = dayjs(refDate).startOf("day");
  const monthRef = today.startOf("month");
  const index = buildMonthAttendanceIndex(attendanceRows, monthRef);
  const dateStr = toAttendanceDateString(today);

  const activeEmployees = employees.filter((e) => e.status === "Active");
  const breakdown = {
    total: activeEmployees.length,
    present: 0,
    absent: 0,
    onLeave: 0,
    halfDay: 0,
    lateArrivals: 0,
  };
  const lists = {
    halfDay: [],
    late: [],
    onLeave: [],
  };
  /** @type {Record<string, string>} */
  const employeeTodayStatus = {};

  for (const employee of activeEmployees) {
    const record = getAttendanceRecord(index, employee, dateStr);
    const { status } = resolveCellStatus({
      date: today,
      employee,
      attendanceRecord: record,
      leaves,
      today,
    });

    const rowBase = {
      key: employee._id || employee.employeeId,
      name: employee.name || "—",
      employeeId: employee.employeeId || "—",
      designation: employee.designation || "",
    };

    employeeTodayStatus[rowBase.key] = status;

    switch (status) {
      case CELL_STATUS.LEAVE: {
        breakdown.onLeave += 1;
        const leave = findApprovedLeaveForDate(employee._id, today, leaves);
        lists.onLeave.push({
          ...rowBase,
          leaveRange: leave
            ? `${dayjs(leave.startDate).format("DD MMM")} – ${dayjs(leave.endDate).format("DD MMM YYYY")}`
            : "",
        });
        break;
      }
      case CELL_STATUS.PRESENT:
        breakdown.present += 1;
        break;
      case CELL_STATUS.LATE:
        breakdown.lateArrivals += 1;
        breakdown.present += 1;
        lists.late.push({
          ...rowBase,
          checkin: record?.checkin || "—",
        });
        break;
      case CELL_STATUS.HALF:
        breakdown.halfDay += 1;
        breakdown.present += 1;
        lists.halfDay.push({
          ...rowBase,
          checkin: record?.checkin || "—",
          hours: record?.hours,
        });
        break;
      case CELL_STATUS.ABSENT:
        breakdown.absent += 1;
        break;
      default:
        break;
    }
  }

  const byName = (a, b) => String(a.name).localeCompare(String(b.name));
  lists.halfDay.sort(byName);
  lists.late.sort(byName);
  lists.onLeave.sort(byName);

  return { ...breakdown, lists, employeeTodayStatus };
}

export function computeTodayAttendanceBreakdown(args) {
  const { lists, ...breakdown } = computeTodayAttendanceDetail(args);
  return breakdown;
}

/** @deprecated Prefer computeTodayAttendanceBreakdown */
export function computeTodayAttendanceSummary(args) {
  const b = computeTodayAttendanceBreakdown(args);
  return {
    total: b.total,
    present: b.present,
    absent: b.absent,
    onLeave: b.onLeave,
  };
}

/** Present today per designation (present + late + half day; active employees only). */
export function countPresentTodayByDesignation({
  employees = [],
  attendanceRows = [],
  leaves = [],
  refDate = dayjs(),
}) {
  const today = dayjs(refDate).startOf("day");
  const dateStr = toAttendanceDateString(today);
  const monthRef = today.startOf("month");
  const index = buildMonthAttendanceIndex(attendanceRows, monthRef);

  const presentByDesignation = new Map();
  const totalByDesignation = new Map();

  for (const employee of employees) {
    if (employee.status !== "Active") continue;
    const designation = String(employee.designation || "").trim() || "Unassigned";
    totalByDesignation.set(designation, (totalByDesignation.get(designation) || 0) + 1);

    const record = getAttendanceRecord(index, employee, dateStr);
    const { status } = resolveCellStatus({
      date: today,
      employee,
      attendanceRecord: record,
      leaves,
      today,
    });

    if (
      status === CELL_STATUS.PRESENT ||
      status === CELL_STATUS.LATE ||
      status === CELL_STATUS.HALF
    ) {
      presentByDesignation.set(
        designation,
        (presentByDesignation.get(designation) || 0) + 1
      );
    }
  }

  const designations = new Set([...totalByDesignation.keys(), ...presentByDesignation.keys()]);
  return [...designations]
    .map((designation) => ({
      designation,
      present: presentByDesignation.get(designation) || 0,
      total: totalByDesignation.get(designation) || 0,
    }))
    .filter((row) => row.present > 0)
    .sort(
      (a, b) =>
        b.present - a.present ||
        a.designation.localeCompare(b.designation)
    );
}

export function matrixToCsv(matrixRows, monthRef) {
  const daysInMonth = monthRef.daysInMonth();
  const header = [
    "Employee ID",
    "Name",
    "Designation",
    ...Array.from({ length: daysInMonth }, (_, i) => String(i + 1)),
    "Total",
  ];
  const statusLabel = {
    [CELL_STATUS.HOLIDAY]: "Holiday",
    [CELL_STATUS.PRESENT]: "Present",
    [CELL_STATUS.HALF]: "Half Day",
    [CELL_STATUS.LATE]: "Late",
    [CELL_STATUS.ABSENT]: "Absent",
    [CELL_STATUS.LEAVE]: "On Leave",
    [CELL_STATUS.FUTURE]: "",
  };

  const lines = [header.join(",")];
  for (const row of matrixRows) {
    const cells = row.dayStatuses.map((s) => statusLabel[s] || "");
    lines.push(
      [
        row.employee.employeeId,
        `"${(row.employee.name || "").replace(/"/g, '""')}"`,
        `"${(row.employee.designation || "").replace(/"/g, '""')}"`,
        ...cells,
        row.totalLabel,
      ].join(",")
    );
  }
  return lines.join("\n");
}
