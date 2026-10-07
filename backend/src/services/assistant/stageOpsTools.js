/**
 * Ask-CRM stage-detail + daily-ops tools.
 * Wired into tools.js RUNNERS + TOOL_DEFINITIONS.
 */
const moment = require("moment");
const SiteMeasurement = require("../../models/appModels/SiteMeasurement");
const Planning = require("../../models/appModels/Planning");
const Drafting = require("../../models/appModels/Drafting");
const Fabrication = require("../../models/appModels/Fabrication");
const Installation = require("../../models/appModels/Installation");
const JobCard = require("../../models/appModels/JobCard");
const JobComment = require("../../models/appModels/JobComment");
const KanbanTask = require("../../models/appModels/KanbanTask");
const Notification = require("../../models/appModels/Notification");
const CompanyDayOff = require("../../models/appModels/CompanyDayOff");
const Leave = require("../../models/appModels/Leave");
const ScheduleAssignment = require("../../models/appModels/ScheduleAssignment");
const WorkerAttendanceSession = require("../../models/appModels/WorkerAttendanceSession");
const Invoice = require("../../models/appModels/Invoice");
const PurchaseOrder = require("../../models/appModels/PurchaseOrder");
const MaterialPurchase = require("../../models/appModels/MaterialPurchase");
const Lead = require("../../models/appModels/Lead");
const Job = require("../../models/appModels/Job");

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const BIZ_OFFSET = "+05:30";
const nowBiz = () => moment().utcOffset(BIZ_OFFSET);

const periodRange = (period = "thisMonth", startDate, endDate) => {
  const p = String(period || "thisMonth").trim();
  if (p === "today") {
    return {
      start: moment().startOf("day").toDate(),
      end: moment().endOf("day").toDate(),
      label: moment().format("YYYY-MM-DD"),
    };
  }
  if (p === "last7Days" || p === "last7days" || p === "past7Days") {
    return {
      start: moment().subtract(6, "days").startOf("day").toDate(),
      end: moment().endOf("day").toDate(),
      label: `${moment().subtract(6, "days").format("YYYY-MM-DD")} to ${moment().format("YYYY-MM-DD")}`,
    };
  }
  if (p === "thisWeek") {
    return {
      start: moment().startOf("week").toDate(),
      end: moment().endOf("week").toDate(),
      label: `${moment().startOf("week").format("YYYY-MM-DD")} to ${moment().endOf("week").format("YYYY-MM-DD")}`,
    };
  }
  if (p === "lastMonth") {
    const m = moment().subtract(1, "month");
    return {
      start: m.clone().startOf("month").toDate(),
      end: m.clone().endOf("month").toDate(),
      label: m.format("MMMM YYYY"),
    };
  }
  if (p === "custom" && startDate && endDate) {
    const start = moment(startDate, "YYYY-MM-DD", true);
    const end = moment(endDate, "YYYY-MM-DD", true);
    if (!start.isValid() || !end.isValid()) {
      throw new Error("custom period requires valid startDate and endDate (YYYY-MM-DD)");
    }
    return {
      start: start.startOf("day").toDate(),
      end: end.endOf("day").toDate(),
      label: `${start.format("YYYY-MM-DD")} to ${end.format("YYYY-MM-DD")}`,
    };
  }
  return {
    start: moment().startOf("month").toDate(),
    end: moment().endOf("month").toDate(),
    label: moment().format("MMMM YYYY"),
  };
};

const dayRange = (dateStr) => {
  const m = dateStr ? moment(dateStr, "YYYY-MM-DD", true) : moment();
  if (dateStr && !m.isValid()) {
    throw new Error("Invalid date; use YYYY-MM-DD");
  }
  return {
    start: m.clone().startOf("day").toDate(),
    end: m.clone().endOf("day").toDate(),
    label: m.format("YYYY-MM-DD"),
  };
};

const capLimit = (limit, def = 30, max = 60) =>
  Math.min(Math.max(Number(limit) || def, 1), max);

const jobLink = (job) => {
  if (!job?._id) return {};
  return {
    jobMongoId: String(job._id),
    jobCode: job.jobId || "",
    url: `/admin/job/${job._id}`,
  };
};

async function findJobsBySearch(search, limit = 25) {
  const q = String(search || "").trim();
  if (!q) return [];
  const rx = new RegExp(escapeRegex(q), "i");
  return Job.find({ $or: [{ jobId: rx }, { customer: rx }, { site: rx }] })
    .select("_id jobId customer site systemState")
    .limit(limit)
    .lean();
}

async function resolveJobIds(jobSearch) {
  const q = String(jobSearch || "").trim();
  if (!q) return { jobIds: null, jobs: [] };
  const jobs = await findJobsBySearch(q, 40);
  return { jobIds: jobs.map((j) => j._id), jobs };
}

async function loadJobMap(ids) {
  const uniq = [...new Set((ids || []).filter(Boolean).map(String))];
  if (!uniq.length) return {};
  const jobs = await Job.find({ _id: { $in: uniq } })
    .select("_id jobId customer site")
    .lean();
  const map = {};
  jobs.forEach((j) => {
    map[String(j._id)] = j;
  });
  return map;
}

const statusFilter = (statusRaw, openStatuses, openOnly) => {
  const raw = String(statusRaw || "").trim();
  const wantOpen =
    openOnly === true || openOnly === "true" || raw.toLowerCase() === "open";
  if (wantOpen && !raw) return { $in: openStatuses };
  if (!raw || raw.toLowerCase() === "all") return null;
  if (raw.toLowerCase() === "open") return { $in: openStatuses };
  return new RegExp(`^${escapeRegex(raw)}$`, "i");
};

const workDateInPeriod = (workDate, start, end) => {
  const d = String(workDate || "").trim();
  if (!d) return false;
  const m = moment(d, ["YYYY-MM-DD", "DD/MM/YYYY", "DD-MM-YYYY"], true);
  if (!m.isValid()) return false;
  return m.isBetween(moment(start), moment(end), "day", "[]");
};

const safetyIncomplete = (checklist = {}) => {
  const keys = ["ppeVerified", "siteBriefed", "permitsChecked", "equipmentInspected"];
  return keys.some((k) => !checklist?.[k]);
};

const normalizeWorkerKey = (name, email, id) => {
  const e = String(email || "")
    .trim()
    .toLowerCase();
  if (e) return `email:${e}`;
  const i = String(id || "").trim().toLowerCase();
  if (i) return `id:${i}`;
  return `name:${String(name || "")
    .trim()
    .toLowerCase()}`;
};

// ---------------------------------------------------------------------------
// Stage detail
// ---------------------------------------------------------------------------
async function listSiteMeasurements({
  status,
  jobSearch,
  openOnly = true,
  limit = 30,
} = {}) {
  const cap = capLimit(limit);
  const filter = {};
  const sf = statusFilter(status, ["Pending"], openOnly);
  if (sf) filter.status = sf;

  if (jobSearch) {
    const { jobIds } = await resolveJobIds(jobSearch);
    if (!jobIds?.length) return { total: 0, measurements: [], hint: "No job matched." };
    filter.jobId = { $in: jobIds };
  }

  const [total, byStatus, rows] = await Promise.all([
    SiteMeasurement.countDocuments(filter),
    SiteMeasurement.aggregate([
      { $match: filter },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    SiteMeasurement.find(filter)
      .select(
        "jobId status measuredBy siteAddress measurementDate totalHours notes createdAt"
      )
      .sort({ updatedAt: -1 })
      .limit(cap)
      .lean(),
  ]);

  const jobMap = await loadJobMap(rows.map((r) => r.jobId));
  return {
    total,
    byStatus: byStatus.map((r) => ({ status: r._id || "Unknown", count: r.count })),
    measurements: rows.map((r) => {
      const job = jobMap[String(r.jobId)] || null;
      return {
        id: String(r._id),
        status: r.status,
        measuredBy: r.measuredBy || "",
        siteAddress: r.siteAddress || "",
        measurementDate: r.measurementDate || null,
        totalHours: r.totalHours || 0,
        notesPreview: String(r.notes || "").slice(0, 120),
        ...jobLink(job),
        customer: job?.customer || "",
        site: job?.site || "",
        url: job?._id ? `/admin/job/${job._id}` : `/admin/site-measurement`,
      };
    }),
    hint: "Default shows Pending site measurements. Use status=Completed or openOnly=false for finished ones.",
  };
}

async function listPlanning({ status, jobSearch, openOnly = true, limit = 30 } = {}) {
  const cap = capLimit(limit);
  const filter = {};
  const sf = statusFilter(status, ["Pending", "In Progress"], openOnly);
  if (sf) filter.status = sf;

  if (jobSearch) {
    const { jobIds } = await resolveJobIds(jobSearch);
    if (!jobIds?.length) return { total: 0, items: [], hint: "No job matched." };
    filter.jobId = { $in: jobIds };
  }

  const [total, byStatus, rows] = await Promise.all([
    Planning.countDocuments(filter),
    Planning.aggregate([
      { $match: filter },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    Planning.find(filter)
      .select("jobId task start end workers hours status location city createdAt")
      .sort({ updatedAt: -1 })
      .limit(cap)
      .lean(),
  ]);

  const jobMap = await loadJobMap(rows.map((r) => r.jobId));
  return {
    total,
    byStatus: byStatus.map((r) => ({ status: r._id || "Unknown", count: r.count })),
    items: rows.map((r) => {
      const job = jobMap[String(r.jobId)] || null;
      return {
        id: String(r._id),
        task: r.task,
        status: r.status,
        start: r.start,
        end: r.end,
        workers: r.workers,
        hours: r.hours,
        location: r.location || r.city || "",
        ...jobLink(job),
        customer: job?.customer || "",
        url: job?._id ? `/admin/job/${job._id}` : `/admin/planning`,
      };
    }),
  };
}

async function listDrafting({ status, jobSearch, openOnly = true, limit = 30 } = {}) {
  const cap = capLimit(limit);
  const filter = {};
  const sf = statusFilter(status, ["Draft", "Under Review", "Rejected"], openOnly);
  if (sf) filter.status = sf;

  if (jobSearch) {
    const { jobIds } = await resolveJobIds(jobSearch);
    if (!jobIds?.length) return { total: 0, drawings: [], hint: "No job matched." };
    filter.jobId = { $in: jobIds };
  }

  const [total, byStatus, rows] = await Promise.all([
    Drafting.countDocuments(filter),
    Drafting.aggregate([
      { $match: filter },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    Drafting.find(filter)
      .select(
        "jobId title drawingType revision status preparedBy checkedBy approvedBy isIFCApproved remarks createdAt"
      )
      .sort({ updatedAt: -1 })
      .limit(cap)
      .lean(),
  ]);

  const jobMap = await loadJobMap(rows.map((r) => r.jobId));
  return {
    total,
    byStatus: byStatus.map((r) => ({ status: r._id || "Unknown", count: r.count })),
    drawings: rows.map((r) => {
      const job = jobMap[String(r.jobId)] || null;
      return {
        id: String(r._id),
        title: r.title,
        drawingType: r.drawingType,
        revision: r.revision,
        status: r.status,
        preparedBy: r.preparedBy || "",
        checkedBy: r.checkedBy || "",
        approvedBy: r.approvedBy || "",
        isIFCApproved: !!r.isIFCApproved,
        remarksPreview: String(r.remarks || "").slice(0, 120),
        ...jobLink(job),
        customer: job?.customer || "",
        url: job?._id ? `/admin/job/${job._id}` : `/admin/drafting`,
      };
    }),
  };
}

async function listFabricationProgress({
  status,
  jobSearch,
  maxProgress,
  openOnly = true,
  limit = 30,
} = {}) {
  const cap = capLimit(limit);
  const filter = {};
  const sf = statusFilter(
    status,
    ["Pending", "In Progress", "Hold", "Rework"],
    openOnly
  );
  if (sf) filter.status = sf;

  const maxPct = Number(maxProgress);
  if (Number.isFinite(maxPct)) {
    filter.progressPercentage = { $lte: Math.min(Math.max(maxPct, 0), 100) };
  }

  if (jobSearch) {
    const { jobIds } = await resolveJobIds(jobSearch);
    if (!jobIds?.length) return { total: 0, items: [], hint: "No job matched." };
    filter.jobId = { $in: jobIds };
  }

  const [total, byStatus, rows] = await Promise.all([
    Fabrication.countDocuments(filter),
    Fabrication.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          avgProgress: { $avg: "$progressPercentage" },
        },
      },
    ]),
    Fabrication.find(filter)
      .select(
        "jobId itemName drawingRef workstation assignedTeam quantity targetDate status progressPercentage progressUpdatedAt remarks"
      )
      .sort({ progressPercentage: 1, updatedAt: -1 })
      .limit(cap)
      .lean(),
  ]);

  const jobMap = await loadJobMap(rows.map((r) => r.jobId));
  return {
    total,
    byStatus: byStatus.map((r) => ({
      status: r._id || "Unknown",
      count: r.count,
      avgProgress: Math.round(r.avgProgress || 0),
    })),
    items: rows.map((r) => {
      const job = jobMap[String(r.jobId)] || null;
      return {
        id: String(r._id),
        itemName: r.itemName,
        status: r.status,
        progressPercentage: r.progressPercentage || 0,
        workstation: r.workstation || "",
        assignedTeam: r.assignedTeam || "",
        quantity: r.quantity,
        targetDate: r.targetDate || "",
        progressUpdatedAt: r.progressUpdatedAt || null,
        ...jobLink(job),
        customer: job?.customer || "",
        url: job?._id ? `/admin/job/${job._id}` : `/admin/fabrication`,
      };
    }),
    hint: "Use maxProgress=50 for jobs under 50% fabricated.",
  };
}

async function listInstallationProgress({
  status,
  jobSearch,
  openOnly = true,
  limit = 30,
} = {}) {
  const cap = capLimit(limit);
  const filter = {};
  const sf = statusFilter(
    status,
    ["Pending", "In Progress", "Hold", "Snag"],
    openOnly
  );
  if (sf) filter.status = sf;

  if (jobSearch) {
    const { jobIds } = await resolveJobIds(jobSearch);
    if (!jobIds?.length) return { total: 0, items: [], hint: "No job matched." };
    filter.jobId = { $in: jobIds };
  }

  const [total, byStatus, rows] = await Promise.all([
    Installation.countDocuments(filter),
    Installation.aggregate([
      { $match: filter },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    Installation.find(filter)
      .select(
        "jobId activityName locationArea assignedTeam plannedDate completedDate status snagIssue expectedHours actualHours sequenceOrder"
      )
      .sort({ sequenceOrder: 1, updatedAt: -1 })
      .limit(cap)
      .lean(),
  ]);

  const jobMap = await loadJobMap(rows.map((r) => r.jobId));
  return {
    total,
    byStatus: byStatus.map((r) => ({ status: r._id || "Unknown", count: r.count })),
    items: rows.map((r) => {
      const job = jobMap[String(r.jobId)] || null;
      return {
        id: String(r._id),
        activityName: r.activityName,
        status: r.status,
        locationArea: r.locationArea || "",
        assignedTeam: r.assignedTeam || [],
        plannedDate: r.plannedDate || "",
        completedDate: r.completedDate || "",
        snagIssue: r.snagIssue || "",
        expectedHours: r.expectedHours || 0,
        actualHours: r.actualHours || 0,
        ...jobLink(job),
        customer: job?.customer || "",
        site: job?.site || "",
        url: job?._id ? `/admin/job/${job._id}` : `/admin/installation`,
      };
    }),
  };
}

async function listJobCards({
  status,
  jobSearch,
  openOnly = true,
  safetyIncompleteOnly = false,
  limit = 30,
} = {}) {
  const cap = capLimit(limit);
  const filter = {};
  const sf = statusFilter(
    status,
    ["Pending", "Assigned", "In Progress", "On Hold"],
    openOnly
  );
  if (sf) filter.status = sf;

  if (jobSearch) {
    const { jobIds } = await resolveJobIds(jobSearch);
    if (!jobIds?.length) return { total: 0, cards: [], hint: "No job matched." };
    filter.jobId = { $in: jobIds };
  }

  const fetchCap =
    safetyIncompleteOnly === true || safetyIncompleteOnly === "true"
      ? Math.min(cap * 3, 120)
      : cap;

  const [total, byStatus, rows] = await Promise.all([
    JobCard.countDocuments(filter),
    JobCard.aggregate([
      { $match: filter },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    JobCard.find(filter)
      .select(
        "jobId cardNumber title status locationArea assignedInstallers plannedStart plannedEnd expectedHours actualHours safetyChecklist hoursLog snagIssue"
      )
      .sort({ updatedAt: -1 })
      .limit(fetchCap)
      .lean(),
  ]);

  let cards = rows.map((r) => ({
    ...r,
    safetyIncomplete: safetyIncomplete(r.safetyChecklist),
    hoursLogged: (r.hoursLog || []).reduce((s, h) => s + Number(h.hours || 0), 0),
  }));

  if (safetyIncompleteOnly === true || safetyIncompleteOnly === "true") {
    cards = cards.filter((c) => c.safetyIncomplete).slice(0, cap);
  } else {
    cards = cards.slice(0, cap);
  }

  const jobMap = await loadJobMap(cards.map((r) => r.jobId));
  return {
    total: safetyIncompleteOnly ? cards.length : total,
    byStatus: byStatus.map((r) => ({ status: r._id || "Unknown", count: r.count })),
    cards: cards.map((r) => {
      const job = jobMap[String(r.jobId)] || null;
      return {
        id: String(r._id),
        cardNumber: r.cardNumber,
        title: r.title,
        status: r.status,
        locationArea: r.locationArea || "",
        assignedInstallers: r.assignedInstallers || [],
        plannedStart: r.plannedStart || "",
        plannedEnd: r.plannedEnd || "",
        expectedHours: r.expectedHours || 0,
        actualHours: r.actualHours || 0,
        hoursLogged: r.hoursLogged,
        safetyIncomplete: r.safetyIncomplete,
        snagIssue: r.snagIssue || "",
        ...jobLink(job),
        customer: job?.customer || "",
        url: job?._id ? `/admin/job/${job._id}` : `/admin/job-card`,
      };
    }),
  };
}

async function getFabricationHours({
  jobSearch,
  workerName,
  period = "thisMonth",
  startDate,
  endDate,
  limit = 40,
} = {}) {
  const cap = capLimit(limit, 40, 80);
  const range = periodRange(period, startDate, endDate);
  const filter = {};

  if (jobSearch) {
    const { jobIds } = await resolveJobIds(jobSearch);
    if (!jobIds?.length) {
      return { period: range.label, totalHours: 0, entries: [], hint: "No job matched." };
    }
    filter.jobId = { $in: jobIds };
  }

  const rows = await Fabrication.find(filter)
    .select("jobId itemName hoursLog status")
    .limit(200)
    .lean();

  const jobMap = await loadJobMap(rows.map((r) => r.jobId));
  const workerRx = workerName
    ? new RegExp(escapeRegex(String(workerName).trim()), "i")
    : null;

  const entries = [];
  for (const row of rows) {
    for (const h of row.hoursLog || []) {
      if (!workDateInPeriod(h.workDate, range.start, range.end)) continue;
      if (workerRx && !workerRx.test(String(h.workerName || ""))) continue;
      const job = jobMap[String(row.jobId)] || null;
      entries.push({
        workerName: h.workerName || "",
        role: h.role || "",
        hours: Number(h.hours || 0),
        workDate: h.workDate || "",
        notes: h.notes || "",
        itemName: row.itemName,
        ...jobLink(job),
        customer: job?.customer || "",
      });
    }
  }

  entries.sort((a, b) => String(b.workDate).localeCompare(String(a.workDate)));
  const sliced = entries.slice(0, cap);
  const totalHours = entries.reduce((s, e) => s + e.hours, 0);

  return {
    period: range.label,
    totalHours,
    entryCount: entries.length,
    entries: sliced,
  };
}

async function getInstallationHours({
  jobSearch,
  workerName,
  period = "thisMonth",
  startDate,
  endDate,
  limit = 40,
} = {}) {
  const cap = capLimit(limit, 40, 80);
  const range = periodRange(period, startDate, endDate);
  const filter = {};

  if (jobSearch) {
    const { jobIds } = await resolveJobIds(jobSearch);
    if (!jobIds?.length) {
      return { period: range.label, totalHours: 0, entries: [], hint: "No job matched." };
    }
    filter.jobId = { $in: jobIds };
  }

  const rows = await Installation.find(filter)
    .select("jobId activityName hoursLog status")
    .limit(200)
    .lean();

  const jobMap = await loadJobMap(rows.map((r) => r.jobId));
  const workerRx = workerName
    ? new RegExp(escapeRegex(String(workerName).trim()), "i")
    : null;

  const entries = [];
  for (const row of rows) {
    for (const h of row.hoursLog || []) {
      if (!workDateInPeriod(h.workDate, range.start, range.end)) continue;
      if (workerRx && !workerRx.test(String(h.workerName || ""))) continue;
      const job = jobMap[String(row.jobId)] || null;
      entries.push({
        workerName: h.workerName || "",
        role: h.role || "",
        hours: Number(h.hours || 0),
        workDate: h.workDate || "",
        notes: h.notes || "",
        activityName: row.activityName,
        ...jobLink(job),
        customer: job?.customer || "",
      });
    }
  }

  entries.sort((a, b) => String(b.workDate).localeCompare(String(a.workDate)));
  const sliced = entries.slice(0, cap);
  const totalHours = entries.reduce((s, e) => s + e.hours, 0);

  return {
    period: range.label,
    totalHours,
    entryCount: entries.length,
    entries: sliced,
  };
}

// ---------------------------------------------------------------------------
// Ops
// ---------------------------------------------------------------------------
async function whoIsOnSiteToday({ date } = {}) {
  const { start, end, label } = dayRange(date);

  const [assignments, sessions] = await Promise.all([
    ScheduleAssignment.find({
      startTime: { $gte: start, $lte: end },
      status: { $nin: ["Cancelled"] },
    })
      .select(
        "jobId title role assigneeName assignees teams status startTime endTime"
      )
      .sort({ startTime: 1 })
      .limit(80)
      .lean(),
    WorkerAttendanceSession.find({
      checkInTime: { $gte: start, $lte: end },
    })
      .select(
        "workerName workerEmail workerId jobId status checkInTime checkOutTime"
      )
      .sort({ checkInTime: -1 })
      .limit(100)
      .lean(),
  ]);

  const jobIds = [
    ...new Set(
      [
        ...assignments.map((a) => String(a.jobId || "")),
        ...sessions.map((s) => String(s.jobId || "")).filter((id) => /^[a-f0-9]{24}$/i.test(id)),
      ].filter(Boolean)
    ),
  ];
  const jobMap = await loadJobMap(jobIds);

  const people = new Map();

  const ensure = (key, base) => {
    if (!people.has(key)) {
      people.set(key, {
        workerName: base.workerName || "",
        workerEmail: base.workerEmail || "",
        workerId: base.workerId || "",
        scheduled: false,
        checkedIn: false,
        stillOnSite: false,
        schedule: [],
        attendance: [],
      });
    }
    return people.get(key);
  };

  for (const row of assignments) {
    const names = [];
    if (row.assigneeName) names.push({ name: row.assigneeName });
    for (const a of row.assignees || []) {
      if (a?.assigneeName) names.push({ name: a.assigneeName, id: a.assigneeId });
    }
    if (!names.length && (row.teams || []).length) {
      names.push({ name: (row.teams || []).join(", ") });
    }
    if (!names.length) names.push({ name: "Unassigned" });

    const linked = jobMap[String(row.jobId)] || null;
    for (const n of names) {
      const key = normalizeWorkerKey(n.name, "", n.id);
      const person = ensure(key, { workerName: n.name, workerId: n.id || "" });
      person.scheduled = true;
      person.schedule.push({
        title: row.title || "",
        role: row.role || "",
        status: row.status,
        startTime: row.startTime,
        endTime: row.endTime,
        ...jobLink(linked),
        customer: linked?.customer || "",
        site: linked?.site || "",
      });
    }
  }

  for (const s of sessions) {
    const key = normalizeWorkerKey(s.workerName, s.workerEmail, s.workerId);
    const person = ensure(key, {
      workerName: s.workerName || s.workerEmail || s.workerId,
      workerEmail: s.workerEmail || "",
      workerId: s.workerId || "",
    });
    person.checkedIn = true;
    if (s.status === "checked_in") person.stillOnSite = true;
    const linked =
      jobMap[String(s.jobId)] ||
      null;
    person.attendance.push({
      status: s.status,
      checkInTime: s.checkInTime,
      checkOutTime: s.checkOutTime || null,
      jobCodeHint: s.jobId || "",
      ...jobLink(linked),
    });
  }

  const list = [...people.values()].map((p) => {
    let presence = "unknown";
    if (p.scheduled && p.stillOnSite) presence = "scheduled_and_on_site";
    else if (p.scheduled && p.checkedIn && !p.stillOnSite)
      presence = "scheduled_checked_out";
    else if (p.scheduled && !p.checkedIn) presence = "scheduled_missing";
    else if (!p.scheduled && p.stillOnSite) presence = "unscheduled_on_site";
    else if (!p.scheduled && p.checkedIn) presence = "unscheduled_checked_out";
    return { ...p, presence };
  });

  const summary = {
    scheduled: list.filter((p) => p.scheduled).length,
    checkedInToday: list.filter((p) => p.checkedIn).length,
    stillOnSite: list.filter((p) => p.stillOnSite).length,
    scheduledMissing: list.filter((p) => p.presence === "scheduled_missing").length,
    unscheduledOnSite: list.filter((p) => p.presence === "unscheduled_on_site").length,
  };

  return {
    date: label,
    summary,
    people: list,
    hint:
      "presence values: scheduled_and_on_site, scheduled_missing, scheduled_checked_out, unscheduled_on_site, unscheduled_checked_out.",
  };
}

async function listJobComments({ jobSearch, limit = 20 } = {}) {
  const cap = capLimit(limit, 20, 40);
  const q = String(jobSearch || "").trim();
  if (!q) {
    return {
      total: 0,
      comments: [],
      hint: "Pass jobSearch (job code or customer/site nickname) to list comments.",
    };
  }

  const { jobIds, jobs } = await resolveJobIds(q);
  if (!jobIds?.length) {
    return { total: 0, comments: [], hint: "No job matched that search." };
  }

  const [total, rows] = await Promise.all([
    JobComment.countDocuments({ jobId: { $in: jobIds } }),
    JobComment.find({ jobId: { $in: jobIds } })
      .select("jobId authorName authorRole message attachments createdAt")
      .sort({ createdAt: -1 })
      .limit(cap)
      .lean(),
  ]);

  const jobMap = {};
  jobs.forEach((j) => {
    jobMap[String(j._id)] = j;
  });

  return {
    total,
    matchedJobs: jobs.map((j) => ({ ...jobLink(j), customer: j.customer || "" })),
    comments: rows.map((c) => {
      const job = jobMap[String(c.jobId)] || null;
      return {
        id: String(c._id),
        authorName: c.authorName || "",
        authorRole: c.authorRole || "",
        message: String(c.message || "").slice(0, 500),
        attachmentCount: (c.attachments || []).length,
        createdAt: c.createdAt,
        ...jobLink(job),
        customer: job?.customer || "",
      };
    }),
  };
}

async function listKanbanTasks({
  status,
  assigneeName,
  jobSearch,
  openOnly = true,
  limit = 30,
} = {}) {
  const cap = capLimit(limit);
  const filter = {};
  const openStatuses = [
    "To Schedule",
    "Scheduled",
    "Material Purchase",
    "Fabrication",
    "QC",
    "Ready for Installation",
  ];
  const sf = statusFilter(status, openStatuses, openOnly);
  if (sf) filter.status = sf;

  if (assigneeName) {
    filter.assignedTeam = new RegExp(escapeRegex(String(assigneeName).trim()), "i");
  }

  if (jobSearch) {
    const { jobIds } = await resolveJobIds(jobSearch);
    if (!jobIds?.length) return { total: 0, tasks: [], hint: "No job matched." };
    filter.jobId = { $in: jobIds };
  }

  const [total, byStatus, rows] = await Promise.all([
    KanbanTask.countDocuments(filter),
    KanbanTask.aggregate([
      { $match: filter },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    KanbanTask.find(filter)
      .select(
        "jobId title description plannedStart plannedEnd priority assignedTeam status updatedAt"
      )
      .sort({ updatedAt: -1 })
      .limit(cap)
      .lean(),
  ]);

  const jobMap = await loadJobMap(rows.map((r) => r.jobId));
  return {
    total,
    byStatus: byStatus.map((r) => ({ status: r._id || "Unknown", count: r.count })),
    tasks: rows.map((t) => {
      const job = jobMap[String(t.jobId)] || null;
      return {
        id: String(t._id),
        title: t.title,
        status: t.status,
        priority: t.priority,
        assignedTeam: t.assignedTeam || "",
        plannedStart: t.plannedStart || "",
        plannedEnd: t.plannedEnd || "",
        descriptionPreview: String(t.description || "").slice(0, 120),
        ...jobLink(job),
        customer: job?.customer || "",
        url: `/admin/kanban`,
      };
    }),
  };
}

async function listNotifications({ unreadOnly = true, limit = 20 } = {}, context = {}) {
  const cap = capLimit(limit, 20, 40);
  const actorId = context?.actor?._id || context?.actor?.id || null;
  const filter = {
    $or: [{ role: "admin" }, { role: "all" }],
  };
  if (actorId) {
    filter.$or.push({ userId: actorId });
  }
  if (unreadOnly === true || unreadOnly === "true") {
    filter.read = false;
  }

  const [total, rows] = await Promise.all([
    Notification.countDocuments(filter),
    Notification.find(filter)
      .select("title body type link read createdAt jobId role")
      .sort({ createdAt: -1 })
      .limit(cap)
      .lean(),
  ]);

  return {
    total,
    unreadOnly: unreadOnly !== false && unreadOnly !== "false",
    notifications: rows.map((n) => ({
      id: String(n._id),
      title: n.title,
      bodyPreview: String(n.body || "").slice(0, 160),
      type: n.type,
      link: n.link || "",
      read: !!n.read,
      role: n.role,
      createdAt: n.createdAt,
      jobMongoId: n.jobId ? String(n.jobId) : null,
    })),
  };
}

async function listUpcomingDayOffs({ days = 14, limit = 40 } = {}) {
  const cap = capLimit(limit, 40, 80);
  const dayCount = Math.min(Math.max(Number(days) || 14, 1), 60);
  const todayKey = nowBiz().format("YYYY-MM-DD");
  const endKey = nowBiz().clone().add(dayCount, "days").format("YYYY-MM-DD");
  const start = nowBiz().startOf("day").toDate();
  const end = nowBiz().clone().add(dayCount, "days").endOf("day").toDate();

  const [companyOffs, leaves] = await Promise.all([
    CompanyDayOff.find({
      removed: { $ne: true },
      dateKey: { $gte: todayKey, $lte: endKey },
    })
      .select("dateKey title message emailsSent notifiedCount createdByName")
      .sort({ dateKey: 1 })
      .limit(cap)
      .lean(),
    Leave.find({
      removed: { $ne: true },
      status: "Approved",
      startDate: { $lte: end },
      endDate: { $gte: start },
    })
      .select("employeeName leaveType startDate endDate days reason status")
      .sort({ startDate: 1 })
      .limit(cap)
      .lean(),
  ]);

  return {
    from: todayKey,
    to: endKey,
    companyDayOffs: companyOffs.map((d) => ({
      date: d.dateKey,
      title: d.title,
      messagePreview: String(d.message || "").slice(0, 120),
      createdByName: d.createdByName || "",
      notifiedCount: d.notifiedCount || 0,
    })),
    workerDayOffs: leaves.map((l) => ({
      employeeName: l.employeeName || "",
      leaveType: l.leaveType || "",
      startDate: l.startDate,
      endDate: l.endDate,
      days: l.days,
      reasonPreview: String(l.reason || "").slice(0, 120),
      status: l.status,
    })),
  };
}

async function listOverdueItems({ limit = 15 } = {}) {
  const cap = capLimit(limit, 15, 30);
  const now = new Date();

  const [invoices, pos, materials, leads] = await Promise.all([
    Invoice.find({
      removed: { $ne: true },
      $or: [{ status: "Overdue" }, { isOverdue: true }],
      amountDue: { $gt: 0 },
    })
      .select("number status total amountDue expiredDate job currency")
      .populate({ path: "job", select: "_id jobId customer" })
      .sort({ expiredDate: 1 })
      .limit(cap)
      .lean(),
    PurchaseOrder.find({ status: "Delayed" })
      .select("poNumber status expectedDelivery delayReason jobId")
      .sort({ updatedAt: -1 })
      .limit(cap)
      .lean(),
    MaterialPurchase.find({ status: "Delayed" })
      .select("itemName status expectedDelivery supplier jobId")
      .sort({ updatedAt: -1 })
      .limit(cap)
      .lean(),
    Lead.find({
      status: { $in: ["New", "Contacted", "Quoted"] },
      nextFollowUpDate: { $ne: null, $lte: now },
    })
      .select("clientName contactPerson status assignedSalesperson nextFollowUpDate")
      .sort({ nextFollowUpDate: 1 })
      .limit(cap)
      .lean(),
  ]);

  const poJobMap = await loadJobMap(pos.map((p) => p.jobId));
  const matJobMap = await loadJobMap(materials.map((m) => m.jobId));

  return {
    summary: {
      overdueInvoices: invoices.length,
      delayedPurchaseOrders: pos.length,
      delayedMaterials: materials.length,
      overdueLeadFollowups: leads.length,
    },
    overdueInvoices: invoices.map((inv) => ({
      number: inv.number,
      status: inv.status,
      amountDue: inv.amountDue,
      expiredDate: inv.expiredDate,
      currency: inv.currency || "",
      ...jobLink(inv.job),
      customer: inv.job?.customer || "",
      url: `/admin/invoice`,
    })),
    delayedPurchaseOrders: pos.map((p) => {
      const job = poJobMap[String(p.jobId)] || null;
      return {
        poNumber: p.poNumber,
        status: p.status,
        expectedDelivery: p.expectedDelivery || "",
        delayReason: p.delayReason || "",
        ...jobLink(job),
        customer: job?.customer || "",
        url: `/admin/purchase-order`,
      };
    }),
    delayedMaterials: materials.map((m) => {
      const job = matJobMap[String(m.jobId)] || null;
      return {
        itemName: m.itemName,
        status: m.status,
        supplier: m.supplier || "",
        expectedDelivery: m.expectedDelivery || "",
        ...jobLink(job),
        customer: job?.customer || "",
        url: `/admin/material-purchase`,
      };
    }),
    overdueLeadFollowups: leads.map((l) => ({
      clientName: l.clientName || l.contactPerson || "",
      status: l.status,
      assignedSalesperson: l.assignedSalesperson || "",
      nextFollowUpDate: l.nextFollowUpDate,
      url: `/admin/leads`,
    })),
  };
}

// ---------------------------------------------------------------------------
const RUNNERS = {
  list_site_measurements: listSiteMeasurements,
  list_planning: listPlanning,
  list_drafting: listDrafting,
  list_fabrication_progress: listFabricationProgress,
  list_installation_progress: listInstallationProgress,
  list_job_cards: listJobCards,
  get_fabrication_hours: getFabricationHours,
  get_installation_hours: getInstallationHours,
  who_is_on_site_today: whoIsOnSiteToday,
  list_job_comments: listJobComments,
  list_kanban_tasks: listKanbanTasks,
  list_notifications: listNotifications,
  list_upcoming_day_offs: listUpcomingDayOffs,
  list_overdue_items: listOverdueItems,
};

const PERIOD_ENUM = ["today", "last7Days", "thisWeek", "thisMonth", "lastMonth", "custom", "all"];

const TOOL_DEFINITIONS = [
  {
    type: "function",
    function: {
      name: "list_site_measurements",
      description:
        "List site measurement records (Pending/Completed). Use for measurement backlog or status on a job.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", description: "Pending, Completed, open, or all" },
          jobSearch: { type: "string" },
          openOnly: { type: "boolean", description: "Default true = Pending only" },
          limit: { type: "number" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_planning",
      description: "List planning tasks/queue by status. Use for planning backlog.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", description: "Pending, In Progress, Done, open, or all" },
          jobSearch: { type: "string" },
          openOnly: { type: "boolean" },
          limit: { type: "number" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_drafting",
      description:
        "List drafting/drawings (Draft, Under Review, Approved, Rejected, IFC Approved). Use for pending drawings.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string" },
          jobSearch: { type: "string" },
          openOnly: { type: "boolean" },
          limit: { type: "number" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_fabrication_progress",
      description:
        "List fabrication items with progress %. Use for fab backlog or jobs under a progress threshold (maxProgress).",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string" },
          jobSearch: { type: "string" },
          maxProgress: {
            type: "number",
            description: "Only items with progressPercentage <= this (e.g. 50)",
          },
          openOnly: { type: "boolean" },
          limit: { type: "number" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_installation_progress",
      description:
        "List installation activities/status (Pending, In Progress, Completed, Hold, Snag). Use for install backlog or progress on a job.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string" },
          jobSearch: { type: "string" },
          openOnly: { type: "boolean" },
          limit: { type: "number" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_job_cards",
      description:
        "List job cards (hours, assignees, safety checklist). Use for open cards or incomplete safety.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string" },
          jobSearch: { type: "string" },
          openOnly: { type: "boolean" },
          safetyIncompleteOnly: {
            type: "boolean",
            description: "If true, only cards missing PPE/site brief/permits/equipment checks",
          },
          limit: { type: "number" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_fabrication_hours",
      description:
        "Sum fabrication hoursLog entries for a period (optional job/worker filter).",
      parameters: {
        type: "object",
        properties: {
          jobSearch: { type: "string" },
          workerName: { type: "string" },
          period: { type: "string", enum: PERIOD_ENUM },
          startDate: { type: "string" },
          endDate: { type: "string" },
          limit: { type: "number" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_installation_hours",
      description:
        "Sum installation hoursLog entries for a period (optional job/worker filter).",
      parameters: {
        type: "object",
        properties: {
          jobSearch: { type: "string" },
          workerName: { type: "string" },
          period: { type: "string", enum: PERIOD_ENUM },
          startDate: { type: "string" },
          endDate: { type: "string" },
          limit: { type: "number" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "who_is_on_site_today",
      description:
        "Merge today's schedule assignments with check-ins. Use for who is on site, who is scheduled but missing, or unscheduled check-ins.",
      parameters: {
        type: "object",
        properties: {
          date: { type: "string", description: "YYYY-MM-DD (defaults today)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_job_comments",
      description:
        "Recent comments/notes on a job. Requires jobSearch (code or customer/site nickname).",
      parameters: {
        type: "object",
        properties: {
          jobSearch: { type: "string" },
          limit: { type: "number" },
        },
        required: ["jobSearch"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_kanban_tasks",
      description: "List kanban board tasks by status/assignee/job.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string" },
          assigneeName: { type: "string", description: "Matches assignedTeam" },
          jobSearch: { type: "string" },
          openOnly: { type: "boolean" },
          limit: { type: "number" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_notifications",
      description: "List admin notifications / alerts (default unread).",
      parameters: {
        type: "object",
        properties: {
          unreadOnly: { type: "boolean" },
          limit: { type: "number" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_upcoming_day_offs",
      description:
        "Upcoming company day-offs and approved worker leave (Asia/Kolkata calendar). Default next 14 days.",
      parameters: {
        type: "object",
        properties: {
          days: { type: "number", description: "Lookahead days (default 14, max 60)" },
          limit: { type: "number" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_overdue_items",
      description:
        "Combined overdue snapshot: overdue invoices, delayed POs, delayed materials, overdue lead follow-ups.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Max items per category (default 15)" },
        },
      },
    },
  },
];

module.exports = {
  RUNNERS,
  TOOL_DEFINITIONS,
};
