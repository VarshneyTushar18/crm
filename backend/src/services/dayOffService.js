const moment = require("moment");
const CompanyDayOff = require("../models/appModels/CompanyDayOff");
const Leave = require("../models/appModels/Leave");
const Employee = require("../models/appModels/Employee");
const User = require("../models/appModels/User");
const sendMail = require("../controllers/middlewaresControllers/createAuthMiddleware/sendMail");
const { createNotification } = require("./notificationService");

/** Business calendar timezone offset (India). */
const BIZ_OFFSET = "+05:30";

const nowBiz = () => moment().utcOffset(BIZ_OFFSET);

const toDateKey = (input) => {
  if (!input) return nowBiz().format("YYYY-MM-DD");
  const m = moment(String(input).trim(), "YYYY-MM-DD", true).utcOffset(BIZ_OFFSET, true);
  if (!m.isValid()) {
    throw new Error("Invalid date; use YYYY-MM-DD");
  }
  return m.format("YYYY-MM-DD");
};

const dateKeyToStart = (dateKey) =>
  moment(dateKey, "YYYY-MM-DD").utcOffset(BIZ_OFFSET, true).startOf("day").toDate();

const dateKeyToEnd = (dateKey) =>
  moment(dateKey, "YYYY-MM-DD").utcOffset(BIZ_OFFSET, true).endOf("day").toDate();

const formatDisplayDate = (dateKey) =>
  moment(dateKey, "YYYY-MM-DD").format("ddd, D MMM YYYY");

const defaultCompanyMessage = (dateKey) =>
  `Please note: ${formatDisplayDate(dateKey)} is a company off day. Do not report to work.`;

const defaultPersonalMessage = (dateKey, workerName) =>
  `Hi ${workerName || "there"}, you are marked off on ${formatDisplayDate(dateKey)}. Please do not report to work.`;

const tomorrowDateKey = () => nowBiz().clone().add(1, "day").format("YYYY-MM-DD");

async function mapInBatches(items, batchSize, fn) {
  const results = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const chunk = items.slice(i, i + batchSize);
    const settled = await Promise.allSettled(chunk.map((item, idx) => fn(item, i + idx)));
    results.push(...settled);
  }
  return results;
}

async function sendAnnouncementEmail({ email, name, subject, title, body }) {
  if (!email) return { success: false, skipped: true, reason: "no_email" };
  return sendMail({
    email: String(email).trim().toLowerCase(),
    name: name || "",
    subject,
    type: "announcement",
    title: title || subject,
    body: body || "",
    idurar_app_email: process.env.MAIL_FROM,
  });
}

/**
 * Resolve Employee doc for a roster row (email / EMP id / name).
 */
async function resolveEmployeeForRosterWorker(worker) {
  if (!worker) return null;
  const or = [];
  const email = String(worker.email || "")
    .trim()
    .toLowerCase();
  if (email) or.push({ email });

  const ids = [worker.workerId, ...(worker.ids || [])].filter(Boolean);
  ids.forEach((id) => {
    or.push({ employeeId: new RegExp(`^${String(id).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") });
  });

  if (!or.length && worker.workerName) {
    or.push({
      name: new RegExp(
        `^${String(worker.workerName).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
        "i"
      ),
    });
  }
  if (!or.length) return null;
  return Employee.findOne({ $or: or, status: { $ne: "Inactive" } });
}

async function findWorkerUser({ email, workerId, workerName }) {
  const or = [];
  if (email) or.push({ email: String(email).trim().toLowerCase() });
  if (workerId) {
    or.push({
      workerId: new RegExp(
        `^${String(workerId).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
        "i"
      ),
    });
  }
  if (workerName) {
    or.push({
      name: new RegExp(
        `^${String(workerName).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
        "i"
      ),
    });
  }
  if (!or.length) return null;
  return User.findOne({
    role: "worker",
    isActive: { $ne: false },
    $or: or,
  }).select("_id name email workerId");
}

/**
 * Announce company-wide day off: persist, email roster, notify workers.
 */
async function announceCompanyDayOff({
  date,
  message,
  title,
  sendEmail = true,
  notifyInApp = true,
  actor = {},
  roster = [],
} = {}) {
  const dateKey = date ? toDateKey(date) : tomorrowDateKey();
  const display = formatDisplayDate(dateKey);
  const finalTitle = String(title || "Company off day").trim() || "Company off day";
  const finalMessage =
    String(message || "").trim() || defaultCompanyMessage(dateKey);

  const actorName =
    [actor.name, actor.surname].filter(Boolean).join(" ").trim() ||
    actor.email ||
    "Admin";

  const dayOff = await CompanyDayOff.findOneAndUpdate(
    { dateKey },
    {
      $set: {
        date: dateKeyToStart(dateKey),
        dateKey,
        title: finalTitle,
        message: finalMessage,
        createdByName: actorName,
        createdById: actor.id || null,
        removed: false,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  let emailsSent = 0;
  let emailFailed = 0;
  let skippedNoEmail = 0;
  const emailed = new Set();

  if (sendEmail !== false && sendEmail !== "false") {
    const withEmail = (roster || []).filter((w) => {
      const e = String(w.email || "")
        .trim()
        .toLowerCase();
      if (!e) {
        skippedNoEmail += 1;
        return false;
      }
      if (emailed.has(e)) return false;
      emailed.add(e);
      return true;
    });

    const subject = `Company notice: ${display} is off`;
    const results = await mapInBatches(withEmail, 10, (w) =>
      sendAnnouncementEmail({
        email: w.email,
        name: w.workerName,
        subject,
        title: finalTitle,
        body: finalMessage,
      })
    );
    results.forEach((r) => {
      if (r.status === "fulfilled" && r.value?.success) emailsSent += 1;
      else emailFailed += 1;
    });
  }

  let notifiedCount = 0;
  if (notifyInApp !== false && notifyInApp !== "false") {
    const workers = await User.find({
      role: "worker",
      isActive: { $ne: false },
    }).select("_id");

    const notifResults = await mapInBatches(workers, 20, (user) =>
      createNotification({
        userId: user._id,
        role: "worker",
        type: "general",
        title: `${finalTitle}: ${display}`,
        body: finalMessage,
        link: "/worker",
        metadata: {
          action: "company_day_off",
          dateKey,
          companyDayOffId: dayOff._id,
        },
      })
    );
    notifiedCount = notifResults.filter(
      (r) => r.status === "fulfilled" && r.value
    ).length;
  }

  dayOff.emailsSent = emailsSent;
  dayOff.notifiedCount = notifiedCount;
  await dayOff.save();

  return {
    ok: true,
    scope: "company",
    date: dateKey,
    displayDate: display,
    title: finalTitle,
    message: finalMessage,
    emailsSent,
    emailFailed,
    skippedNoEmail,
    notifiedCount,
    companyDayOffId: String(dayOff._id),
    hint:
      process.env.NODE_ENV !== "production"
        ? "Local/dev: emails are logged to the server console (not sent). Worker dashboard reads this from Mongo."
        : undefined,
  };
}

/**
 * Mark one worker off for a date: Approved Leave + email + notify.
 */
async function markWorkerDayOff({
  worker,
  date,
  message,
  leaveType = "Other",
  sendEmail = true,
  notifyInApp = true,
  actor = {},
} = {}) {
  if (!worker) {
    return { error: "worker is required" };
  }

  const dateKey = date ? toDateKey(date) : tomorrowDateKey();
  const display = formatDisplayDate(dateKey);
  const employee = await resolveEmployeeForRosterWorker(worker);
  if (!employee) {
    return {
      error: `No employee profile linked for "${worker.workerName || worker.workerId || "worker"}". Create/link an Employee record (email or employeeId) first.`,
      worker,
    };
  }

  const start = dateKeyToStart(dateKey);
  const end = dateKeyToEnd(dateKey);

  const existing = await Leave.findOne({
    removed: false,
    employeeId: employee._id,
    status: "Approved",
    startDate: { $lte: end },
    endDate: { $gte: start },
  });

  const actorName =
    [actor.name, actor.surname].filter(Boolean).join(" ").trim() ||
    actor.email ||
    "Admin";

  const finalMessage =
    String(message || "").trim() ||
    defaultPersonalMessage(dateKey, employee.name || worker.workerName);

  let leave = existing;
  if (existing) {
    existing.reason = finalMessage || existing.reason;
    existing.reviewedBy = actorName;
    existing.reviewedAt = new Date();
    await existing.save();
  } else {
    leave = await Leave.create({
      employeeId: employee._id,
      employeeName: employee.name,
      leaveType: leaveType || "Other",
      startDate: start,
      endDate: end,
      days: 1,
      reason: finalMessage,
      status: "Approved",
      reviewedBy: actorName,
      reviewedAt: new Date(),
    });
  }

  let emailed = false;
  let emailError = null;
  const targetEmail = employee.email || worker.email;
  if (sendEmail !== false && sendEmail !== "false") {
    if (!targetEmail) {
      emailError = "no_email";
    } else {
      const result = await sendAnnouncementEmail({
        email: targetEmail,
        name: employee.name || worker.workerName,
        subject: `You are off on ${display}`,
        title: "Day off notice",
        body: finalMessage,
      });
      emailed = !!result?.success;
      if (!result?.success) emailError = result?.error || "send_failed";
    }
  }

  let notified = false;
  if (notifyInApp !== false && notifyInApp !== "false") {
    const user = await findWorkerUser({
      email: targetEmail,
      workerId: worker.workerId || employee.employeeId,
      workerName: employee.name || worker.workerName,
    });
    if (user) {
      const n = await createNotification({
        userId: user._id,
        role: "worker",
        type: "general",
        title: `You are off: ${display}`,
        body: finalMessage,
        link: "/worker",
        metadata: {
          action: "personal_day_off",
          dateKey,
          leaveId: leave._id,
        },
      });
      notified = !!n;
    }
  }

  return {
    ok: true,
    scope: "personal",
    date: dateKey,
    displayDate: display,
    message: finalMessage,
    alreadyHadLeave: !!existing,
    leaveId: String(leave._id),
    worker: {
      workerName: employee.name || worker.workerName,
      workerId: employee.employeeId || worker.workerId || "",
      email: targetEmail || "",
    },
    emailed,
    emailError,
    notified,
    hint:
      process.env.NODE_ENV !== "production"
        ? "Local/dev: emails are logged to the server console (not sent)."
        : undefined,
  };
}

/**
 * Active company + personal day-offs for a worker (today + tomorrow by default).
 */
async function getActiveDayOffsForWorker({ employeeId = null, fromKey, toKey } = {}) {
  const from = fromKey || nowBiz().format("YYYY-MM-DD");
  const to = toKey || nowBiz().clone().add(1, "day").format("YYYY-MM-DD");

  const company = await CompanyDayOff.find({
    removed: { $ne: true },
    dateKey: { $gte: from, $lte: to },
  })
    .sort({ dateKey: 1 })
    .lean();

  let personal = [];
  if (employeeId) {
    const rangeStart = dateKeyToStart(from);
    const rangeEnd = dateKeyToEnd(to);
    const leaves = await Leave.find({
      removed: false,
      employeeId,
      status: "Approved",
      startDate: { $lte: rangeEnd },
      endDate: { $gte: rangeStart },
    })
      .sort({ startDate: 1 })
      .lean();

    personal = leaves.map((l) => ({
      leaveId: String(l._id),
      startDate: l.startDate,
      endDate: l.endDate,
      leaveType: l.leaveType,
      reason: l.reason || "",
      title: "You are marked off",
      message: l.reason || "You are marked off for this date.",
    }));
  }

  return {
    from,
    to,
    timezone: "Asia/Kolkata (UTC+05:30)",
    company: company.map((c) => ({
      id: String(c._id),
      date: c.dateKey,
      displayDate: formatDisplayDate(c.dateKey),
      title: c.title,
      message: c.message,
    })),
    personal,
  };
}

module.exports = {
  BIZ_OFFSET,
  nowBiz,
  toDateKey,
  tomorrowDateKey,
  formatDisplayDate,
  announceCompanyDayOff,
  markWorkerDayOff,
  getActiveDayOffsForWorker,
  resolveEmployeeForRosterWorker,
};
