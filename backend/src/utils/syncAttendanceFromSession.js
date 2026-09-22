const mongoose = require("mongoose");

const WorkerAttendanceSession = require("../models/appModels/WorkerAttendanceSession");
const {
  getStatusFromSeconds,
  hoursFromSeconds,
  sessionDurationSeconds,
} = require("./attendanceStatusRules");

function formatDateToDDMMYYYY(dateValue) {
  const date = new Date(dateValue);
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

function formatTimeToHHmm(dateValue) {
  const date = new Date(dateValue);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

async function findEmployeeForSession(session) {
  const Employee = mongoose.model("Employee");
  const email = String(session.workerEmail || "")
    .toLowerCase()
    .trim();
  const workerId = String(session.workerId || "").trim();

  if (email) {
    const byEmail = await Employee.findOne({ email });
    if (byEmail) return byEmail;
  }
  if (workerId) {
    const byId = await Employee.findOne({ employeeId: workerId });
    if (byId) return byId;
  }
  return null;
}

/**
 * Upsert daily Attendance from a completed worker check-in/out session.
 * Skips when HR already saved a Manual record for that day.
 */
async function syncAttendanceFromSession(session) {
  if (!session || session.status !== "checked_out") return null;
  if (!session.checkInTime || !session.checkOutTime) return null;

  const employee = await findEmployeeForSession(session);
  if (!employee || employee.status !== "Active") return null;

  const Attendance = mongoose.model("Attendance");
  const workerEmail = String(employee.email).toLowerCase().trim();
  const date = formatDateToDDMMYYYY(session.checkInTime);
  const checkin = formatTimeToHHmm(session.checkInTime);
  const checkout = formatTimeToHHmm(session.checkOutTime);
  const totalSeconds = sessionDurationSeconds(session.checkInTime, session.checkOutTime);
  const hours = hoursFromSeconds(totalSeconds);
  const status = getStatusFromSeconds(totalSeconds);

  const existing = await Attendance.findOne({ workerEmail, date });
  if (existing && existing.source === "Manual") {
    return existing;
  }

  const payload = {
    workerName: String(employee.name || session.workerName || "").trim(),
    workerEmail,
    employeeId: String(employee.employeeId || "").trim(),
    designation: String(employee.designation || "").trim(),
    department: String(employee.department || "").trim(),
    date,
    checkin,
    checkout,
    hours,
    status,
    source: "Auto",
  };

  if (existing) {
    Object.assign(existing, payload);
    await existing.save();
    return existing;
  }

  return Attendance.create(payload);
}

/** Backfill Attendance rows from all completed worker sessions (idempotent). */
async function reconcileAllWorkerSessions() {
  const sessions = await WorkerAttendanceSession.find({ status: "checked_out" }).sort({
    checkOutTime: 1,
  });

  let synced = 0;
  for (const session of sessions) {
    const result = await syncAttendanceFromSession(session);
    if (result) synced += 1;
  }
  return { synced, totalSessions: sessions.length };
}

module.exports = {
  syncAttendanceFromSession,
  reconcileAllWorkerSessions,
};
