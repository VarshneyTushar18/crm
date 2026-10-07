/**
 * Ask-CRM analytics / ops read tools.
 * Wired into tools.js RUNNERS + TOOL_DEFINITIONS.
 */
const moment = require("moment");
const Job = require("../../models/appModels/Job");
const JobComment = require("../../models/appModels/JobComment");
const SiteEngineerReview = require("../../models/appModels/SiteEngineerReview");
const InstallationSummary = require("../../models/appModels/InstallationSummary");
const FabricationProgressLog = require("../../models/appModels/FabricationProgressLog");
const Fabrication = require("../../models/appModels/Fabrication");
const Installation = require("../../models/appModels/Installation");
const Invoice = require("../../models/appModels/Invoice");
const DefectSnag = require("../../models/appModels/DefectSnag");
const ScheduleAssignment = require("../../models/appModels/ScheduleAssignment");
const WorkerAttendanceSession = require("../../models/appModels/WorkerAttendanceSession");
const Leave = require("../../models/appModels/Leave");
const PurchaseOrder = require("../../models/appModels/PurchaseOrder");
const MaterialPurchase = require("../../models/appModels/MaterialPurchase");
const Lead = require("../../models/appModels/Lead");
const {
  STAGE_LABELS,
  ensureV3WorkflowEvents,
  getWorkflowStageKeys,
  calcJobCompletionPercent,
  isStageAwaitingSiteEngineer,
} = require("../../utils/workflowDefaults");

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const periodRange = (period = "thisWeek", startDate, endDate) => {
  const p = String(period || "thisWeek").trim();
  if (p === "today") {
    return {
      start: moment().startOf("day").toDate(),
      end: moment().endOf("day").toDate(),
      label: moment().format("YYYY-MM-DD"),
    };
  }
  if (p === "last7Days" || p === "last7days") {
    return {
      start: moment().subtract(6, "days").startOf("day").toDate(),
      end: moment().endOf("day").toDate(),
      label: `${moment().subtract(6, "days").format("YYYY-MM-DD")} to ${moment().format("YYYY-MM-DD")}`,
    };
  }
  if (p === "thisMonth") {
    return {
      start: moment().startOf("month").toDate(),
      end: moment().endOf("month").toDate(),
      label: moment().format("MMMM YYYY"),
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
    start: moment().startOf("week").toDate(),
    end: moment().endOf("week").toDate(),
    label: `${moment().startOf("week").format("YYYY-MM-DD")} to ${moment().endOf("week").format("YYYY-MM-DD")}`,
  };
};

const dayRange = (dateStr) => {
  const m = dateStr ? moment(dateStr, "YYYY-MM-DD", true) : moment();
  if (dateStr && !m.isValid()) throw new Error("Invalid date; use YYYY-MM-DD");
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
  return Job.find({
    removed: { $ne: true },
    $or: [{ jobId: rx }, { customer: rx }, { site: rx }],
  })
    .select(
      "_id jobId customer site systemState stage lockedValue totalInvoiced totalPaid variations retentionPercentage workflowEvents workflowVersion conditions updatedAt createdAt"
    )
    .limit(limit)
    .lean();
}

async function resolveOneJob(jobSearch) {
  const q = String(jobSearch || "").trim();
  if (!q) return { error: "jobSearch is required." };
  const jobs = await findJobsBySearch(q, 10);
  if (!jobs.length) return { error: "No job matched.", jobs: [] };
  if (jobs.length > 1) {
    return {
      multipleJobs: jobs.map((j) => ({
        ...jobLink(j),
        customer: j.customer || "",
        site: j.site || "",
      })),
      hint: "Multiple jobs matched. Ask which job code.",
    };
  }
  return { job: jobs[0] };
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

const revisedContract = (job) => {
  const locked = Number(job.lockedValue || 0);
  const vars = (job.variations || [])
    .filter((v) => v.status === "Approved")
    .reduce((s, v) => s + Number(v.amount || 0), 0);
  return locked + vars;
};

const currentStageInfo = (job) => {
  const wf = ensureV3WorkflowEvents(job.workflowEvents || {});
  const version = job.workflowVersion || 3;
  const keys = getWorkflowStageKeys(version);
  let currentKey = keys[0];
  for (const key of keys) {
    const st = wf[key] || {};
    if (!st.isCompleted) {
      currentKey = key;
      break;
    }
    currentKey = key;
  }
  const stage = wf[currentKey] || {};
  return {
    currentWorkflowStageKey: currentKey,
    currentWorkflowStageLabel: STAGE_LABELS[currentKey] || currentKey,
    currentStageStatus: stage.stageStatus || "Pending",
    completionPercent: calcJobCompletionPercent(wf, version),
  };
};

// ---------------------------------------------------------------------------
// 1. get_job_timeline
// ---------------------------------------------------------------------------
async function getJobTimeline({ jobSearch, limit = 40 } = {}) {
  const cap = capLimit(limit, 40, 80);
  const resolved = await resolveOneJob(jobSearch);
  if (resolved.error || resolved.multipleJobs) return resolved;
  const job = resolved.job;
  const stage = currentStageInfo(job);
  const wf = ensureV3WorkflowEvents(job.workflowEvents || {});
  const version = job.workflowVersion || 3;
  const keys = getWorkflowStageKeys(version);

  const events = [];

  events.push({
    at: job.createdAt,
    kind: "job_created",
    title: "Job created",
    detail: `${job.jobId} — ${job.customer || ""}`,
  });

  keys.forEach((key) => {
    const st = wf[key] || {};
    if (st.startActual) {
      events.push({
        at: st.startActual,
        kind: "stage_started",
        title: `${STAGE_LABELS[key] || key} started`,
        detail: st.stageStatus || "",
      });
    }
    if (st.completionActual || st.isCompleted) {
      events.push({
        at: st.completionActual || st.updatedAt || job.updatedAt,
        kind: "stage_completed",
        title: `${STAGE_LABELS[key] || key} completed`,
        detail: st.stageStatus || "Complete",
      });
    }
    if (st.siteEngineerStatus && st.siteEngineerStatus !== "NotRequired") {
      events.push({
        at: st.siteEngineerReviewedAt || st.updatedAt || null,
        kind: "site_engineer",
        title: `SE ${st.siteEngineerStatus} — ${STAGE_LABELS[key] || key}`,
        detail: st.siteEngineerComments || "",
      });
    }
  });

  const [comments, reviews, fabLogs] = await Promise.all([
    JobComment.find({ jobId: job._id })
      .select("authorName authorRole message createdAt")
      .sort({ createdAt: -1 })
      .limit(cap)
      .lean(),
    SiteEngineerReview.find({ jobId: job._id })
      .select("title status reviewedBy reviewedAt comments reviewType moduleStageKey createdAt")
      .sort({ updatedAt: -1 })
      .limit(cap)
      .lean(),
    FabricationProgressLog.find({ jobId: job._id })
      .select("oldPercentage newPercentage remarks updatedBy timestamp")
      .sort({ timestamp: -1 })
      .limit(20)
      .lean(),
  ]);

  comments.forEach((c) => {
    events.push({
      at: c.createdAt,
      kind: "comment",
      title: `Comment by ${c.authorName || "Unknown"}`,
      detail: String(c.message || "").slice(0, 200),
    });
  });
  reviews.forEach((r) => {
    events.push({
      at: r.reviewedAt || r.createdAt,
      kind: "se_review",
      title: `SE review: ${r.title || r.reviewType} — ${r.status}`,
      detail: [r.reviewedBy, r.comments].filter(Boolean).join(" — ").slice(0, 200),
    });
  });
  fabLogs.forEach((l) => {
    events.push({
      at: l.timestamp,
      kind: "fab_progress",
      title: `Fabrication ${l.oldPercentage}% → ${l.newPercentage}%`,
      detail: [l.updatedBy, l.remarks].filter(Boolean).join(" — ").slice(0, 200),
    });
  });

  events.sort((a, b) => {
    const ta = a.at ? new Date(a.at).getTime() : 0;
    const tb = b.at ? new Date(b.at).getTime() : 0;
    return tb - ta;
  });

  return {
    ...jobLink(job),
    customer: job.customer || "",
    site: job.site || "",
    systemState: job.systemState || "",
    ...stage,
    onHold: !!job.conditions?.onHold,
    timeline: events.slice(0, cap),
    hint: "Present newest-first as a short timeline. Link the job with url.",
  };
}

// ---------------------------------------------------------------------------
// 2. get_aging_receivables
// ---------------------------------------------------------------------------
async function getAgingReceivables({ limit = 40 } = {}) {
  const cap = capLimit(limit, 40, 80);
  const now = moment();
  const invoices = await Invoice.find({
    removed: { $ne: true },
    amountDue: { $gt: 0 },
    status: { $in: ["Issued", "Partially Paid", "Overdue"] },
  })
    .select("number status total amountPaid amountDue date expiredDate isOverdue currency job")
    .populate({ path: "job", select: "_id jobId customer" })
    .sort({ expiredDate: 1 })
    .limit(300)
    .lean();

  const buckets = {
    current: { label: "Current (not yet due)", count: 0, amountDue: 0, invoices: [] },
    d1_30: { label: "1–30 days overdue", count: 0, amountDue: 0, invoices: [] },
    d31_60: { label: "31–60 days overdue", count: 0, amountDue: 0, invoices: [] },
    d61_90: { label: "61–90 days overdue", count: 0, amountDue: 0, invoices: [] },
    d90_plus: { label: "90+ days overdue", count: 0, amountDue: 0, invoices: [] },
  };

  invoices.forEach((inv) => {
    const due = Number(inv.amountDue || 0);
    const expired = inv.expiredDate ? moment(inv.expiredDate) : null;
    let key = "current";
    let daysOverdue = 0;
    if (expired && expired.isBefore(now, "day")) {
      daysOverdue = now.diff(expired, "days");
      if (daysOverdue <= 30) key = "d1_30";
      else if (daysOverdue <= 60) key = "d31_60";
      else if (daysOverdue <= 90) key = "d61_90";
      else key = "d90_plus";
    } else if (inv.isOverdue || inv.status === "Overdue") {
      key = "d1_30";
    }

    const row = {
      number: inv.number,
      status: inv.status,
      amountDue: due,
      total: inv.total,
      expiredDate: inv.expiredDate,
      daysOverdue,
      currency: inv.currency || "",
      ...jobLink(inv.job),
      customer: inv.job?.customer || "",
      url: `/admin/invoice`,
    };
    buckets[key].count += 1;
    buckets[key].amountDue += due;
    if (buckets[key].invoices.length < Math.ceil(cap / 4)) {
      buckets[key].invoices.push(row);
    }
  });

  const totalAmountDue = Object.values(buckets).reduce((s, b) => s + b.amountDue, 0);
  const totalCount = Object.values(buckets).reduce((s, b) => s + b.count, 0);

  return {
    asOf: now.format("YYYY-MM-DD"),
    summary: {
      totalInvoices: totalCount,
      totalAmountDue,
      buckets: Object.fromEntries(
        Object.entries(buckets).map(([k, v]) => [
          k,
          { label: v.label, count: v.count, amountDue: v.amountDue },
        ])
      ),
    },
    buckets,
    hint: "Lead with totalAmountDue and the overdue buckets. List a few worst invoices with links.",
  };
}

// ---------------------------------------------------------------------------
// 3. get_worker_utilization
// ---------------------------------------------------------------------------
async function getWorkerUtilization({
  period = "thisWeek",
  startDate,
  endDate,
  workerName,
  limit = 30,
} = {}) {
  const cap = capLimit(limit);
  const range = periodRange(period, startDate, endDate);

  const scheduleFilter = {
    startTime: { $gte: range.start, $lte: range.end },
    status: { $nin: ["Cancelled"] },
  };
  const attendanceFilter = {
    checkInTime: { $gte: range.start, $lte: range.end },
  };
  const leaveFilter = {
    removed: { $ne: true },
    status: "Approved",
    startDate: { $lte: range.end },
    endDate: { $gte: range.start },
  };

  if (workerName) {
    const rx = new RegExp(escapeRegex(String(workerName).trim()), "i");
    scheduleFilter.$or = [
      { assigneeName: rx },
      { "assignees.assigneeName": rx },
      { teams: rx },
    ];
    attendanceFilter.$or = [{ workerName: rx }, { workerEmail: rx }, { workerId: rx }];
    leaveFilter.employeeName = rx;
  }

  const [assignments, sessions, leaves] = await Promise.all([
    ScheduleAssignment.find(scheduleFilter)
      .select("assigneeName assignees teams totalHours startTime endTime status title")
      .lean(),
    WorkerAttendanceSession.find(attendanceFilter)
      .select("workerName workerEmail workerId totalMinutes checkInTime checkOutTime status")
      .lean(),
    Leave.find(leaveFilter)
      .select("employeeName leaveType startDate endDate days status")
      .lean(),
  ]);

  const byWorker = new Map();
  const ensure = (key, name) => {
    if (!byWorker.has(key)) {
      byWorker.set(key, {
        workerName: name,
        scheduledHours: 0,
        attendanceHours: 0,
        leaveDays: 0,
        scheduleCount: 0,
        checkInCount: 0,
      });
    }
    return byWorker.get(key);
  };

  const normKey = (name) =>
    String(name || "")
      .trim()
      .toLowerCase() || "unknown";

  assignments.forEach((a) => {
    const names = [];
    if (a.assigneeName) names.push(a.assigneeName);
    (a.assignees || []).forEach((x) => {
      if (x?.assigneeName) names.push(x.assigneeName);
    });
    if (!names.length && (a.teams || []).length) names.push((a.teams || []).join(", "));
    if (!names.length) names.push("Unassigned");
    const hours =
      Number(a.totalHours) ||
      (a.startTime && a.endTime
        ? Math.max(0, (new Date(a.endTime) - new Date(a.startTime)) / 3600000)
        : 0);
    names.forEach((n) => {
      const w = ensure(normKey(n), n);
      w.scheduledHours += hours;
      w.scheduleCount += 1;
    });
  });

  sessions.forEach((s) => {
    const name = s.workerName || s.workerEmail || s.workerId || "Unknown";
    const w = ensure(normKey(name), name);
    const hours =
      Number(s.totalMinutes) > 0
        ? Number(s.totalMinutes) / 60
        : s.checkInTime && s.checkOutTime
          ? Math.max(0, (new Date(s.checkOutTime) - new Date(s.checkInTime)) / 3600000)
          : 0;
    w.attendanceHours += hours;
    w.checkInCount += 1;
  });

  leaves.forEach((l) => {
    const name = l.employeeName || "Unknown";
    const w = ensure(normKey(name), name);
    w.leaveDays += Number(l.days) || 1;
  });

  const workers = [...byWorker.values()]
    .map((w) => ({
      ...w,
      scheduledHours: Math.round(w.scheduledHours * 10) / 10,
      attendanceHours: Math.round(w.attendanceHours * 10) / 10,
      utilizationPct:
        w.scheduledHours > 0
          ? Math.round((w.attendanceHours / w.scheduledHours) * 100)
          : null,
    }))
    .sort((a, b) => b.scheduledHours - a.scheduledHours || b.attendanceHours - a.attendanceHours)
    .slice(0, cap);

  const totals = workers.reduce(
    (acc, w) => {
      acc.scheduledHours += w.scheduledHours;
      acc.attendanceHours += w.attendanceHours;
      acc.leaveDays += w.leaveDays;
      return acc;
    },
    { scheduledHours: 0, attendanceHours: 0, leaveDays: 0 }
  );

  return {
    period: range.label,
    summary: {
      workers: workers.length,
      scheduledHours: Math.round(totals.scheduledHours * 10) / 10,
      attendanceHours: Math.round(totals.attendanceHours * 10) / 10,
      leaveDays: totals.leaveDays,
      overallUtilizationPct:
        totals.scheduledHours > 0
          ? Math.round((totals.attendanceHours / totals.scheduledHours) * 100)
          : null,
    },
    workers,
    hint: "utilizationPct = attendanceHours / scheduledHours. Null means no schedule for that worker.",
  };
}

// ---------------------------------------------------------------------------
// 4. compare_jobs
// ---------------------------------------------------------------------------
async function compareJobs({ jobSearches, limit = 5 } = {}) {
  let searches = [];
  if (Array.isArray(jobSearches)) {
    searches = jobSearches.map((s) => String(s || "").trim()).filter(Boolean);
  } else if (typeof jobSearches === "string") {
    searches = String(jobSearches)
      .split(/[,|;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (searches.length < 2) {
    return {
      error: "Provide at least 2 jobSearches (comma-separated or array) to compare.",
    };
  }
  searches = searches.slice(0, Math.min(limit, 5));

  const comparisons = [];
  const unresolved = [];

  for (const q of searches) {
    const jobs = await findJobsBySearch(q, 5);
    if (!jobs.length) {
      unresolved.push({ query: q, reason: "no_match" });
      continue;
    }
    if (jobs.length > 1) {
      unresolved.push({
        query: q,
        reason: "multiple_matches",
        candidates: jobs.map((j) => ({
          ...jobLink(j),
          customer: j.customer || "",
        })),
      });
      continue;
    }
    const job = jobs[0];
    const stage = currentStageInfo(job);
    const contract = revisedContract(job);
    comparisons.push({
      query: q,
      ...jobLink(job),
      customer: job.customer || "",
      site: job.site || "",
      systemState: job.systemState || "",
      ...stage,
      onHold: !!job.conditions?.onHold,
      financials: {
        lockedValue: Number(job.lockedValue || 0),
        revisedContract: contract,
        totalInvoiced: Number(job.totalInvoiced || 0),
        totalPaid: Number(job.totalPaid || 0),
        outstanding: Math.max(contract - Number(job.totalPaid || 0), 0),
        unbilled: Math.max(contract - Number(job.totalInvoiced || 0), 0),
        retentionPercentage: Number(job.retentionPercentage || 0),
      },
    });
  }

  return {
    compared: comparisons.length,
    jobs: comparisons,
    unresolved,
    hint:
      comparisons.length >= 2
        ? "Compare stage, completionPercent, and financials side-by-side in a short table-like bullets."
        : "Need at least two resolved jobs. Ask admin to clarify unresolved queries.",
  };
}

// ---------------------------------------------------------------------------
// 5. weekly_ops_digest
// ---------------------------------------------------------------------------
async function weeklyOpsDigest({ date } = {}) {
  const { start, end, label } = dayRange(date);
  const week = periodRange("thisWeek");
  const now = new Date();

  const [
    scheduleCount,
    checkInCount,
    stillOnSite,
    overdueInvoices,
    delayedPos,
    delayedMaterials,
    overdueFollowups,
    openDefects,
    fabLow,
    sePending,
    leaveToday,
    awaitingSeJobs,
  ] = await Promise.all([
    ScheduleAssignment.countDocuments({
      startTime: { $gte: start, $lte: end },
      status: { $nin: ["Cancelled"] },
    }),
    WorkerAttendanceSession.countDocuments({
      checkInTime: { $gte: start, $lte: end },
    }),
    WorkerAttendanceSession.countDocuments({
      checkInTime: { $gte: start, $lte: end },
      status: "checked_in",
    }),
    Invoice.countDocuments({
      removed: { $ne: true },
      $or: [{ status: "Overdue" }, { isOverdue: true }],
      amountDue: { $gt: 0 },
    }),
    PurchaseOrder.countDocuments({ status: "Delayed" }),
    MaterialPurchase.countDocuments({ status: "Delayed" }),
    Lead.countDocuments({
      status: { $in: ["New", "Contacted", "Quoted"] },
      nextFollowUpDate: { $ne: null, $lte: now },
    }),
    DefectSnag.countDocuments({ status: { $in: ["Open", "In Progress"] } }),
    Fabrication.countDocuments({
      status: { $in: ["Pending", "In Progress", "Hold", "Rework"] },
      progressPercentage: { $lte: 50 },
    }),
    SiteEngineerReview.countDocuments({
      status: { $in: ["Pending", "Pending Review", "On Review", "Revision Required"] },
    }),
    Leave.countDocuments({
      removed: { $ne: true },
      status: "Approved",
      startDate: { $lte: end },
      endDate: { $gte: start },
    }),
    Job.find({ removed: { $ne: true }, systemState: { $ne: "Closed" } })
      .select("_id jobId customer workflowEvents workflowVersion")
      .limit(400)
      .lean()
      .then((jobs) =>
        jobs.filter((j) => {
          const keys = getWorkflowStageKeys(j.workflowVersion || 3);
          return keys.some((k) => isStageAwaitingSiteEngineer(j, k));
        }).length
      ),
  ]);

  const sampleFab = await Fabrication.find({
    status: { $in: ["Pending", "In Progress", "Hold", "Rework"] },
    progressPercentage: { $lte: 50 },
  })
    .select("jobId itemName progressPercentage status")
    .sort({ progressPercentage: 1 })
    .limit(5)
    .lean();
  const fabJobMap = await loadJobMap(sampleFab.map((f) => f.jobId));

  return {
    date: label,
    week: week.label,
    digest: {
      onSiteToday: {
        scheduledAssignments: scheduleCount,
        checkIns: checkInCount,
        stillOnSiteNow: stillOnSite,
      },
      overdue: {
        invoices: overdueInvoices,
        delayedPurchaseOrders: delayedPos,
        delayedMaterials,
        overdueLeadFollowups: overdueFollowups,
      },
      qualityOps: {
        openDefectsSnags: openDefects,
        fabricationUnder50Pct: fabLow,
        siteEngineerReviewsPending: sePending,
        jobsAwaitingSiteEngineer: awaitingSeJobs,
      },
      leaveToday,
    },
    sampleFabricationLow: sampleFab.map((f) => {
      const job = fabJobMap[String(f.jobId)] || null;
      return {
        itemName: f.itemName,
        progressPercentage: f.progressPercentage,
        status: f.status,
        ...jobLink(job),
        customer: job?.customer || "",
      };
    }),
    hint:
      "Give a short morning-brief style summary with the digest counts. Suggest who_is_on_site_today / list_overdue_items for details.",
  };
}

// ---------------------------------------------------------------------------
// 6. list_site_engineer_reviews
// ---------------------------------------------------------------------------
async function listSiteEngineerReviews({
  status,
  jobSearch,
  openOnly = true,
  limit = 30,
} = {}) {
  const cap = capLimit(limit);
  const filter = {};
  const statusRaw = String(status || "").trim();
  const wantOpen =
    openOnly === true || openOnly === "true" || statusRaw.toLowerCase() === "open";

  if (wantOpen && !statusRaw) {
    filter.status = {
      $in: ["Pending", "Pending Review", "On Review", "Revision Required", "On Hold"],
    };
  } else if (statusRaw && statusRaw.toLowerCase() !== "all") {
    filter.status = new RegExp(`^${escapeRegex(statusRaw)}$`, "i");
  }

  if (jobSearch) {
    const jobs = await findJobsBySearch(jobSearch, 40);
    if (!jobs.length) return { total: 0, reviews: [], hint: "No job matched." };
    filter.jobId = { $in: jobs.map((j) => j._id) };
  }

  const [total, byStatus, rows] = await Promise.all([
    SiteEngineerReview.countDocuments(filter),
    SiteEngineerReview.aggregate([
      { $match: filter },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    SiteEngineerReview.find(filter)
      .select(
        "jobId title drawingRef status reviewedBy reviewedAt comments reviewType moduleStageKey revisionNumber createdAt"
      )
      .sort({ updatedAt: -1 })
      .limit(cap)
      .lean(),
  ]);

  const jobMap = await loadJobMap(rows.map((r) => r.jobId));
  return {
    total,
    byStatus: byStatus.map((r) => ({ status: r._id || "Unknown", count: r.count })),
    reviews: rows.map((r) => {
      const job = jobMap[String(r.jobId)] || null;
      return {
        id: String(r._id),
        title: r.title || "",
        drawingRef: r.drawingRef || "",
        status: r.status,
        reviewType: r.reviewType,
        moduleStageKey: r.moduleStageKey || "",
        reviewedBy: r.reviewedBy || "",
        reviewedAt: r.reviewedAt,
        revisionNumber: r.revisionNumber || 0,
        commentsPreview: String(r.comments || "").slice(0, 160),
        ...jobLink(job),
        customer: job?.customer || "",
        url: job?._id ? `/admin/job/${job._id}` : `/admin/site-engineer`,
      };
    }),
  };
}

// ---------------------------------------------------------------------------
// 7. get_installation_summary
// ---------------------------------------------------------------------------
async function getInstallationSummary({ jobSearch, incompleteOnly = false, limit = 20 } = {}) {
  const cap = capLimit(limit, 20, 40);
  const filter = {};

  if (jobSearch) {
    const resolved = await resolveOneJob(jobSearch);
    if (resolved.error || resolved.multipleJobs) return resolved;
    filter.jobId = resolved.job._id;
  }

  if (incompleteOnly === true || incompleteOnly === "true") {
    filter.completionConfirmed = { $ne: true };
  }

  const rows = await InstallationSummary.find(filter)
    .select(
      "jobId installationScheduledDate assignedTeam expectedHours actualHours completionConfirmed completionConfirmedAt completionRemarks customerSignOffDone customerName completionDate updatedAt"
    )
    .sort({ updatedAt: -1 })
    .limit(cap)
    .lean();

  if (!rows.length) {
    // Fall back to Installation activities if no summary docs
    if (jobSearch) {
      const resolved = await resolveOneJob(jobSearch);
      if (resolved.job) {
        const activities = await Installation.find({ jobId: resolved.job._id })
          .select("activityName status plannedDate completedDate expectedHours actualHours")
          .sort({ sequenceOrder: 1 })
          .limit(cap)
          .lean();
        return {
          ...jobLink(resolved.job),
          customer: resolved.job.customer || "",
          summaries: [],
          activities,
          hint: "No InstallationSummary document; showing Installation activities instead.",
        };
      }
    }
    return { total: 0, summaries: [], hint: "No installation summaries found." };
  }

  const jobMap = await loadJobMap(rows.map((r) => r.jobId));
  return {
    total: rows.length,
    summaries: rows.map((r) => {
      const job = jobMap[String(r.jobId)] || null;
      return {
        id: String(r._id),
        installationScheduledDate: r.installationScheduledDate,
        assignedTeam: r.assignedTeam || [],
        expectedHours: r.expectedHours || 0,
        actualHours: r.actualHours || 0,
        completionConfirmed: !!r.completionConfirmed,
        completionConfirmedAt: r.completionConfirmedAt,
        customerSignOffDone: !!r.customerSignOffDone,
        customerName: r.customerName || "",
        completionDate: r.completionDate,
        remarksPreview: String(r.completionRemarks || "").slice(0, 160),
        ...jobLink(job),
        customer: job?.customer || r.customerName || "",
        site: job?.site || "",
      };
    }),
  };
}

// ---------------------------------------------------------------------------
// 8. get_retention_summary
// ---------------------------------------------------------------------------
async function getRetentionSummary({ jobSearch, limit = 30 } = {}) {
  const cap = capLimit(limit);
  const jobFilter = {
    removed: { $ne: true },
    $or: [
      { retentionPercentage: { $gt: 0 } },
      { systemState: { $in: ["Active", "Completed"] } },
    ],
  };

  if (jobSearch) {
    const jobs = await findJobsBySearch(jobSearch, 10);
    if (!jobs.length) return { jobs: [], hint: "No job matched." };
    if (jobs.length > 1 && !jobs.find((j) => String(j.jobId).toLowerCase() === String(jobSearch).toLowerCase())) {
      return {
        multipleJobs: jobs.map((j) => ({ ...jobLink(j), customer: j.customer || "" })),
        hint: "Multiple jobs matched. Ask which.",
      };
    }
    jobFilter._id = { $in: jobs.map((j) => j._id) };
  } else {
    jobFilter.retentionPercentage = { $gt: 0 };
  }

  const jobs = await Job.find(jobFilter)
    .select(
      "_id jobId customer site systemState lockedValue totalInvoiced totalPaid variations retentionPercentage"
    )
    .sort({ updatedAt: -1 })
    .limit(cap)
    .lean();

  const jobIds = jobs.map((j) => j._id);
  const retentionInvoices = await Invoice.find({
    removed: { $ne: true },
    job: { $in: jobIds },
    invoiceType: "Retention",
  })
    .select("number status total amountPaid amountDue job")
    .lean();

  const invByJob = {};
  retentionInvoices.forEach((inv) => {
    const key = String(inv.job);
    if (!invByJob[key]) invByJob[key] = [];
    invByJob[key].push(inv);
  });

  const rows = jobs.map((job) => {
    const contract = revisedContract(job);
    const pct = Number(job.retentionPercentage || 0);
    const retentionHeld = Math.round(((contract * pct) / 100) * 100) / 100;
    const retInvs = invByJob[String(job._id)] || [];
    const retentionInvoiced = retInvs.reduce((s, i) => s + Number(i.total || 0), 0);
    const retentionPaid = retInvs.reduce((s, i) => s + Number(i.amountPaid || 0), 0);
    const retentionDue = retInvs.reduce((s, i) => s + Number(i.amountDue || 0), 0);
    return {
      ...jobLink(job),
      customer: job.customer || "",
      site: job.site || "",
      systemState: job.systemState || "",
      revisedContract: contract,
      retentionPercentage: pct,
      retentionHeldEstimate: retentionHeld,
      retentionInvoiced,
      retentionPaid,
      retentionOutstanding: retentionDue,
      retentionInvoiceCount: retInvs.length,
    };
  });

  const totals = rows.reduce(
    (acc, r) => {
      acc.retentionHeldEstimate += r.retentionHeldEstimate;
      acc.retentionInvoiced += r.retentionInvoiced;
      acc.retentionPaid += r.retentionPaid;
      acc.retentionOutstanding += r.retentionOutstanding;
      return acc;
    },
    {
      retentionHeldEstimate: 0,
      retentionInvoiced: 0,
      retentionPaid: 0,
      retentionOutstanding: 0,
    }
  );

  return {
    summary: {
      jobs: rows.length,
      ...totals,
    },
    jobs: rows,
    hint: "retentionHeldEstimate = revisedContract × retentionPercentage. Outstanding is from Retention-type invoices.",
  };
}

// ---------------------------------------------------------------------------
// 9. list_fabrication_progress_logs
// ---------------------------------------------------------------------------
async function listFabricationProgressLogs({
  jobSearch,
  period = "thisMonth",
  startDate,
  endDate,
  limit = 40,
} = {}) {
  const cap = capLimit(limit, 40, 80);
  const filter = {};
  let periodLabel = "all";

  if (period && period !== "all") {
    const range = periodRange(period, startDate, endDate);
    periodLabel = range.label;
    filter.timestamp = { $gte: range.start, $lte: range.end };
  }

  if (jobSearch) {
    const jobs = await findJobsBySearch(jobSearch, 40);
    if (!jobs.length) return { period: periodLabel, total: 0, logs: [], hint: "No job matched." };
    filter.jobId = { $in: jobs.map((j) => j._id) };
  }

  const [total, rows] = await Promise.all([
    FabricationProgressLog.countDocuments(filter),
    FabricationProgressLog.find(filter)
      .select(
        "fabricationId drawingId jobId oldPercentage newPercentage remarks updatedBy timestamp"
      )
      .sort({ timestamp: -1 })
      .limit(cap)
      .lean(),
  ]);

  const jobMap = await loadJobMap(rows.map((r) => r.jobId));
  const fabIds = [...new Set(rows.map((r) => String(r.fabricationId || "")).filter(Boolean))];
  const fabs = fabIds.length
    ? await Fabrication.find({ _id: { $in: fabIds } }).select("itemName status").lean()
    : [];
  const fabMap = {};
  fabs.forEach((f) => {
    fabMap[String(f._id)] = f;
  });

  return {
    period: periodLabel,
    total,
    logs: rows.map((l) => {
      const job = jobMap[String(l.jobId)] || null;
      const fab = fabMap[String(l.fabricationId)] || null;
      return {
        id: String(l._id),
        itemName: fab?.itemName || "",
        fabStatus: fab?.status || "",
        oldPercentage: l.oldPercentage,
        newPercentage: l.newPercentage,
        delta: Number(l.newPercentage || 0) - Number(l.oldPercentage || 0),
        remarks: l.remarks || "",
        updatedBy: l.updatedBy || "",
        timestamp: l.timestamp,
        ...jobLink(job),
        customer: job?.customer || "",
      };
    }),
  };
}

// ---------------------------------------------------------------------------
const RUNNERS = {
  get_job_timeline: getJobTimeline,
  get_aging_receivables: getAgingReceivables,
  get_worker_utilization: getWorkerUtilization,
  compare_jobs: compareJobs,
  weekly_ops_digest: weeklyOpsDigest,
  list_site_engineer_reviews: listSiteEngineerReviews,
  get_installation_summary: getInstallationSummary,
  get_retention_summary: getRetentionSummary,
  list_fabrication_progress_logs: listFabricationProgressLogs,
};

const PERIOD_ENUM = ["today", "last7Days", "thisWeek", "thisMonth", "lastMonth", "custom", "all"];

const TOOL_DEFINITIONS = [
  {
    type: "function",
    function: {
      name: "get_job_timeline",
      description:
        "Timeline for one job: stage events, comments, SE reviews, fab progress logs. Use for 'what's the history on Metro' / latest activity story.",
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
      name: "get_aging_receivables",
      description:
        "Unpaid invoice aging buckets: current, 1–30, 31–60, 61–90, 90+ days overdue with amounts.",
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
      name: "get_worker_utilization",
      description:
        "Worker utilization: scheduled hours vs attendance hours vs leave for a period. Optional workerName filter.",
      parameters: {
        type: "object",
        properties: {
          period: { type: "string", enum: PERIOD_ENUM },
          startDate: { type: "string" },
          endDate: { type: "string" },
          workerName: { type: "string" },
          limit: { type: "number" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "compare_jobs",
      description:
        "Compare 2–5 jobs side-by-side (stage, completion %, financials). Pass jobSearches as comma-separated nicknames/codes.",
      parameters: {
        type: "object",
        properties: {
          jobSearches: {
            type: "string",
            description: 'e.g. "metro, coastal" or "JB-101, JB-205"',
          },
          limit: { type: "number" },
        },
        required: ["jobSearches"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "weekly_ops_digest",
      description:
        "Morning/ops brief: on-site today, overdue money/materials, open defects, fab under 50%, SE backlog, leave today. Use for 'what's going on today/this week'.",
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
      name: "list_site_engineer_reviews",
      description:
        "List site engineer review records (Pending Review, Approved, Rejected, etc.). Deeper than jobs-awaiting-SE queue.",
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
      name: "get_installation_summary",
      description:
        "Installation summary records (scheduled date, team, hours, completion/sign-off). Optional jobSearch; incompleteOnly for not completed.",
      parameters: {
        type: "object",
        properties: {
          jobSearch: { type: "string" },
          incompleteOnly: { type: "boolean" },
          limit: { type: "number" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_retention_summary",
      description:
        "Retention held vs invoiced/paid by job (retentionPercentage + Retention invoices). Optional jobSearch.",
      parameters: {
        type: "object",
        properties: {
          jobSearch: { type: "string" },
          limit: { type: "number" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_fabrication_progress_logs",
      description:
        "Fabrication progress history logs (old% → new%, who, remarks). Filter by jobSearch and period.",
      parameters: {
        type: "object",
        properties: {
          jobSearch: { type: "string" },
          period: { type: "string", enum: PERIOD_ENUM },
          startDate: { type: "string" },
          endDate: { type: "string" },
          limit: { type: "number" },
        },
      },
    },
  },
];

module.exports = {
  RUNNERS,
  TOOL_DEFINITIONS,
};
