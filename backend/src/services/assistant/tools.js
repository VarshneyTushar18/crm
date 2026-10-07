const moment = require("moment");
const Job = require("../../models/appModels/Job");
const WorkerAttendanceSession = require("../../models/appModels/WorkerAttendanceSession");
const ScheduleAssignment = require("../../models/appModels/ScheduleAssignment");
const WorkerTask = require("../../models/appModels/WorkerTask");
const SiteEngineerReview = require("../../models/appModels/SiteEngineerReview");
const MaterialPurchase = require("../../models/appModels/MaterialPurchase");
const Employee = require("../../models/appModels/Employee");
const User = require("../../models/appModels/User");
const PurchaseOrder = require("../../models/appModels/PurchaseOrder");
const Invoice = require("../../models/appModels/Invoice");
const Lead = require("../../models/appModels/Lead");
const Customer = require("../../models/appModels/Customer");
const dashboardController = require("../../controllers/dashboard.controller");
const {
  STAGE_LABELS,
  ensureV3WorkflowEvents,
  getWorkflowStageKeys,
  calcJobCompletionPercent,
  isStageAwaitingSiteEngineer,
} = require("../../utils/workflowDefaults");
const {
  fetchJobsForExport,
  buildJobsExportDownloadUrl,
  stampFilename,
  EXPORT_HEADERS,
} = require("./jobsExcelExport");
const {
  announceCompanyDayOff,
  markWorkerDayOff,
  tomorrowDateKey,
} = require("../dayOffService");
const { prepareWorkerEmailDraft } = require("../emailDraftService");
const {
  RUNNERS: CATALOG_RUNNERS,
  TOOL_DEFINITIONS: CATALOG_TOOL_DEFINITIONS,
} = require("./crmCatalogTools");
const {
  RUNNERS: STAGE_OPS_RUNNERS,
  TOOL_DEFINITIONS: STAGE_OPS_TOOL_DEFINITIONS,
} = require("./stageOpsTools");
const {
  RUNNERS: FINANCE_SALES_RUNNERS,
  TOOL_DEFINITIONS: FINANCE_SALES_TOOL_DEFINITIONS,
} = require("./financeSalesTools");
const {
  RUNNERS: CATALOG_EXCEL_RUNNERS,
  TOOL_DEFINITIONS: CATALOG_EXCEL_TOOL_DEFINITIONS,
} = require("./catalogExcelTools");
const {
  RUNNERS: SEARCH_CRM_RUNNERS,
  TOOL_DEFINITIONS: SEARCH_CRM_TOOL_DEFINITIONS,
} = require("./searchCrmTools");
const {
  RUNNERS: ANALYTICS_OPS_RUNNERS,
  TOOL_DEFINITIONS: ANALYTICS_OPS_TOOL_DEFINITIONS,
} = require("./analyticsOpsTools");

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Filler words admins use when referring to jobs colloquially ("the metro job", "total contract of…"). */
const JOB_SEARCH_STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "of",
  "for",
  "to",
  "and",
  "or",
  "job",
  "jobs",
  "project",
  "projects",
  "site",
  "sites",
  "total",
  "contract",
  "value",
  "amount",
  "status",
  "what",
  "is",
  "are",
  "how",
  "much",
  "please",
  "show",
  "me",
  "get",
  "find",
  "look",
  "up",
  "about",
]);

/** Split a natural-language job nickname into searchable tokens. */
const tokenizeJobSearch = (input) => {
  const raw = String(input || "").trim().toLowerCase();
  if (!raw) return [];
  const parts = raw
    .split(/[^a-z0-9]+/i)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !JOB_SEARCH_STOPWORDS.has(t));
  return [...new Set(parts)];
};

/** Score how well a job matches tokens (higher = better). Used to pick a single best match. */
const scoreJobAgainstTokens = (job, tokens, phrase = "") => {
  if (!tokens.length && !phrase) return 0;
  const jobId = String(job.jobId || "").toLowerCase();
  const customer = String(job.customer || "").toLowerCase();
  const site = String(job.site || "").toLowerCase();
  const hay = `${jobId} ${customer} ${site}`;
  let score = 0;
  const p = String(phrase || "").trim().toLowerCase();
  if (p && (jobId === p || customer === p || site === p)) score += 50;
  else if (p && (jobId.includes(p) || customer.includes(p) || site.includes(p))) score += 25;
  tokens.forEach((t) => {
    if (jobId === t || customer === t || site === t) score += 12;
    else if (jobId.includes(t) || customer.includes(t) || site.includes(t)) score += 6;
    else if (hay.includes(t)) score += 3;
  });
  return score;
};

/**
 * Build Mongo $or clauses for fuzzy job nickname search.
 * Matches full phrase and individual tokens against jobId / customer / site.
 */
const buildJobTextSearchOr = (search) => {
  const q = String(search || "").trim();
  if (!q) return [];
  const tokens = tokenizeJobSearch(q);
  const clauses = [];
  const seen = new Set();
  const add = (field, pattern) => {
    const key = `${field}:${pattern}`;
    if (seen.has(key)) return;
    seen.add(key);
    clauses.push({ [field]: new RegExp(escapeRegex(pattern), "i") });
  };
  add("jobId", q);
  add("customer", q);
  add("site", q);
  tokens.forEach((t) => {
    add("jobId", t);
    add("customer", t);
    add("site", t);
  });
  return clauses;
};

/** Find Customer ids whose name/company matches any search token (helps nickname → job). */
const findCustomerIdsForJobSearch = async (search) => {
  const tokens = tokenizeJobSearch(search);
  const q = String(search || "").trim();
  if (!tokens.length && !q) return [];
  const or = [];
  const addRx = (field, pattern) => {
    or.push({ [field]: new RegExp(escapeRegex(pattern), "i") });
  };
  if (q) {
    addRx("name", q);
    addRx("companyName", q);
  }
  tokens.forEach((t) => {
    addRx("name", t);
    addRx("companyName", t);
  });
  const customers = await Customer.find({ $or: or })
    .select("_id")
    .limit(40)
    .lean();
  return customers.map((c) => c._id);
};

/** App path for a job detail page. Accepts a Job doc/lean object or Mongo id string. */
const jobLinkFields = (jobOrId) => {
  const id =
    jobOrId && typeof jobOrId === "object"
      ? String(jobOrId._id || jobOrId.id || "")
      : String(jobOrId || "");
  if (!id || id === "undefined" || id === "null") return {};
  return { id, url: `/admin/job/${id}` };
};

const OPEN_SCHEDULE_STATUSES = ["Scheduled", "In Progress", "Delayed"];
const OPEN_TASK_STATUSES = ["Assigned", "In Progress", "Submitted", "Rejected"];

const STAGE_ALIASES = Object.fromEntries(
  Object.entries(STAGE_LABELS).flatMap(([key, label]) => [
    [key.toLowerCase(), key],
    [label.toLowerCase(), key],
    [label.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(), key],
  ])
);

const resolveStageKey = (stageInput) => {
  const raw = String(stageInput || "").trim().toLowerCase();
  if (!raw) return null;
  if (STAGE_ALIASES[raw]) return STAGE_ALIASES[raw];
  const compact = raw.replace(/[^a-z0-9]+/g, "");
  for (const [alias, key] of Object.entries(STAGE_ALIASES)) {
    if (alias.replace(/[^a-z0-9]+/g, "") === compact) return key;
  }
  for (const [alias, key] of Object.entries(STAGE_ALIASES)) {
    if (alias.includes(raw) || raw.includes(alias)) return key;
  }
  return null;
};

const loadJobMap = async (objectIds) => {
  const ids = [...new Set(objectIds.map((id) => String(id)).filter(Boolean))];
  const jobMap = {};
  if (!ids.length) return jobMap;
  const linked = await Job.find({ _id: { $in: ids } })
    .select("jobId customer site systemState")
    .lean();
  linked.forEach((j) => {
    jobMap[String(j._id)] = j;
  });
  return jobMap;
};

const collectAssigneeNames = (row) => {
  const names = [];
  if (row.assigneeName) names.push(String(row.assigneeName).trim());
  (row.assignees || []).forEach((a) => {
    if (a?.assigneeName) names.push(String(a.assigneeName).trim());
  });
  return [...new Set(names.filter(Boolean))];
};

const getCurrentWorkflowStage = (job) => {
  const keys = getWorkflowStageKeys(job);
  const wf = ensureV3WorkflowEvents(job.workflowEvents || {});
  for (const key of keys) {
    const stage = wf[key];
    if (!stage?.isCompleted && stage?.stageStatus !== "Complete") {
      return key;
    }
  }
  return "jobCompletion";
};

const resolveJob = async (jobRef) => {
  const raw = String(jobRef || "").trim();
  if (!raw) {
    throw new Error("jobId is required");
  }
  let job = await Job.findOne({
    jobId: new RegExp(`^${escapeRegex(raw)}$`, "i"),
    removed: { $ne: true },
  });
  if (!job && /^[a-f0-9]{24}$/i.test(raw)) {
    job = await Job.findOne({ _id: raw, removed: { $ne: true } });
  }
  if (!job) {
    const textOr = buildJobTextSearchOr(raw);
    const customerIds = await findCustomerIdsForJobSearch(raw);
    const filter = { removed: { $ne: true }, $or: [...textOr] };
    if (customerIds.length) {
      filter.$or.push({ customerId: { $in: customerIds } });
    }
    const candidates = await Job.find(filter)
      .select("jobId customer site lockedValue systemState updatedAt")
      .sort({ updatedAt: -1 })
      .limit(12)
      .lean();

    if (candidates.length === 1) {
      job = await Job.findOne({ _id: candidates[0]._id, removed: { $ne: true } });
    } else if (candidates.length > 1) {
      const tokens = tokenizeJobSearch(raw);
      const ranked = candidates
        .map((c) => ({ job: c, score: scoreJobAgainstTokens(c, tokens, raw) }))
        .sort((a, b) => b.score - a.score || new Date(b.job.updatedAt) - new Date(a.job.updatedAt));
      const best = ranked[0];
      const second = ranked[1];
      // Clear winner: use it. Close race: surface ambiguity for the model.
      if (best.score > 0 && (!second || best.score >= second.score + 6)) {
        job = await Job.findOne({ _id: best.job._id, removed: { $ne: true } });
      } else {
        const list = ranked
          .slice(0, 5)
          .map((r) => `${r.job.jobId} (${r.job.customer || "—"}${r.job.site ? ` / ${r.job.site}` : ""})`)
          .join("; ");
        throw new Error(
          `Multiple jobs matched "${raw}". Candidates: ${list}. Ask which job code to use, or call list_jobs.`
        );
      }
    }
  }
  if (!job) {
    throw new Error(
      `No job found for "${raw}". Try list_jobs with a short keyword (e.g. customer or site nickname), or a job code.`
    );
  }
  return job;
};

const callAdminOverview = (query = {}) =>
  new Promise((resolve, reject) => {
    const req = { query };
    const res = {
      status(code) {
        return {
          json(body) {
            reject(new Error(body?.message || `Dashboard overview failed (${code})`));
          },
        };
      },
      json(body) {
        if (!body?.success) {
          reject(new Error(body?.message || "Dashboard overview failed"));
          return;
        }
        resolve(body.result);
      },
    };
    Promise.resolve(dashboardController.adminOverview(req, res)).catch(reject);
  });

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

async function getDashboardOverview({ period = "today" } = {}) {
  const query = { type: period };
  if (!["today", "thisWeek", "thisMonth"].includes(period)) {
    query.type = "thisMonth";
  }
  const result = await callAdminOverview(query);
  const ops = result?.operations || {};
  const commercial = result?.commercial || {};
  const financial = result?.financial || {};
  return {
    period: result?.analytics?.period || null,
    operations: {
      totalJobs: ops.totalJobs,
      activeJobs: ops.activeJobs,
      completedJobs: ops.completedJobs,
      onHoldJobs: ops.onHoldJobs,
      avgProgressPercent: ops.avgProgressPercent,
      awaitingSiteEngineerReviews: ops.awaitingSiteEngineerReviews,
      materialLinesDelayed: ops.materialLinesDelayed,
      procurementOpen: ops.procurementOpen,
      todayScheduleCount: (ops.todaySchedule || []).length,
      todaySchedule: (ops.todaySchedule || []).slice(0, 8),
      workflowStageSummary: (ops.workflowStages || []).map((row) => ({
        stageKey: row.key,
        stage: row.label,
        count: row.count,
        jobs: (row.jobs || []).slice(0, 8).map((j) => ({
          ...jobLinkFields(j),
          jobId: j.jobId,
          customer: j.customer,
          systemState: j.systemState,
          onHold: j.onHold,
        })),
      })),
    },
    commercial: {
      leadsInPeriod: commercial.leadsInPeriod,
      pipelineValue: commercial.pipelineValue,
      leadsByStatus: commercial.leadsByStatus,
    },
    financial: {
      contractValueActive: financial.contractValueActive,
      totalInvoiced: financial.totalInvoiced,
      totalPaid: financial.totalPaid,
      outstandingInvoices: financial.outstandingInvoices,
      overdueCount: financial.overdueCount,
    },
    recentActiveJobs: (result?.recent?.jobs || [])
      .filter((j) => j.systemState === "Active")
      .slice(0, 6)
      .map((j) => ({
        ...jobLinkFields(j),
        jobId: j.jobId,
        customer: j.customer,
        stage: j.currentWorkflowLabel || j.stage,
        onHold: j.onHold,
      })),
  };
}

async function getCheckinsSummary({ date } = {}) {
  const { start, end, label } = dayRange(date);
  const sessions = await WorkerAttendanceSession.find({
    checkInTime: { $gte: start, $lte: end },
  })
    .select("workerName workerEmail workerId status checkInTime checkOutTime jobId")
    .sort({ checkInTime: -1 })
    .lean();

  const checkedInToday = sessions.length;
  const stillOnSite = sessions.filter((s) => s.status === "checked_in").length;
  const checkedOut = sessions.filter((s) => s.status === "checked_out").length;

  const openSessions = await WorkerAttendanceSession.find({ status: "checked_in" })
    .select("workerName workerEmail jobId checkInTime")
    .sort({ checkInTime: -1 })
    .limit(15)
    .lean();

  return {
    date: label,
    checkInsToday: checkedInToday,
    checkedOutToday: checkedOut,
    stillOnSiteNow: stillOnSite,
    currentlyCheckedIn: openSessions.map((s) => ({
      workerName: s.workerName || s.workerEmail || s.workerId,
      jobId: s.jobId || "",
      checkInTime: s.checkInTime,
    })),
    recentCheckInsToday: sessions.slice(0, 10).map((s) => ({
      workerName: s.workerName || s.workerEmail || s.workerId,
      status: s.status,
      checkInTime: s.checkInTime,
      checkOutTime: s.checkOutTime || null,
    })),
  };
}

const periodRange = (period = "thisMonth", startDate, endDate) => {
  const p = String(period || "thisMonth").trim();
  if (p === "today") return dayRange();
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
  // thisMonth default
  return {
    start: moment().startOf("month").toDate(),
    end: moment().endOf("month").toDate(),
    label: moment().format("MMMM YYYY"),
  };
};

async function buildWorkerRoster() {
  const [employees, workerUsers] = await Promise.all([
    Employee.find({ status: "Active" }).select("name email employeeId designation department").lean(),
    User.find({ role: "worker" }).select("name email workerId").lean(),
  ]);

  // Merge employee + worker-user into one row when email matches, so EMP124 and W-1002
  // resolve as the same person (attendance sessions usually store the user workerId).
  const byKey = new Map();

  const upsert = (row) => {
    const emailKey = String(row.email || "")
      .trim()
      .toLowerCase();
    const idKey = String(row.workerId || "")
      .trim()
      .toLowerCase();
    const nameKey = String(row.workerName || "")
      .trim()
      .toLowerCase();
    const key = emailKey ? `email:${emailKey}` : idKey ? `id:${idKey}` : nameKey ? `name:${nameKey}` : null;
    if (!key) return;

    if (!byKey.has(key)) {
      byKey.set(key, {
        workerName: row.workerName || "",
        workerId: row.workerId || "",
        ids: [],
        email: row.email || "",
        source: row.source || "",
        designation: row.designation || "",
        department: row.department || "",
      });
    }
    const existing = byKey.get(key);
    if (row.workerName && !existing.workerName) existing.workerName = row.workerName;
    if (row.email && !existing.email) existing.email = row.email;
    if (row.designation) existing.designation = row.designation;
    if (row.department) existing.department = row.department;
    // Prefer EMP* as primary display id when available
    if (row.workerId) {
      if (!existing.ids.some((id) => String(id).toLowerCase() === String(row.workerId).toLowerCase())) {
        existing.ids.push(row.workerId);
      }
      const looksEmp = /^emp/i.test(row.workerId);
      const currentLooksEmp = /^emp/i.test(existing.workerId || "");
      if (!existing.workerId || (looksEmp && !currentLooksEmp)) {
        existing.workerId = row.workerId;
      }
    }
    if (row.source === "employee") existing.source = "employee";
    else if (!existing.source) existing.source = row.source;
  };

  employees.forEach((e) => {
    upsert({
      workerName: e.name,
      workerId: e.employeeId || "",
      email: e.email || "",
      source: "employee",
      designation: e.designation || "",
      department: e.department || "",
    });
  });

  workerUsers.forEach((u) => {
    upsert({
      workerName: u.name,
      workerId: u.workerId || "",
      email: u.email || "",
      source: "user",
    });
  });

  return [...byKey.values()].map((w) => ({
    ...w,
    ids: w.ids.length ? w.ids : w.workerId ? [w.workerId] : [],
  }));
}

/** Exact, prefix/suffix, or digit-suffix match so "124" → "EMP124". */
function idsLooselyMatch(stored, query) {
  const a = String(stored || "")
    .trim()
    .toLowerCase();
  const b = String(query || "")
    .trim()
    .toLowerCase();
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.endsWith(b) || b.endsWith(a)) return true;
  const da = a.replace(/\D/g, "");
  const db = b.replace(/\D/g, "");
  if (!da || !db) return false;
  if (da === db) return true;
  if (db.length >= 3 && da.endsWith(db)) return true;
  if (da.length >= 3 && db.endsWith(da)) return true;
  return false;
}

function workerMatchesQuery(worker, { workerId, workerName } = {}) {
  const wid = String(workerId || "").trim();
  const name = String(workerName || "").trim();
  const allIds = [
    worker.workerId,
    ...(Array.isArray(worker.ids) ? worker.ids : []),
  ].filter(Boolean);

  if (wid) {
    if (allIds.some((id) => idsLooselyMatch(id, wid))) return true;
  }
  if (name) {
    if (allIds.some((id) => idsLooselyMatch(id, name))) return true;
    const rx = new RegExp(escapeRegex(name), "i");
    if (rx.test(worker.workerName || "") || rx.test(worker.email || "")) return true;
  }
  return false;
}

/**
 * Resolve one roster worker from id and/or name/email.
 * Returns { worker } | { error, candidates? }.
 */
function resolveRosterWorker(roster, { workerId, workerName } = {}) {
  const wid = String(workerId || "").trim();
  const name = String(workerName || "").trim();
  if (!wid && !name) {
    return { error: 'Provide workerId or workerName (e.g. workerId="124" or "EMP124")' };
  }

  let matched = roster.filter((w) => workerMatchesQuery(w, { workerId: wid, workerName: name }));

  // Prefer id hits over vague name hits when both were passed
  if (wid && matched.length > 1) {
    const idHits = matched.filter((w) =>
      [w.workerId, ...(w.ids || [])].some((id) => idsLooselyMatch(id, wid))
    );
    if (idHits.length) matched = idHits;
  }

  if (matched.length === 0) {
    return { worker: null };
  }
  if (matched.length > 1) {
    return {
      error: "Multiple workers matched. Pass a fuller id (e.g. EMP124) or exact name/email.",
      candidates: matched.slice(0, 10).map((w) => ({
        workerName: w.workerName,
        workerId: w.workerId || "",
        ids: w.ids || [],
        email: w.email || "",
      })),
    };
  }
  return { worker: matched[0] };
}

async function listWorkersWithoutCheckins({
  period = "thisMonth",
  startDate,
  endDate,
  limit = 50,
} = {}) {
  const { start, end, label } = periodRange(period, startDate, endDate);
  const cap = Math.min(Math.max(Number(limit) || 50, 1), 100);

  const [roster, sessions] = await Promise.all([
    buildWorkerRoster(),
    WorkerAttendanceSession.find({
      checkInTime: { $gte: start, $lte: end },
    })
      .select("workerName workerEmail workerId")
      .lean(),
  ]);

  const punchedNames = new Set();
  const punchedIds = new Set();
  const punchedEmails = new Set();

  sessions.forEach((s) => {
    if (s.workerName) punchedNames.add(String(s.workerName).toLowerCase());
    if (s.workerId) punchedIds.add(String(s.workerId).toLowerCase());
    if (s.workerEmail) punchedEmails.add(String(s.workerEmail).toLowerCase());
  });

  const neverClockedIn = roster.filter((w) => {
    const byName = w.workerName && punchedNames.has(String(w.workerName).toLowerCase());
    const byEmail = w.email && punchedEmails.has(String(w.email).toLowerCase());
    const ids = [w.workerId, ...(w.ids || [])].filter(Boolean);
    const byId = ids.some((id) => punchedIds.has(String(id).toLowerCase()));
    return !byName && !byId && !byEmail;
  });

  const uniquePunchers = new Set([
    ...punchedNames,
    ...punchedIds,
    ...punchedEmails,
  ]).size;

  return {
    period: label,
    periodType: period || "thisMonth",
    totalRoster: roster.length,
    workersWhoCheckedInAtLeastOnce: uniquePunchers,
    workersWithZeroCheckIns: neverClockedIn.length,
    workers: neverClockedIn.slice(0, cap),
    hint:
      roster.length === 0
        ? "No active employees or worker users found in roster."
        : neverClockedIn.length === 0
          ? "Every roster worker has at least one check-in in this period."
          : undefined,
  };
}

function formatDurationMinutes(mins) {
  const n = Math.max(0, Math.round(Number(mins) || 0));
  const h = Math.floor(n / 60);
  const m = n % 60;
  if (h <= 0) return `${m}m`;
  if (m <= 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function sessionMinutes(session, now = new Date()) {
  if (Number(session.totalMinutes) > 0) return Number(session.totalMinutes);
  if (!session.checkInTime) return 0;
  const end =
    session.checkOutTime ||
    (session.status === "checked_in" ? now : null);
  if (!end) return 0;
  const ms = new Date(end).getTime() - new Date(session.checkInTime).getTime();
  return Math.max(0, Math.round(ms / 60000));
}

async function getWorkerAttendanceSummary({
  workerId,
  workerName,
  period = "thisMonth",
  startDate,
  endDate,
  limit = 40,
} = {}) {
  const wid = String(workerId || "").trim();
  const name = String(workerName || "").trim();
  if (!wid && !name) {
    return { error: 'Provide workerId or workerName (e.g. workerId="124" or "EMP124")' };
  }

  const { start, end, label } = periodRange(period, startDate, endDate);
  const cap = Math.min(Math.max(Number(limit) || 40, 1), 100);
  const roster = await buildWorkerRoster();

  const resolved = resolveRosterWorker(roster, { workerId: wid, workerName: name });
  if (resolved.error) {
    return {
      error: resolved.error,
      candidates: resolved.candidates,
      period: label,
    };
  }

  const worker = resolved.worker;
  const queryToken = wid || name;
  const allIds = worker
    ? [worker.workerId, ...(worker.ids || [])].filter(Boolean)
    : queryToken
      ? [queryToken]
      : [];
  const resolvedEmail = worker?.email || "";
  const resolvedName = worker?.workerName || (!/^\d+$/i.test(name) && !/^emp\d+/i.test(name) ? name : "");

  const or = [];
  const seenOr = new Set();
  const pushOr = (clause) => {
    const key = JSON.stringify(clause);
    if (seenOr.has(key)) return;
    seenOr.add(key);
    or.push(clause);
  };

  allIds.forEach((id) => {
    pushOr({ workerId: new RegExp(`^${escapeRegex(id)}$`, "i") });
    // Also match sessions that stored a shorter/longer form of the same id
    const digits = String(id).replace(/\D/g, "");
    if (digits.length >= 3) {
      pushOr({ workerId: new RegExp(`${escapeRegex(digits)}$`, "i") });
    }
  });
  if (resolvedEmail) {
    pushOr({ workerEmail: String(resolvedEmail).toLowerCase() });
  }
  if (resolvedName) {
    pushOr({ workerName: new RegExp(escapeRegex(resolvedName), "i") });
  }
  if (!worker && name && !/^\d+$/.test(name)) {
    pushOr({ workerName: new RegExp(escapeRegex(name), "i") });
    pushOr({ workerEmail: new RegExp(escapeRegex(name), "i") });
  }

  if (!or.length) {
    return { error: "Could not resolve worker identity" };
  }

  const sessions = await WorkerAttendanceSession.find({
    checkInTime: { $gte: start, $lte: end },
    $or: or,
  })
    .select(
      "workerName workerEmail workerId status checkInTime checkOutTime jobId totalMinutes"
    )
    .sort({ checkInTime: -1 })
    .lean();

  const now = new Date();
  const daysPresent = new Set();
  let totalMinutes = 0;
  let checkedOutCount = 0;
  let stillCheckedInCount = 0;

  sessions.forEach((s) => {
    if (s.checkInTime) {
      daysPresent.add(moment(s.checkInTime).format("YYYY-MM-DD"));
    }
    totalMinutes += sessionMinutes(s, now);
    if (s.status === "checked_in") stillCheckedInCount += 1;
    else checkedOutCount += 1;
  });

  const byDayMap = {};
  sessions.forEach((s) => {
    const day = s.checkInTime ? moment(s.checkInTime).format("YYYY-MM-DD") : "unknown";
    if (!byDayMap[day]) {
      byDayMap[day] = { date: day, sessions: 0, minutes: 0, jobs: new Set() };
    }
    byDayMap[day].sessions += 1;
    byDayMap[day].minutes += sessionMinutes(s, now);
    if (s.jobId) byDayMap[day].jobs.add(String(s.jobId));
  });

  const byDay = Object.values(byDayMap)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .slice(0, cap)
    .map((d) => ({
      date: d.date,
      sessions: d.sessions,
      totalMinutes: d.minutes,
      totalHoursLabel: formatDurationMinutes(d.minutes),
      jobs: [...d.jobs],
    }));

  if (!worker && sessions.length === 0) {
    return {
      period: label,
      periodType: period || "thisMonth",
      worker: {
        workerId: queryToken || null,
        workerName: null,
        email: null,
        ids: [],
        foundInRoster: false,
      },
      totalSessions: 0,
      daysPresent: 0,
      totalMinutes: 0,
      totalHoursLabel: "0m",
      hint: `No roster match and no attendance sessions found for "${wid || name}" in ${label}. Try EMP124, full name, or email.`,
    };
  }

  const displayName =
    worker?.workerName ||
    sessions[0]?.workerName ||
    sessions[0]?.workerEmail ||
    worker?.workerId ||
    queryToken;

  const primaryId =
    worker?.workerId ||
    sessions[0]?.workerId ||
    allIds[0] ||
    queryToken ||
    "";

  return {
    period: label,
    periodType: period || "thisMonth",
    worker: {
      workerId: primaryId,
      workerName: displayName,
      email: resolvedEmail || sessions[0]?.workerEmail || "",
      ids: allIds.length ? allIds : primaryId ? [primaryId] : [],
      foundInRoster: !!worker,
    },
    totalSessions: sessions.length,
    daysPresent: daysPresent.size,
    checkedOutSessions: checkedOutCount,
    stillCheckedInSessions: stillCheckedInCount,
    totalMinutes,
    totalHoursLabel: formatDurationMinutes(totalMinutes),
    byDay,
    recentSessions: sessions.slice(0, Math.min(cap, 20)).map((s) => ({
      date: s.checkInTime ? moment(s.checkInTime).format("YYYY-MM-DD") : null,
      status: s.status,
      checkInTime: s.checkInTime,
      checkOutTime: s.checkOutTime || null,
      jobId: s.jobId || "",
      minutes: sessionMinutes(s, now),
      durationLabel: formatDurationMinutes(sessionMinutes(s, now)),
    })),
    hint:
      sessions.length === 0
        ? `${displayName} has no check-ins in ${label}.`
        : undefined,
  };
}

async function listJobs({ systemState, search, limit = 15 } = {}) {
  const cap = Math.min(Math.max(Number(limit) || 15, 1), 40);
  const filter = { removed: { $ne: true } };
  if (systemState) {
    filter.systemState = systemState;
  }

  const q = search && String(search).trim() ? String(search).trim() : "";
  const tokens = q ? tokenizeJobSearch(q) : [];
  if (q) {
    const textOr = buildJobTextSearchOr(q);
    const customerIds = await findCustomerIdsForJobSearch(q);
    filter.$or = [...textOr];
    if (customerIds.length) {
      filter.$or.push({ customerId: { $in: customerIds } });
    }
  }

  // Fetch a wider pool when searching so we can rank by nickname relevance.
  const fetchCap = q ? Math.min(Math.max(cap * 4, 40), 80) : cap;
  const [rawJobs, total] = await Promise.all([
    Job.find(filter)
      .select("jobId customer site systemState stage conditions.onHold lockedValue updatedAt")
      .sort({ updatedAt: -1 })
      .limit(fetchCap)
      .lean(),
    Job.countDocuments(filter),
  ]);

  let jobs = rawJobs;
  if (q && tokens.length) {
    jobs = [...rawJobs]
      .map((j) => ({ ...j, _matchScore: scoreJobAgainstTokens(j, tokens, q) }))
      .sort(
        (a, b) =>
          b._matchScore - a._matchScore || new Date(b.updatedAt) - new Date(a.updatedAt)
      )
      .slice(0, cap);
  } else {
    jobs = rawJobs.slice(0, cap);
  }

  return {
    totalMatching: total,
    returned: jobs.length,
    search: q || null,
    searchTokens: tokens.length ? tokens : undefined,
    hint:
      q && jobs.length === 0
        ? "No jobs matched that nickname. Try a shorter keyword (e.g. metro) or a job code."
        : q && jobs.length > 1
          ? "Multiple jobs matched. Prefer the highest matchScore, or ask the admin which job code."
          : undefined,
    jobs: jobs.map((j) => ({
      ...jobLinkFields(j),
      jobId: j.jobId,
      customer: j.customer,
      site: j.site,
      systemState: j.systemState,
      stage: j.stage,
      onHold: !!j.conditions?.onHold,
      lockedValue: Number(j.lockedValue || 0),
      matchScore: j._matchScore,
    })),
  };
}

async function listScheduleForDate({ date } = {}) {
  const { start, end, label } = dayRange(date);
  const rows = await ScheduleAssignment.find({
    startTime: { $gte: start, $lte: end },
    status: { $nin: ["Cancelled"] },
  })
    .sort({ startTime: 1 })
    .limit(25)
    .lean();

  const jobIds = [...new Set(rows.map((r) => String(r.jobId)).filter(Boolean))];
  const jobMap = {};
  if (jobIds.length) {
    const linked = await Job.find({ _id: { $in: jobIds } }).select("jobId customer").lean();
    linked.forEach((j) => {
      jobMap[String(j._id)] = j;
    });
  }

  return {
    date: label,
    count: rows.length,
    assignments: rows.map((row) => {
      const linked = jobMap[String(row.jobId)];
      return {
        title: row.title,
        role: row.role,
        assigneeName: row.assigneeName,
        status: row.status,
        startTime: row.startTime,
        endTime: row.endTime,
        ...jobLinkFields(linked || row.jobId),
        jobCode: linked?.jobId || "",
        customer: linked?.customer || "",
      };
    }),
  };
}

async function getJobStatus({ jobId } = {}) {
  const job = await resolveJob(jobId);
  const wf = ensureV3WorkflowEvents(job.workflowEvents || {});
  const version = job.workflowVersion || 3;
  const currentKey = getCurrentWorkflowStage(job);
  const currentStage = wf[currentKey] || {};

  return {
    ...jobLinkFields(job),
    jobId: job.jobId,
    customer: job.customer,
    site: job.site,
    systemState: job.systemState,
    legacyStage: job.stage,
    currentWorkflowStageKey: currentKey,
    currentWorkflowStageLabel: STAGE_LABELS[currentKey] || currentKey,
    currentStageStatus: currentStage.stageStatus || "Pending",
    siteEngineerStatus: currentStage.siteEngineerStatus || "NotRequired",
    completionPercent: calcJobCompletionPercent(wf, version),
    onHold: !!job.conditions?.onHold,
    holdReason: job.conditions?.holdReason || "",
    isOverdue: !!job.conditions?.isOverdue,
    hasDefects: !!job.conditions?.hasDefects,
    lockedValue: job.lockedValue,
    updatedAt: job.updatedAt,
  };
}

async function getJobBlockers({ jobId } = {}) {
  const job = await resolveJob(jobId);
  const blockers = [];

  if (job.conditions?.onHold) {
    blockers.push({
      type: "on_hold",
      message: job.conditions.holdReason || "Job is on hold",
    });
  }
  if (job.conditions?.isOverdue) {
    blockers.push({ type: "overdue", message: "Job marked as overdue" });
  }
  if (job.conditions?.hasDefects) {
    blockers.push({ type: "defects", message: "Job has reported defects" });
  }

  const wf = ensureV3WorkflowEvents(job.workflowEvents || {});
  for (const [key, stage] of Object.entries(wf)) {
    if (!stage || typeof stage !== "object") continue;
    if (stage.stageStatus === "Awaiting Site Engineer" || stage.siteEngineerStatus === "Pending") {
      blockers.push({
        type: "site_engineer_stage",
        stage: STAGE_LABELS[key] || key,
        message: "Awaiting site engineer on this workflow stage",
      });
    }
    if (stage.siteEngineerStatus === "Rejected") {
      blockers.push({
        type: "site_engineer_rejected",
        stage: STAGE_LABELS[key] || key,
        message: stage.siteEngineerComments || "Site engineer rejected this stage",
      });
    }
  }

  const openReviewStatuses = [
    "Pending",
    "Pending Review",
    "On Review",
    "Revision Required",
    "Rejected",
    "On Hold",
  ];
  const reviews = await SiteEngineerReview.find({
    jobId: job._id,
    status: { $in: openReviewStatuses },
  })
    .select("title status moduleStageKey")
    .limit(10)
    .lean();

  reviews.forEach((r) => {
    blockers.push({
      type: "open_site_engineer_review",
      status: r.status,
      module: STAGE_LABELS[r.moduleStageKey] || r.moduleStageKey,
      title: r.title,
    });
  });

  const delayedMaterials = await MaterialPurchase.countDocuments({
    jobId: String(job.jobId),
    status: "Delayed",
  });
  if (delayedMaterials > 0) {
    blockers.push({
      type: "delayed_materials",
      message: `${delayedMaterials} delayed material line(s)`,
    });
  }

  const currentKey = getCurrentWorkflowStage(job);
  return {
    ...jobLinkFields(job),
    jobId: job.jobId,
    currentWorkflowStageLabel: STAGE_LABELS[currentKey] || currentKey,
    blockerCount: blockers.length,
    blockers: blockers.length ? blockers : [{ type: "none", message: "No obvious blockers found" }],
  };
}

async function listJobsByWorkflowStage({ stage, limit = 25 } = {}) {
  const stageKey = resolveStageKey(stage);
  if (!stageKey) {
    return {
      error: `Unknown stage "${stage}". Valid examples: Fabrication, Scheduling, Planning, Drafting, Material Purchasing, Installation.`,
      knownStages: Object.values(STAGE_LABELS),
    };
  }

  const cap = Math.min(Math.max(Number(limit) || 25, 1), 50);
  const jobs = await Job.find({ removed: { $ne: true } })
    .select("jobId customer site systemState workflowEvents workflowVersion conditions.onHold")
    .sort({ updatedAt: -1 })
    .lean();

  const matched = [];
  for (const job of jobs) {
    const wf = ensureV3WorkflowEvents(job.workflowEvents || {});
    const stageData = wf[stageKey] || {};
    const currentKey = getCurrentWorkflowStage(job);
    const status = String(stageData.stageStatus || "Pending");
    const activelyInStage =
      currentKey === stageKey ||
      status === "In Progress" ||
      status === "Awaiting Site Engineer" ||
      stageData.siteEngineerStatus === "Pending" ||
      (Number(stageData.progressPercent) > 0 &&
        Number(stageData.progressPercent) < 100 &&
        !stageData.isCompleted &&
        status !== "Complete");

    if (!activelyInStage) continue;

    matched.push({
      ...jobLinkFields(job),
      jobId: job.jobId,
      customer: job.customer,
      site: job.site,
      systemState: job.systemState,
      onHold: !!job.conditions?.onHold,
      matchReason:
        currentKey === stageKey
          ? "current_workflow_stage"
          : status === "In Progress"
            ? "stage_in_progress"
            : "stage_active",
      currentWorkflowStage: STAGE_LABELS[currentKey] || currentKey,
      stageStatus: status,
      completionPercent: calcJobCompletionPercent(wf, job.workflowVersion || 3),
    });
    if (matched.length >= cap) break;
  }

  return {
    stageKey,
    stageLabel: STAGE_LABELS[stageKey] || stageKey,
    totalMatching: matched.length,
    jobs: matched,
  };
}

async function listJobsAwaitingSiteEngineer({ limit = 30 } = {}) {
  const cap = Math.min(Math.max(Number(limit) || 30, 1), 60);
  const openReviewStatuses = [
    "Pending",
    "Pending Review",
    "On Review",
    "Revision Required",
    "Rejected",
    "On Hold",
  ];

  const reviews = await SiteEngineerReview.find({
    status: { $in: openReviewStatuses },
  })
    .sort({ updatedAt: -1 })
    .limit(100)
    .lean();

  const jobMap = await loadJobMap(reviews.map((r) => r.jobId));
  const byJob = {};

  reviews.forEach((r) => {
    const job = jobMap[String(r.jobId)];
    if (!job) return;
    const key = job.jobId || String(r.jobId);
    if (!byJob[key]) {
      byJob[key] = {
        ...jobLinkFields(job),
        jobId: job.jobId,
        customer: job.customer,
        site: job.site,
        systemState: job.systemState,
        openReviews: [],
        workflowAwaiting: [],
      };
    }
    byJob[key].openReviews.push({
      title: r.title || "",
      status: r.status,
      module: STAGE_LABELS[r.moduleStageKey] || r.moduleStageKey || "",
    });
  });

  const allJobs = await Job.find({ removed: { $ne: true }, systemState: { $ne: "Closed" } })
    .select("jobId customer site systemState workflowEvents")
    .lean();

  for (const job of allJobs) {
    const keys = getWorkflowStageKeys(job);
    const awaiting = [];
    for (const key of keys) {
      if (isStageAwaitingSiteEngineer(job, key)) {
        awaiting.push(STAGE_LABELS[key] || key);
      }
    }
    if (!awaiting.length) continue;
    const code = job.jobId;
    if (!byJob[code]) {
      byJob[code] = {
        ...jobLinkFields(job),
        jobId: job.jobId,
        customer: job.customer,
        site: job.site,
        systemState: job.systemState,
        openReviews: [],
        workflowAwaiting: awaiting,
      };
    } else {
      byJob[code].workflowAwaiting = [
        ...new Set([...(byJob[code].workflowAwaiting || []), ...awaiting]),
      ];
      Object.assign(byJob[code], jobLinkFields(job));
    }
  }

  const jobs = Object.values(byJob).slice(0, cap);
  return {
    totalJobs: jobs.length,
    jobs,
    hint:
      jobs.length === 0
        ? "No jobs currently waiting on site engineer review or approval."
        : undefined,
  };
}

async function listWorkersWithoutAssignments({ limit = 40 } = {}) {
  const cap = Math.min(Math.max(Number(limit) || 40, 1), 80);

  const [roster, schedules, tasks] = await Promise.all([
    buildWorkerRoster(),
    ScheduleAssignment.find({ status: { $in: OPEN_SCHEDULE_STATUSES } })
      .select("assigneeName assignees")
      .lean(),
    WorkerTask.find({ status: { $in: OPEN_TASK_STATUSES } })
      .select("assigneeName assigneeWorkerId")
      .lean(),
  ]);

  const busyNames = new Set();
  const busyIds = new Set();
  const busyEmails = new Set();

  schedules.forEach((row) => {
    collectAssigneeNames(row).forEach((n) => busyNames.add(n.toLowerCase()));
  });
  tasks.forEach((row) => {
    if (row.assigneeName) busyNames.add(String(row.assigneeName).toLowerCase());
    if (row.assigneeWorkerId) busyIds.add(String(row.assigneeWorkerId).toLowerCase());
  });

  const idle = roster.filter((w) => {
    const nameBusy = w.workerName && busyNames.has(String(w.workerName).toLowerCase());
    const idBusy = w.workerId && busyIds.has(String(w.workerId).toLowerCase());
    const emailBusy = w.email && busyEmails.has(String(w.email).toLowerCase());
    return !nameBusy && !idBusy && !emailBusy;
  });

  return {
    totalRoster: roster.length,
    totalWithAssignments: roster.length - idle.length,
    totalWithoutAssignments: idle.length,
    workers: idle.slice(0, cap),
  };
}

async function getJobsForWorker({ workerName, workerId, limit = 20 } = {}) {
  const name = String(workerName || "").trim();
  const wid = String(workerId || "").trim();
  if (!name && !wid) {
    return { error: "Provide workerName or workerId" };
  }

  const cap = Math.min(Math.max(Number(limit) || 20, 1), 40);
  const nameRx = name ? new RegExp(escapeRegex(name), "i") : null;
  const idRx = wid ? new RegExp(`^${escapeRegex(wid)}$`, "i") : null;

  const scheduleOr = [];
  const taskOr = [];
  if (nameRx) {
    scheduleOr.push({ assigneeName: nameRx }, { "assignees.assigneeName": nameRx });
    taskOr.push({ assigneeName: nameRx });
  }
  if (idRx) {
    taskOr.push({ assigneeWorkerId: idRx });
  }

  const [schedules, tasks] = await Promise.all([
    ScheduleAssignment.find({
      status: { $in: OPEN_SCHEDULE_STATUSES },
      $or: scheduleOr.length ? scheduleOr : [{ _id: null }],
    })
      .sort({ startTime: -1 })
      .limit(cap)
      .lean(),
    WorkerTask.find({
      status: { $in: OPEN_TASK_STATUSES },
      $or: taskOr.length ? taskOr : [{ _id: null }],
    })
      .sort({ updatedAt: -1 })
      .limit(cap)
      .lean(),
  ]);

  const jobObjectIds = [
    ...schedules.map((s) => s.jobId),
    ...tasks.map((t) => t.jobId).filter(Boolean),
  ];
  const jobMap = await loadJobMap(jobObjectIds);

  const byJob = {};
  const touch = (mongoId, payload) => {
    const key = String(mongoId || "");
    if (!key) return;
    if (!byJob[key]) {
      const job = jobMap[key];
      byJob[key] = {
        ...jobLinkFields(job || key),
        jobId: job?.jobId || "",
        customer: job?.customer || "",
        site: job?.site || "",
        systemState: job?.systemState || "",
        sources: [],
      };
    }
    byJob[key].sources.push(payload);
  };

  schedules.forEach((row) => {
    touch(row.jobId, {
      type: "schedule",
      title: row.title,
      status: row.status,
      role: row.role,
      assigneeName: row.assigneeName,
      startTime: row.startTime,
      endTime: row.endTime,
    });
  });

  tasks.forEach((row) => {
    touch(row.jobId, {
      type: "worker_task",
      title: row.title,
      status: row.status,
      assigneeName: row.assigneeName,
      assigneeWorkerId: row.assigneeWorkerId || "",
    });
  });

  const jobs = Object.values(byJob).filter((j) => j.jobId || j.sources.length);
  return {
    query: { workerName: name || null, workerId: wid || null },
    totalJobs: jobs.length,
    jobs: jobs.slice(0, cap),
    hint:
      jobs.length === 0
        ? "No open schedule or worker-task assignments matched. Try a fuller name spelling."
        : undefined,
  };
}

async function listWorkersWithAssignments({ limit = 40 } = {}) {
  const cap = Math.min(Math.max(Number(limit) || 40, 1), 80);

  const [schedules, tasks] = await Promise.all([
    ScheduleAssignment.find({ status: { $in: OPEN_SCHEDULE_STATUSES } })
      .select("jobId assigneeName assignees title status startTime")
      .sort({ startTime: -1 })
      .limit(200)
      .lean(),
    WorkerTask.find({ status: { $in: OPEN_TASK_STATUSES } })
      .select("jobId assigneeName assigneeWorkerId title status")
      .sort({ updatedAt: -1 })
      .limit(200)
      .lean(),
  ]);

  const jobMap = await loadJobMap([
    ...schedules.map((s) => s.jobId),
    ...tasks.map((t) => t.jobId).filter(Boolean),
  ]);

  const byWorker = {};
  const add = (workerName, workerKey, jobMongoId, source) => {
    const name = String(workerName || "").trim();
    if (!name) return;
    const key = `${name.toLowerCase()}|${String(workerKey || "").toLowerCase()}`;
    if (!byWorker[key]) {
      byWorker[key] = {
        workerName: name,
        workerId: workerKey || "",
        jobCodes: new Set(),
        assignmentCount: 0,
        samples: [],
      };
    }
    const job = jobMap[String(jobMongoId || "")];
    if (job?.jobId) byWorker[key].jobCodes.add(job.jobId);
    byWorker[key].assignmentCount += 1;
    if (byWorker[key].samples.length < 3) {
      byWorker[key].samples.push({
        ...source,
        ...jobLinkFields(job || jobMongoId),
        jobId: job?.jobId || "",
        customer: job?.customer || "",
      });
    }
  };

  schedules.forEach((row) => {
    collectAssigneeNames(row).forEach((n) => {
      add(n, "", row.jobId, { type: "schedule", title: row.title, status: row.status });
    });
  });

  tasks.forEach((row) => {
    add(row.assigneeName, row.assigneeWorkerId, row.jobId, {
      type: "worker_task",
      title: row.title,
      status: row.status,
    });
  });

  const workers = Object.values(byWorker)
    .map((w) => ({
      workerName: w.workerName,
      workerId: w.workerId || undefined,
      jobCount: w.jobCodes.size,
      jobIds: [...w.jobCodes].slice(0, 10),
      assignmentCount: w.assignmentCount,
      samples: w.samples,
    }))
    .sort((a, b) => b.assignmentCount - a.assignmentCount)
    .slice(0, cap);

  return {
    totalWorkers: workers.length,
    workers,
  };
}

async function getAssigneesForJob({ jobId } = {}) {
  const job = await resolveJob(jobId);

  const [schedules, tasks] = await Promise.all([
    ScheduleAssignment.find({
      jobId: job._id,
      status: { $in: OPEN_SCHEDULE_STATUSES },
    })
      .sort({ startTime: 1 })
      .lean(),
    WorkerTask.find({
      jobId: job._id,
      status: { $in: OPEN_TASK_STATUSES },
    })
      .sort({ updatedAt: -1 })
      .lean(),
  ]);

  const people = {};
  const note = (name, workerKey, detail) => {
    const n = String(name || "").trim();
    if (!n) return;
    const key = n.toLowerCase();
    if (!people[key]) {
      people[key] = { workerName: n, workerId: workerKey || "", assignments: [] };
    } else if (workerKey && !people[key].workerId) {
      people[key].workerId = workerKey;
    }
    people[key].assignments.push(detail);
  };

  schedules.forEach((row) => {
    collectAssigneeNames(row).forEach((n) => {
      note(n, "", {
        type: "schedule",
        title: row.title,
        role: row.role,
        status: row.status,
        startTime: row.startTime,
        endTime: row.endTime,
      });
    });
  });

  tasks.forEach((row) => {
    note(row.assigneeName, row.assigneeWorkerId, {
      type: "worker_task",
      title: row.title,
      status: row.status,
    });
  });

  return {
    ...jobLinkFields(job),
    jobId: job.jobId,
    customer: job.customer,
    site: job.site,
    currentWorkflowStage: STAGE_LABELS[getCurrentWorkflowStage(job)] || getCurrentWorkflowStage(job),
    assigneeCount: Object.keys(people).length,
    assignees: Object.values(people),
    hint:
      Object.keys(people).length === 0
        ? "No open schedule or worker-task assignees found for this job."
        : undefined,
  };
}

async function listPendingInvoices({ limit = 30, includeDraft = true } = {}) {
  const cap = Math.min(Math.max(Number(limit) || 30, 1), 60);
  const InvoiceModel = Invoice || require("../../models/appModels/Invoice");

  const statusFilter = includeDraft
    ? { $in: ["Draft", "Issued", "Partially Paid", "Overdue"] }
    : { $in: ["Issued", "Partially Paid", "Overdue"] };

  const invoices = await InvoiceModel.find({
    removed: { $ne: true },
    $or: [{ amountDue: { $gt: 0 } }, { status: statusFilter }],
  })
    .select("number status total amountPaid amountDue date expiredDate job invoiceType currency isOverdue")
    .sort({ date: -1 })
    .limit(cap)
    .populate({ path: "job", select: "_id jobId customer site systemState" })
    .lean();

  const pending = invoices.filter(
    (inv) =>
      Number(inv.amountDue || 0) > 0 ||
      ["Draft", "Issued", "Partially Paid", "Overdue"].includes(inv.status)
  );

  const byJob = {};
  pending.forEach((inv) => {
    const job = inv.job || {};
    const jobCode = job.jobId || String(inv.job?._id || inv.job || "");
    if (!byJob[jobCode]) {
      byJob[jobCode] = {
        ...jobLinkFields(job),
        jobId: job.jobId || jobCode,
        customer: job.customer || "",
        site: job.site || "",
        systemState: job.systemState || "",
        invoices: [],
        totalAmountDue: 0,
      };
    }
    byJob[jobCode].invoices.push({
      number: inv.number,
      status: inv.status,
      invoiceType: inv.invoiceType,
      total: inv.total,
      amountPaid: inv.amountPaid,
      amountDue: inv.amountDue,
      date: inv.date,
      expiredDate: inv.expiredDate,
      isOverdue: !!inv.isOverdue || (Number(inv.amountDue) > 0 && inv.expiredDate && new Date(inv.expiredDate) < new Date()),
      currency: inv.currency,
    });
    byJob[jobCode].totalAmountDue += Number(inv.amountDue || 0);
  });

  const jobs = Object.values(byJob);
  return {
    totalPendingInvoices: pending.length,
    totalJobsWithPendingInvoices: jobs.length,
    totalAmountDue: jobs.reduce((s, j) => s + j.totalAmountDue, 0),
    jobs,
    invoices: pending.slice(0, cap).map((inv) => ({
      number: inv.number,
      status: inv.status,
      amountDue: inv.amountDue,
      total: inv.total,
      ...jobLinkFields(inv.job),
      jobId: inv.job?.jobId || "",
      customer: inv.job?.customer || "",
    })),
  };
}

async function listPurchaseOrders({
  period = "thisMonth",
  status,
  startDate,
  endDate,
  limit = 30,
} = {}) {
  const cap = Math.min(Math.max(Number(limit) || 30, 1), 60);
  const filter = {};

  const statusRaw = String(status || "").trim();
  if (statusRaw) {
    const lowered = statusRaw.toLowerCase();
    if (["received", "this month received", "received this month"].some((s) => lowered.includes("received"))) {
      filter.status = "Received";
    } else if (lowered.includes("open") || lowered.includes("pending")) {
      filter.status = { $in: ["Ordered", "Delayed", "Partially Received"] };
    } else if (["Ordered", "Delayed", "Partially Received", "Received", "Cancelled"].includes(statusRaw)) {
      filter.status = statusRaw;
    } else {
      filter.status = new RegExp(`^${escapeRegex(statusRaw)}$`, "i");
    }
  }

  const usePeriod = period && period !== "all";
  let periodLabel = "all";
  if (usePeriod) {
    const range = periodRange(period, startDate, endDate);
    periodLabel = range.label;
    if (filter.status === "Received") {
      filter.$or = [
        { receivedAt: { $gte: range.start, $lte: range.end } },
        {
          receivedAt: null,
          status: "Received",
          updatedAt: { $gte: range.start, $lte: range.end },
        },
      ];
    } else {
      filter.orderedAt = { $gte: range.start, $lte: range.end };
    }
  }

  const rows = await PurchaseOrder.find(filter)
    .sort({ orderedAt: -1, updatedAt: -1 })
    .limit(cap)
    .populate({ path: "jobId", select: "_id jobId customer site" })
    .populate({ path: "supplierId", select: "name companyName" })
    .lean();

  return {
    period: usePeriod ? periodLabel : "all",
    statusFilter: filter.status || "any",
    total: rows.length,
    purchaseOrders: rows.map((po) => ({
      poNumber: po.poNumber,
      status: po.status,
      orderedAt: po.orderedAt,
      receivedAt: po.receivedAt,
      expectedDelivery: po.expectedDelivery || "",
      delayReason: po.delayReason || "",
      ...jobLinkFields(po.jobId),
      jobId: po.jobId?.jobId || "",
      customer: po.jobId?.customer || "",
      supplier:
        po.supplierId?.name || po.supplierId?.companyName || String(po.supplierId || ""),
      lineCount: (po.lines || []).length,
    })),
  };
}

const OPEN_LEAD_STATUSES = ["New", "Contacted", "Quoted"];

const mapCustomerSummary = (c) => ({
  id: String(c._id),
  name: c.name || "",
  companyName: c.companyName || "",
  email: c.email || c.portalEmail || "",
  phone: c.phone || "",
  mobile: c.mobile || "",
  contactPerson: c.contactPerson || "",
  address: c.address || "",
  status: c.status || "",
  hasPortal: !!(c.user || c.portalEmail),
  createdAt: c.createdAt,
});

async function listCustomers({
  status,
  query,
  period = "all",
  startDate,
  endDate,
  limit = 30,
} = {}) {
  const cap = Math.min(Math.max(Number(limit) || 30, 1), 60);
  const filter = {};

  const statusRaw = String(status || "").trim();
  if (statusRaw && statusRaw.toLowerCase() !== "all") {
    const allowed = ["Active", "Completed"];
    const match = allowed.find((s) => s.toLowerCase() === statusRaw.toLowerCase());
    filter.status = match || statusRaw;
  }

  const q = String(query || "").trim();
  if (q) {
    const rx = new RegExp(escapeRegex(q), "i");
    filter.$or = [
      { name: rx },
      { companyName: rx },
      { email: rx },
      { portalEmail: rx },
      { phone: rx },
      { mobile: rx },
      { contactPerson: rx },
    ];
  }

  const usePeriod = period && period !== "all";
  let periodLabel = "all";
  if (usePeriod) {
    const range = periodRange(period, startDate, endDate);
    periodLabel = range.label;
    filter.createdAt = { $gte: range.start, $lte: range.end };
  }

  const [total, byStatus, customers] = await Promise.all([
    Customer.countDocuments(filter),
    Customer.aggregate([
      { $match: filter },
      { $group: { _id: "$status", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    Customer.find(filter)
      .select(
        "name companyName email portalEmail phone mobile contactPerson address status user createdAt"
      )
      .sort({ createdAt: -1 })
      .limit(cap)
      .lean(),
  ]);

  return {
    period: periodLabel,
    periodType: period,
    query: q || null,
    statusFilter: filter.status || "any",
    totalCustomers: total,
    byStatus: byStatus.map((row) => ({
      status: row._id || "Unknown",
      count: row.count,
    })),
    customers: customers.map(mapCustomerSummary),
  };
}

async function getCustomer({ query, includeJobs = true, limit = 20 } = {}) {
  const q = String(query || "").trim();
  if (!q) {
    return { error: "query is required (customer name, company, email, or phone)" };
  }

  const rx = new RegExp(escapeRegex(q), "i");
  const matches = await Customer.find({
    $or: [
      { name: rx },
      { companyName: rx },
      { email: rx },
      { portalEmail: rx },
      { phone: rx },
      { mobile: rx },
      { contactPerson: rx },
    ],
  })
    .select(
      "name companyName email portalEmail phone mobile contactPerson address status user leadId addresses contacts phones createdAt updatedAt"
    )
    .sort({ updatedAt: -1 })
    .limit(8)
    .lean();

  if (!matches.length) {
    return { query: q, found: 0, customers: [], message: "No customers matched that query" };
  }

  const primary = matches[0];
  let jobs = [];
  if (includeJobs !== false && includeJobs !== "false") {
    const nameVariants = [primary.name, primary.companyName].filter(Boolean);
    const jobFilter = {
      $or: [{ customerId: primary._id }],
    };
    if (nameVariants.length) {
      jobFilter.$or.push(
        ...nameVariants.map((n) => ({
          customer: new RegExp(escapeRegex(n), "i"),
        }))
      );
    }
    const jobCap = Math.min(Math.max(Number(limit) || 20, 1), 40);
    jobs = await Job.find(jobFilter)
      .select("jobId customer site systemState customerId createdAt updatedAt")
      .sort({ updatedAt: -1 })
      .limit(jobCap)
      .lean();
  }

  return {
    query: q,
    found: matches.length,
    customer: {
      ...mapCustomerSummary(primary),
      addresses: (primary.addresses || []).slice(0, 5),
      contacts: (primary.contacts || []).slice(0, 5),
      phones: (primary.phones || []).slice(0, 5),
      leadId: primary.leadId ? String(primary.leadId) : null,
      updatedAt: primary.updatedAt,
    },
    otherMatches:
      matches.length > 1
        ? matches.slice(1).map((c) => ({
            id: String(c._id),
            name: c.name || "",
            companyName: c.companyName || "",
            email: c.email || "",
            status: c.status || "",
          }))
        : [],
    jobs: jobs.map((j) => ({
      ...jobLinkFields(j),
      jobId: j.jobId,
      customer: j.customer || "",
      site: j.site || "",
      systemState: j.systemState || "",
      updatedAt: j.updatedAt,
    })),
    jobCount: jobs.length,
  };
}

async function listLeads(
  {
    period = "thisMonth",
    status,
    assignedTo,
    openOnly = false,
    startDate,
    endDate,
    limit = 30,
  } = {},
  context = {}
) {
  const cap = Math.min(Math.max(Number(limit) || 30, 1), 60);
  const filter = {};

  const usePeriod = period && period !== "all";
  let periodLabel = "all";
  if (usePeriod) {
    const range = periodRange(period, startDate, endDate);
    periodLabel = range.label;
    filter.createdAt = { $gte: range.start, $lte: range.end };
  }

  const statusRaw = String(status || "").trim();
  const wantOpen =
    openOnly === true ||
    openOnly === "true" ||
    statusRaw.toLowerCase() === "open";

  if (wantOpen) {
    filter.status = { $in: OPEN_LEAD_STATUSES };
  } else if (statusRaw && statusRaw.toLowerCase() !== "all") {
    const allowed = ["New", "Contacted", "Quoted", "Lost", "Converted"];
    const match = allowed.find((s) => s.toLowerCase() === statusRaw.toLowerCase());
    filter.status = match || statusRaw;
  }

  const assigneeRaw = String(assignedTo || "").trim();
  let assigneeFilter = null;
  if (assigneeRaw) {
    const actor = context.actor || {};
    const names = [];
    if (assigneeRaw.toLowerCase() === "me") {
      const full = [actor.name, actor.surname].filter(Boolean).join(" ").trim();
      if (full) names.push(full);
      if (actor.name) names.push(String(actor.name).trim());
      if (actor.email) names.push(String(actor.email).trim());
    } else {
      names.push(assigneeRaw);
    }
    const unique = [...new Set(names.filter(Boolean))];
    if (!unique.length) {
      return {
        period: periodLabel,
        periodType: period,
        assignedTo: assigneeRaw,
        openOnly: wantOpen,
        totalLeadsCreated: 0,
        byStatus: [],
        leads: [],
        warning:
          assigneeRaw.toLowerCase() === "me"
            ? "Could not resolve logged-in admin name/email for assignedTo=me"
            : "No assignee name provided",
      };
    }
    assigneeFilter = unique.map((n) => n);
    filter.$or = unique.map((n) => ({
      assignedSalesperson: new RegExp(escapeRegex(n), "i"),
    }));
  }

  const [total, byStatus, leads] = await Promise.all([
    Lead.countDocuments(filter),
    Lead.aggregate([
      { $match: filter },
      { $group: { _id: "$status", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    Lead.find(filter)
      .select(
        "clientName contactPerson phone email status leadSource category siteAddress assignedSalesperson createdAt"
      )
      .sort({ createdAt: -1 })
      .limit(cap)
      .lean(),
  ]);

  return {
    period: periodLabel,
    periodType: period,
    assignedTo: assigneeFilter || assigneeRaw || null,
    openOnly: wantOpen,
    totalLeadsCreated: total,
    byStatus: byStatus.map((row) => ({
      status: row._id || "Unknown",
      count: row.count,
    })),
    leads: leads.map((l) => ({
      clientName: l.clientName,
      contactPerson: l.contactPerson || "",
      phone: l.phone || "",
      email: l.email || "",
      status: l.status,
      leadSource: l.leadSource || "",
      category: l.category || "",
      siteAddress: l.siteAddress || "",
      assignedSalesperson: l.assignedSalesperson || "",
      createdAt: l.createdAt,
    })),
  };
}

/** Resolve "me" / name into match strings for interaction.createdBy or assignee. */
const resolveActorNameHints = (raw, actor = {}) => {
  const value = String(raw || "").trim();
  if (!value) return [];
  if (value.toLowerCase() === "me") {
    const names = [];
    const full = [actor.name, actor.surname].filter(Boolean).join(" ").trim();
    if (full) names.push(full);
    if (actor.name) names.push(String(actor.name).trim());
    if (actor.email) names.push(String(actor.email).trim());
    return [...new Set(names.filter(Boolean))];
  }
  return [value];
};

/**
 * Lead follow-up / interaction history (Call, Email, Site Visit, Note) and upcoming nextFollowUpDate.
 * Use for "last follow up I took", "follow-ups on Coastal Homes", etc.
 */
async function listLeadFollowups(
  {
    kind = "interactions",
    createdBy,
    leadSearch,
    period = "all",
    startDate,
    endDate,
    limit = 10,
  } = {},
  context = {}
) {
  const cap = Math.min(Math.max(Number(limit) || 10, 1), 40);
  const mode = String(kind || "interactions").toLowerCase() === "upcoming" ? "upcoming" : "interactions";
  const actor = context.actor || {};
  const createdByHints = resolveActorNameHints(createdBy, actor);
  const search = String(leadSearch || "").trim();

  if (mode === "upcoming") {
    const filter = {
      nextFollowUpDate: { $exists: true, $ne: null },
    };
    const andClauses = [];
    if (search) {
      const rx = new RegExp(escapeRegex(search), "i");
      andClauses.push({
        $or: [{ clientName: rx }, { contactPerson: rx }],
      });
    }
    if (String(createdBy || "").trim().toLowerCase() === "me" && !createdByHints.length) {
      return {
        kind: "upcoming",
        count: 0,
        followups: [],
        warning: "Could not resolve logged-in admin name/email for createdBy=me",
      };
    }
    if (createdByHints.length) {
      andClauses.push({
        $or: createdByHints.map((n) => ({
          assignedSalesperson: new RegExp(escapeRegex(n), "i"),
        })),
      });
    }
    if (andClauses.length) filter.$and = andClauses;

    let periodLabel = "from today";
    if (period && period !== "all") {
      const range = periodRange(period, startDate, endDate);
      periodLabel = range.label;
      filter.nextFollowUpDate = { $gte: range.start, $lte: range.end };
    } else {
      filter.nextFollowUpDate = { $gte: moment().startOf("day").toDate() };
    }

    const leads = await Lead.find(filter)
      .select("clientName status assignedSalesperson nextFollowUpDate contactPerson phone")
      .sort({ nextFollowUpDate: 1 })
      .limit(cap)
      .lean();

    return {
      kind: "upcoming",
      period: periodLabel,
      createdBy: createdByHints.length ? createdByHints : createdBy || null,
      leadSearch: search || null,
      count: leads.length,
      followups: leads.map((l) => ({
        leadId: String(l._id),
        clientName: l.clientName,
        status: l.status,
        assignedSalesperson: l.assignedSalesperson || "",
        nextFollowUpDate: l.nextFollowUpDate,
        contactPerson: l.contactPerson || "",
        phone: l.phone || "",
        url: `/admin/lead/${l._id}`,
      })),
      hint:
        leads.length === 0
          ? "No upcoming nextFollowUpDate found. Say so clearly; do not invent follow-ups."
          : "These are scheduled nextFollowUpDate values, not logged interaction notes.",
    };
  }

  // Logged interactions (actual follow-ups taken)
  if (String(createdBy || "").trim().toLowerCase() === "me" && !createdByHints.length) {
    return {
      kind: "interactions",
      count: 0,
      latest: null,
      followups: [],
      warning: "Could not resolve logged-in admin name/email for createdBy=me",
    };
  }
  const match = { "interactions.0": { $exists: true } };
  if (search) {
    const rx = new RegExp(escapeRegex(search), "i");
    match.$or = [{ clientName: rx }, { contactPerson: rx }];
  }

  const pipeline = [{ $match: match }, { $unwind: "$interactions" }];

  if (createdByHints.length) {
    pipeline.push({
      $match: {
        $or: createdByHints.map((n) => ({
          "interactions.createdBy": new RegExp(escapeRegex(n), "i"),
        })),
      },
    });
  }

  let periodLabel = "all";
  if (period && period !== "all") {
    const range = periodRange(period, startDate, endDate);
    periodLabel = range.label;
    pipeline.push({
      $match: {
        "interactions.date": { $gte: range.start, $lte: range.end },
      },
    });
  }

  pipeline.push(
    { $sort: { "interactions.date": -1 } },
    { $limit: cap },
    {
      $project: {
        leadId: "$_id",
        clientName: 1,
        status: 1,
        assignedSalesperson: 1,
        nextFollowUpDate: 1,
        type: "$interactions.type",
        notes: "$interactions.notes",
        date: "$interactions.date",
        loggedBy: "$interactions.createdBy",
      },
    }
  );

  const rows = await Lead.aggregate(pipeline);
  const followups = rows.map((r) => ({
    leadId: String(r.leadId),
    clientName: r.clientName,
    status: r.status,
    assignedSalesperson: r.assignedSalesperson || "",
    nextFollowUpDate: r.nextFollowUpDate || null,
    type: r.type || "Note",
    notes: r.notes || "",
    date: r.date,
    loggedBy: r.loggedBy || "",
    url: `/admin/lead/${r.leadId}`,
  }));

  return {
    kind: "interactions",
    period: periodLabel,
    createdBy: createdByHints.length ? createdByHints : createdBy || null,
    leadSearch: search || null,
    count: followups.length,
    latest: followups[0] || null,
    followups,
    hint:
      followups.length === 0
        ? createdByHints.length
          ? "No follow-up interactions found for that person. Say so clearly; do not invent notes or use lead createdAt as a follow-up."
          : "No follow-up interactions found. Say so clearly; do not invent notes or use lead createdAt as a follow-up."
        : "Answer from these interaction notes/dates. latest is the most recent. Link leads with [clientName](url).",
  };
}

/**
 * Prepare a no-save Excel/CSV download link for jobs + stages.
 * File is generated on click in memory — nothing written to disk or Mongo.
 */
async function exportJobsExcel({
  systemState,
  search,
  limit = 50,
  format = "excel",
} = {}) {
  const cap = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const fmt = String(format || "excel").toLowerCase() === "csv" ? "csv" : "excel";
  const rows = await fetchJobsForExport({
    systemState,
    search,
    limit: cap,
  });
  const downloadUrl = buildJobsExportDownloadUrl({
    limit: cap,
    systemState,
    search,
    format: fmt,
  });
  const extension = fmt === "csv" ? "csv" : "xls";
  const filename = stampFilename("jobs-stages", extension);

  return {
    rowCount: rows.length,
    columns: EXPORT_HEADERS,
    filename,
    downloadUrl,
    format: fmt,
    stored: false,
    hint:
      rows.length === 0
        ? "No jobs matched. Do not invent a download; say nothing matched."
        : `Include this exact markdown download link in your reply (do not paste CSV): [Download Excel report](${downloadUrl}). File is generated on click — not stored on the server.`,
    preview: rows.slice(0, 5),
  };
}

/**
 * Company-wide day off: email + notify all workers, persist for dashboard banner.
 */
async function announceCompanyDayOffTool(
  { date, message, title, sendEmail = true, notifyInApp = true } = {},
  context = {}
) {
  const roster = await buildWorkerRoster();
  return announceCompanyDayOff({
    date: date || tomorrowDateKey(),
    message,
    title,
    sendEmail,
    notifyInApp,
    actor: context.actor || {},
    roster,
  });
}

/**
 * One worker day off: Approved Leave + email + notify that worker.
 */
async function markWorkerDayOffTool(
  {
    workerId,
    workerName,
    date,
    message,
    leaveType = "Other",
    sendEmail = true,
    notifyInApp = true,
  } = {},
  context = {}
) {
  const wid = String(workerId || "").trim();
  const name = String(workerName || "").trim();
  if (!wid && !name) {
    return {
      error:
        'Provide workerId or workerName (e.g. workerName="Ravi" or workerId="EMP124")',
    };
  }

  const roster = await buildWorkerRoster();
  const resolved = resolveRosterWorker(roster, { workerId: wid, workerName: name });
  if (resolved.error) {
    return {
      error: resolved.error,
      candidates: resolved.candidates,
    };
  }
  if (!resolved.worker) {
    return {
      error: `No worker matched "${wid || name}". Try EMP id, full name, or email.`,
    };
  }

  return markWorkerDayOff({
    worker: resolved.worker,
    date: date || tomorrowDateKey(),
    message,
    leaveType,
    sendEmail,
    notifyInApp,
    actor: context.actor || {},
  });
}

/**
 * Draft any worker email — does NOT send. Admin must approve in the UI.
 */
async function prepareWorkerEmailTool(
  {
    workerId,
    workerName,
    scope = "single",
    subject,
    body,
    title,
    notifyInApp = true,
  } = {},
  context = {}
) {
  const wantAll = String(scope || "single").toLowerCase() === "all";
  const roster = await buildWorkerRoster();

  if (wantAll) {
    return prepareWorkerEmailDraft({
      scope: "all",
      subject,
      body,
      title,
      notifyInApp,
      actor: context.actor || {},
      roster,
    });
  }

  const wid = String(workerId || "").trim();
  const name = String(workerName || "").trim();
  if (!wid && !name) {
    return {
      error:
        'Provide workerId or workerName (e.g. workerId="124" / "EMP124", workerName="Ravi"), or scope="all".',
    };
  }

  const resolved = resolveRosterWorker(roster, { workerId: wid, workerName: name });
  if (resolved.error) {
    return {
      error: resolved.error,
      candidates: resolved.candidates,
    };
  }
  if (!resolved.worker) {
    return {
      error: `No worker matched "${wid || name}". Try EMP id, full name, or email.`,
    };
  }

  return prepareWorkerEmailDraft({
    scope: "single",
    worker: resolved.worker,
    subject,
    body,
    title,
    notifyInApp,
    actor: context.actor || {},
    roster,
  });
}

const TOOL_DEFINITIONS = [
  {
    type: "function",
    function: {
      name: "get_dashboard_overview",
      description:
        "Live admin dashboard summary: job counts, pipeline, financial highlights, today's schedule snippet. period: today, thisWeek, or thisMonth.",
      parameters: {
        type: "object",
        properties: {
          period: {
            type: "string",
            enum: ["today", "thisWeek", "thisMonth"],
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_checkins_summary",
      description:
        "Worker attendance: check-ins for a calendar day and who is currently still checked in.",
      parameters: {
        type: "object",
        properties: {
          date: { type: "string", description: "YYYY-MM-DD; defaults to today" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_workers_without_checkins",
      description:
        "List roster workers (active employees + worker users) who have ZERO check-ins in a period. Use for questions like who did not clock in this month / this week / today.",
      parameters: {
        type: "object",
        properties: {
          period: {
            type: "string",
            enum: ["today", "thisWeek", "thisMonth", "lastMonth", "custom"],
            description: "Defaults to thisMonth",
          },
          startDate: { type: "string", description: "YYYY-MM-DD when period is custom" },
          endDate: { type: "string", description: "YYYY-MM-DD when period is custom" },
          limit: { type: "number" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_worker_attendance_summary",
      description:
        "Monthly (or period) attendance summary for ONE worker: days present, total hours, sessions, daily breakdown. Use for 'monthly attendance of worker/employee 124', EMP124, full name, or email. workerId may be partial (124 matches EMP124); the tool resolves EMP* and W-* ids, name, and email.",
      parameters: {
        type: "object",
        properties: {
          workerId: {
            type: "string",
            description:
              'Employee/worker id — full or partial (e.g. "124", "EMP124", "W-1002")',
          },
          workerName: {
            type: "string",
            description: "Worker name or email if id unknown",
          },
          period: {
            type: "string",
            enum: ["today", "thisWeek", "thisMonth", "lastMonth", "custom"],
            description: "Defaults to thisMonth for monthly summary questions",
          },
          startDate: { type: "string", description: "YYYY-MM-DD when period is custom" },
          endDate: { type: "string", description: "YYYY-MM-DD when period is custom" },
          limit: { type: "number", description: "Max daily rows / recent sessions (default 40)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_jobs",
      description:
        "List or search jobs by nickname, customer, site, or job code. Use for casual names like 'metro job' or 'metro rail' — pass a short search keyword (e.g. metro). Returns lockedValue (contract amount). systemState: New, Active, Completed, or Closed.",
      parameters: {
        type: "object",
        properties: {
          systemState: {
            type: "string",
            enum: ["New", "Active", "Completed", "Closed"],
          },
          search: {
            type: "string",
            description:
              "Nickname or partial match: job code, customer, or site (tokenized; e.g. metro from 'metro rail job')",
          },
          limit: { type: "number" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_schedule_for_date",
      description: "Scheduled assignments for a given day.",
      parameters: {
        type: "object",
        properties: {
          date: { type: "string", description: "YYYY-MM-DD; defaults to today" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_job_status",
      description:
        "Current workflow stage, status, and lockedValue (contract) for a job. Accepts job code, Mongo id, or a nickname (customer/site); if several match, error lists candidates — then use list_jobs.",
      parameters: {
        type: "object",
        properties: {
          jobId: {
            type: "string",
            description: "Job code, Mongo id, or nickname (e.g. metro, Acme)",
          },
        },
        required: ["jobId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_job_blockers",
      description:
        "What is blocking or delaying a job: on hold, site engineer reviews, delayed materials, etc.",
      parameters: {
        type: "object",
        properties: {
          jobId: { type: "string" },
        },
        required: ["jobId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_jobs_by_workflow_stage",
      description:
        "List jobs in a workflow stage (Fabrication, Installation, Scheduling, etc.). Includes jobs whose current stage matches OR whose stage is In Progress / awaiting SE.",
      parameters: {
        type: "object",
        properties: {
          stage: {
            type: "string",
            description: "Stage key or label, e.g. fabrication or Fabrication",
          },
          limit: { type: "number" },
        },
        required: ["stage"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_jobs_awaiting_site_engineer",
      description:
        "List jobs blocked or waiting on site engineer approval/review (open SE reviews or workflow stages awaiting SE). Use for questions about SE delays or jobs needing SE approval.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_jobs_for_worker",
      description:
        "Find open schedule assignments and worker tasks for a worker by name or workerId. Use for questions like which job is assigned to worker X.",
      parameters: {
        type: "object",
        properties: {
          workerName: { type: "string", description: "Worker display name (partial match OK)" },
          workerId: { type: "string", description: "Employee/worker id if known" },
          limit: { type: "number" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_workers_with_assignments",
      description:
        "List workers who currently have open schedule or worker-task assignments, with their job codes.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_workers_without_assignments",
      description:
        "List active employees/worker users who currently have NO open schedule or worker-task assignments (idle / free workers).",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_assignees_for_job",
      description:
        "List workers/people currently assigned to a job via scheduling or worker tasks.",
      parameters: {
        type: "object",
        properties: {
          jobId: { type: "string", description: "Job code or Mongo id" },
        },
        required: ["jobId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_pending_invoices",
      description:
        "List unpaid / pending / outstanding / overdue invoices and the jobs they belong to. Use for questions like which jobs have pending invoices.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number" },
          includeDraft: {
            type: "boolean",
            description: "Include Draft invoices (default true)",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_purchase_orders",
      description:
        "List purchase orders. Filter by period (thisMonth/thisWeek/today) and status (Received, Ordered, Delayed, Partially Received, or open). Use for POs received this month, open POs, delayed POs.",
      parameters: {
        type: "object",
        properties: {
          period: {
            type: "string",
            enum: ["today", "thisWeek", "thisMonth", "custom", "all"],
            description: "Defaults to thisMonth for date-scoped questions; use all for status-only lists",
          },
          status: {
            type: "string",
            description: "Received, Ordered, Delayed, Partially Received, Cancelled, or open",
          },
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
      name: "list_leads",
      description:
        "Count and list sales leads (name, status, assignee, createdAt). Does NOT include follow-up notes or interaction history — use list_lead_followups for those. Filter by period, status, open pipeline, and assignee. Use assignedTo='me' for the logged-in admin's leads; openOnly=true (or status=open) for New/Contacted/Quoted. Use period=all when not asking about a creation date window.",
      parameters: {
        type: "object",
        properties: {
          period: {
            type: "string",
            enum: ["today", "last7Days", "thisWeek", "thisMonth", "custom", "all"],
            description:
              "Defaults to thisMonth; use last7Days for last 7 days; use all for assignee/status-only lists (e.g. my open leads)",
          },
          status: {
            type: "string",
            description: "Optional: New, Contacted, Quoted, Lost, Converted, open, or all",
          },
          assignedTo: {
            type: "string",
            description:
              'Salesperson name, or "me" for the logged-in admin (matches assignedSalesperson)',
          },
          openOnly: {
            type: "boolean",
            description: "If true, only New / Contacted / Quoted leads",
          },
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
      name: "list_lead_followups",
      description:
        "Lead follow-up history and upcoming follow-ups. Use for 'last follow up I took', 'follow-ups on X lead', interaction notes (Call/Email/Site Visit/Note), or scheduled nextFollowUpDate. For 'I took' / 'my last follow up' set createdBy='me' and kind=interactions. Do NOT use list_leads for follow-up questions.",
      parameters: {
        type: "object",
        properties: {
          kind: {
            type: "string",
            enum: ["interactions", "upcoming"],
            description:
              "interactions = logged Call/Email/Site Visit/Note history (default). upcoming = leads with nextFollowUpDate due/scheduled.",
          },
          createdBy: {
            type: "string",
            description:
              'Who logged the interaction: "me" for the logged-in admin, or a name. For upcoming, filters assignedSalesperson.',
          },
          leadSearch: {
            type: "string",
            description: "Optional client/contact name filter (e.g. coastal, metro)",
          },
          period: {
            type: "string",
            enum: ["today", "last7Days", "thisWeek", "thisMonth", "custom", "all"],
            description:
              "For interactions: filter by interaction date (default all). For upcoming: filter nextFollowUpDate window (default from today).",
          },
          startDate: { type: "string" },
          endDate: { type: "string" },
          limit: {
            type: "number",
            description: "Max rows (default 10). Use 1–5 for 'last follow up'.",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_customers",
      description:
        "Count and list CRM customers. Use for how many customers, active vs completed, recent customers, or search by name/company/email/phone.",
      parameters: {
        type: "object",
        properties: {
          status: {
            type: "string",
            description: "Active, Completed, or all",
          },
          query: {
            type: "string",
            description: "Optional search: name, company, email, phone, or contact person",
          },
          period: {
            type: "string",
            enum: ["today", "last7Days", "thisWeek", "thisMonth", "custom", "all"],
            description: "Filter by customer createdAt; defaults to all",
          },
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
      name: "get_customer",
      description:
        "Look up one customer by name, company, email, or phone. Returns contact details and linked jobs. Use when asking about a specific customer.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Customer name, company, email, or phone",
          },
          includeJobs: {
            type: "boolean",
            description: "Include linked jobs (default true)",
          },
          limit: {
            type: "number",
            description: "Max jobs to return",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "export_jobs_excel",
      description:
        "Create a downloadable Excel/CSV report of jobs with current workflow stages. Use when the admin asks for an excel/spreadsheet/report/export of jobs. Returns a downloadUrl markdown link — do NOT paste CSV into chat. File is generated on click (not stored on server). Prefer format=excel.",
      parameters: {
        type: "object",
        properties: {
          systemState: {
            type: "string",
            enum: ["New", "Active", "Completed", "Closed"],
          },
          search: {
            type: "string",
            description: "Optional nickname filter (customer/site/job code)",
          },
          limit: {
            type: "number",
            description: "Max rows (default 50, max 200)",
          },
          format: {
            type: "string",
            enum: ["excel", "csv"],
            description: "Defaults to excel (.xls that opens in Excel)",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "announce_company_day_off",
      description:
        "Announce that ALL workers / company / everyone is off on a date (default tomorrow). Emails workers, creates in-app notifications, and shows on every worker dashboard. Use for 'mail all workers tomorrow is off', 'company holiday', 'everyone off'.",
      parameters: {
        type: "object",
        properties: {
          date: {
            type: "string",
            description: "YYYY-MM-DD; defaults to tomorrow (Asia/Kolkata)",
          },
          message: {
            type: "string",
            description: "Optional custom message for email and dashboard",
          },
          title: {
            type: "string",
            description: 'Optional title (default "Company off day")',
          },
          sendEmail: {
            type: "boolean",
            description: "Send emails (default true)",
          },
          notifyInApp: {
            type: "boolean",
            description: "Create in-app notifications (default true)",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "mark_worker_day_off",
      description:
        "Mark ONE worker off on a date (default tomorrow): creates Approved leave, emails that worker, notifies them, and shows on their dashboard. Use for 'Ravi tomorrow is off', 'tell EMP124 they are off', 'for you tomorrow is off' addressed to a named worker.",
      parameters: {
        type: "object",
        properties: {
          workerId: {
            type: "string",
            description: 'Employee/worker id (e.g. "124", "EMP124")',
          },
          workerName: {
            type: "string",
            description: "Worker name or email if id unknown",
          },
          date: {
            type: "string",
            description: "YYYY-MM-DD; defaults to tomorrow (Asia/Kolkata)",
          },
          message: {
            type: "string",
            description: "Optional custom message",
          },
          leaveType: {
            type: "string",
            enum: ["Annual", "Sick", "Unpaid", "Other"],
            description: 'Defaults to "Other"',
          },
          sendEmail: { type: "boolean" },
          notifyInApp: { type: "boolean" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "prepare_worker_email",
      description:
        "Draft an email to one worker or all workers. Does NOT send — creates a pending draft that the admin must Approve & Send in the UI. Use for ANY custom email (attendance warnings, reminders, paycut notices, general messages). For EMP124 / named worker set workerId or workerName; for everyone set scope=all. Always write a clear subject and body from the admin's request.",
      parameters: {
        type: "object",
        properties: {
          scope: {
            type: "string",
            enum: ["single", "all"],
            description: "single (default) or all workers",
          },
          workerId: {
            type: "string",
            description: 'For scope=single: "124", "EMP124", etc.',
          },
          workerName: {
            type: "string",
            description: "For scope=single: name or email",
          },
          subject: {
            type: "string",
            description: "Email subject line",
          },
          body: {
            type: "string",
            description: "Email body (plain text; short paragraphs OK)",
          },
          title: {
            type: "string",
            description: "Optional short title for in-app notification",
          },
          notifyInApp: {
            type: "boolean",
            description: "Also create in-app notification after approve (default true)",
          },
        },
        required: ["subject", "body"],
      },
    },
  },
  ...CATALOG_TOOL_DEFINITIONS,
  ...STAGE_OPS_TOOL_DEFINITIONS,
  ...FINANCE_SALES_TOOL_DEFINITIONS,
  ...CATALOG_EXCEL_TOOL_DEFINITIONS,
  ...SEARCH_CRM_TOOL_DEFINITIONS,
  ...ANALYTICS_OPS_TOOL_DEFINITIONS,
];

const RUNNERS = {
  get_dashboard_overview: getDashboardOverview,
  get_checkins_summary: getCheckinsSummary,
  list_workers_without_checkins: listWorkersWithoutCheckins,
  get_worker_attendance_summary: getWorkerAttendanceSummary,
  list_jobs: listJobs,
  list_schedule_for_date: listScheduleForDate,
  get_job_status: getJobStatus,
  get_job_blockers: getJobBlockers,
  list_jobs_by_workflow_stage: listJobsByWorkflowStage,
  list_jobs_awaiting_site_engineer: listJobsAwaitingSiteEngineer,
  get_jobs_for_worker: getJobsForWorker,
  list_workers_with_assignments: listWorkersWithAssignments,
  list_workers_without_assignments: listWorkersWithoutAssignments,
  get_assignees_for_job: getAssigneesForJob,
  list_pending_invoices: listPendingInvoices,
  list_purchase_orders: listPurchaseOrders,
  list_leads: listLeads,
  list_lead_followups: listLeadFollowups,
  list_customers: listCustomers,
  get_customer: getCustomer,
  export_jobs_excel: exportJobsExcel,
  announce_company_day_off: announceCompanyDayOffTool,
  mark_worker_day_off: markWorkerDayOffTool,
  prepare_worker_email: prepareWorkerEmailTool,
  ...CATALOG_RUNNERS,
  ...STAGE_OPS_RUNNERS,
  ...FINANCE_SALES_RUNNERS,
  ...CATALOG_EXCEL_RUNNERS,
  ...SEARCH_CRM_RUNNERS,
  ...ANALYTICS_OPS_RUNNERS,
};

async function runTool(name, args, context = {}) {
  const fn = RUNNERS[name];
  if (!fn) {
    throw new Error(`Unknown tool: ${name}`);
  }
  return fn(args || {}, context);
}

module.exports = {
  TOOL_DEFINITIONS,
  runTool,
};
