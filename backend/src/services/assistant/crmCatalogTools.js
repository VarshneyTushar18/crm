/**
 * Extra Ask-CRM catalog tools (suppliers, productivity, quotes, HR, finance, ops).
 * Wired into tools.js RUNNERS + TOOL_DEFINITIONS.
 */
const moment = require("moment");
const Supplier = require("../../models/appModels/Supplier");
const Quote = require("../../models/appModels/Quote");
const Leave = require("../../models/appModels/Leave");
const Employee = require("../../models/appModels/Employee");
const Payment = require("../../models/appModels/Payment");
const WorkerTask = require("../../models/appModels/WorkerTask");
const DefectSnag = require("../../models/appModels/DefectSnag");
const MaterialPurchase = require("../../models/appModels/MaterialPurchase");
const Rfq = require("../../models/appModels/Rfq");
const Ncr = require("../../models/appModels/Ncr");
const Qc = require("../../models/appModels/Qc");
const Site = require("../../models/appModels/Site");
const Contact = require("../../models/appModels/Contact");
const Invoice = require("../../models/appModels/Invoice");
const Job = require("../../models/appModels/Job");
const { buildProductivityRollup } = require("../../utils/productivityRollup");

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

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

const capLimit = (limit, def = 30, max = 60) =>
  Math.min(Math.max(Number(limit) || def, 1), max);

const jobLink = (job) => {
  if (!job?._id) return {};
  return { jobMongoId: String(job._id), jobCode: job.jobId || "", url: `/admin/job/${job._id}` };
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
  const unique = [...new Set((ids || []).map((id) => String(id)).filter(Boolean))];
  const map = {};
  if (!unique.length) return map;
  const rows = await Job.find({ _id: { $in: unique } })
    .select("_id jobId customer site")
    .lean();
  rows.forEach((j) => {
    map[String(j._id)] = j;
  });
  return map;
}

// ---------------------------------------------------------------------------
// 1. list_suppliers
// ---------------------------------------------------------------------------
async function listSuppliers({ query, activeOnly, limit = 30 } = {}) {
  const cap = capLimit(limit);
  const filter = {};
  if (activeOnly === true || activeOnly === "true") filter.isActive = true;
  if (activeOnly === false || activeOnly === "false") filter.isActive = false;

  const q = String(query || "").trim();
  if (q) {
    const rx = new RegExp(escapeRegex(q), "i");
    filter.$or = [{ name: rx }, { contactPerson: rx }, { email: rx }, { phone: rx }, { address: rx }];
  }

  const [total, byActive, rows] = await Promise.all([
    Supplier.countDocuments(filter),
    Supplier.aggregate([
      { $match: filter },
      { $group: { _id: "$isActive", count: { $sum: 1 } } },
    ]),
    Supplier.find(filter)
      .select("name contactPerson email phone address isActive notes createdAt")
      .sort({ name: 1 })
      .limit(cap)
      .lean(),
  ]);

  return {
    total,
    byActive: byActive.map((r) => ({
      isActive: r._id !== false,
      count: r.count,
    })),
    suppliers: rows.map((s) => ({
      id: String(s._id),
      name: s.name,
      contactPerson: s.contactPerson || "",
      email: s.email || "",
      phone: s.phone || "",
      address: s.address || "",
      isActive: s.isActive !== false,
      url: `/admin/suppliers`,
    })),
  };
}

// ---------------------------------------------------------------------------
// 2. get_productivity_summary
// ---------------------------------------------------------------------------
async function getProductivitySummary({
  workerName,
  jobSearch,
  jobId,
  period = "thisMonth",
  startDate,
  endDate,
  module,
  limit = 20,
} = {}) {
  const cap = capLimit(limit, 20, 40);
  let rangeStart = startDate;
  let rangeEnd = endDate;
  let periodLabel = "custom";
  if ((!startDate || !endDate) && period && period !== "all") {
    const range = periodRange(period, startDate, endDate);
    rangeStart = range.start.toISOString().slice(0, 10);
    rangeEnd = range.end.toISOString().slice(0, 10);
    periodLabel = range.label;
  } else if (period === "all") {
    rangeStart = undefined;
    rangeEnd = undefined;
    periodLabel = "all";
  } else if (startDate && endDate) {
    periodLabel = `${startDate} to ${endDate}`;
  }

  let resolvedJobId = jobId || null;
  if (!resolvedJobId && jobSearch) {
    const jobs = await findJobsBySearch(jobSearch, 8);
    if (!jobs.length) {
      return {
        period: periodLabel,
        workerName: workerName || null,
        jobSearch,
        summary: { totalHours: 0, byModule: {} },
        byWorker: [],
        byJob: [],
        hint: "No job matched that search. Do not invent hours.",
      };
    }
    if (jobs.length > 1) {
      return {
        period: periodLabel,
        multipleJobs: jobs.map((j) => ({
          ...jobLink(j),
          customer: j.customer || "",
          site: j.site || "",
        })),
        hint: "Multiple jobs matched. Ask which job, or call again with a clearer jobSearch / jobId.",
      };
    }
    resolvedJobId = jobs[0]._id;
  }

  const result = await buildProductivityRollup({
    jobId: resolvedJobId || undefined,
    workerName: workerName || undefined,
    startDate: rangeStart,
    endDate: rangeEnd,
    module: module || undefined,
  });

  return {
    period: periodLabel,
    workerName: workerName || null,
    jobId: resolvedJobId ? String(resolvedJobId) : null,
    summary: result.summary,
    byModule: result.byModule,
    byWorker: (result.byWorker || []).slice(0, cap),
    byJob: (result.byJob || []).slice(0, cap),
    hint:
      Number(result.summary?.totalHours || 0) === 0
        ? "No productivity hours found for these filters."
        : "Use summary.totalHours and top byWorker/byJob rows. Keep the reply short.",
  };
}

// ---------------------------------------------------------------------------
// 3. list_quotes
// ---------------------------------------------------------------------------
async function listQuotes({
  status,
  query,
  period = "all",
  startDate,
  endDate,
  openOnly = false,
  limit = 30,
} = {}) {
  const cap = capLimit(limit);
  const filter = { removed: { $ne: true } };
  const statusRaw = String(status || "").trim();
  const wantOpen = openOnly === true || openOnly === "true" || statusRaw.toLowerCase() === "open";

  if (wantOpen) {
    filter.status = { $in: ["Draft", "Sent"] };
  } else if (statusRaw && statusRaw.toLowerCase() !== "all") {
    const allowed = ["Draft", "Sent", "Accepted", "Rejected"];
    const match = allowed.find((s) => s.toLowerCase() === statusRaw.toLowerCase());
    filter.status = match || statusRaw;
  }

  const q = String(query || "").trim();
  if (q) {
    const rx = new RegExp(escapeRegex(q), "i");
    filter.$or = [
      { quoteNumber: rx },
      { customerName: rx },
      { contactPerson: rx },
      { phone: rx },
      { email: rx },
      { siteAddress: rx },
    ];
  }

  let periodLabel = "all";
  if (period && period !== "all") {
    const range = periodRange(period, startDate, endDate);
    periodLabel = range.label;
    filter.createdAt = { $gte: range.start, $lte: range.end };
  }

  const [total, byStatus, rows] = await Promise.all([
    Quote.countDocuments(filter),
    Quote.aggregate([
      { $match: filter },
      { $group: { _id: "$status", count: { $sum: 1 }, totalAmount: { $sum: "$totalAmount" } } },
      { $sort: { count: -1 } },
    ]),
    Quote.find(filter)
      .select(
        "quoteNumber customerName contactPerson phone status totalAmount validUntil siteAddress createdAt leadId jobId"
      )
      .sort({ createdAt: -1 })
      .limit(cap)
      .lean(),
  ]);

  return {
    period: periodLabel,
    total,
    byStatus: byStatus.map((r) => ({
      status: r._id || "Unknown",
      count: r.count,
      totalAmount: r.totalAmount || 0,
    })),
    quotes: rows.map((qrow) => ({
      id: String(qrow._id),
      quoteNumber: qrow.quoteNumber || "",
      customerName: qrow.customerName,
      contactPerson: qrow.contactPerson || "",
      status: qrow.status,
      totalAmount: qrow.totalAmount,
      validUntil: qrow.validUntil,
      siteAddress: qrow.siteAddress || "",
      createdAt: qrow.createdAt,
      url: `/admin/quotes`,
    })),
  };
}

// ---------------------------------------------------------------------------
// 4. list_leave_requests
// ---------------------------------------------------------------------------
async function listLeaveRequests({
  status,
  employeeName,
  period = "all",
  startDate,
  endDate,
  currentlyOnLeave = false,
  limit = 30,
} = {}) {
  const cap = capLimit(limit);
  const filter = { removed: { $ne: true } };
  const statusRaw = String(status || "").trim();
  if (statusRaw && statusRaw.toLowerCase() !== "all") {
    const allowed = ["Pending", "Approved", "Rejected"];
    const match = allowed.find((s) => s.toLowerCase() === statusRaw.toLowerCase());
    filter.status = match || statusRaw;
  }

  const name = String(employeeName || "").trim();
  if (name) {
    filter.employeeName = new RegExp(escapeRegex(name), "i");
  }

  let periodLabel = "all";
  if (currentlyOnLeave === true || currentlyOnLeave === "true") {
    const today = moment().startOf("day").toDate();
    const todayEnd = moment().endOf("day").toDate();
    filter.status = filter.status || "Approved";
    filter.startDate = { $lte: todayEnd };
    filter.endDate = { $gte: today };
    periodLabel = "currently on leave";
  } else if (period && period !== "all") {
    const range = periodRange(period, startDate, endDate);
    periodLabel = range.label;
    filter.$or = [
      { startDate: { $gte: range.start, $lte: range.end } },
      { endDate: { $gte: range.start, $lte: range.end } },
      {
        startDate: { $lte: range.start },
        endDate: { $gte: range.end },
      },
    ];
  }

  const [total, byStatus, rows] = await Promise.all([
    Leave.countDocuments(filter),
    Leave.aggregate([
      { $match: filter },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    Leave.find(filter)
      .select("employeeName leaveType startDate endDate days reason status reviewedBy createdAt")
      .sort({ startDate: -1 })
      .limit(cap)
      .lean(),
  ]);

  return {
    period: periodLabel,
    total,
    byStatus: byStatus.map((r) => ({ status: r._id || "Unknown", count: r.count })),
    leaves: rows.map((l) => ({
      id: String(l._id),
      employeeName: l.employeeName || "",
      leaveType: l.leaveType,
      startDate: l.startDate,
      endDate: l.endDate,
      days: l.days,
      reason: l.reason || "",
      status: l.status,
      reviewedBy: l.reviewedBy || "",
      url: `/admin/leave`,
    })),
  };
}

// ---------------------------------------------------------------------------
// 5. list_employees
// ---------------------------------------------------------------------------
const parseEmployeeJoinDate = (raw) => {
  const s = String(raw || "").trim();
  if (!s) return null;
  const m = moment(s, ["DD-MM-YYYY", "YYYY-MM-DD", "DD/MM/YYYY"], true);
  return m.isValid() ? m : null;
};

async function listEmployees({
  query,
  status,
  department,
  period = "all",
  startDate,
  endDate,
  recentDays,
  dateField = "createdAt",
  sortBy,
  order,
  limit = 30,
} = {}) {
  const cap = capLimit(limit);
  const filter = {};
  const statusRaw = String(status || "").trim();
  if (statusRaw && statusRaw.toLowerCase() !== "all") {
    const match = ["Active", "Inactive"].find((s) => s.toLowerCase() === statusRaw.toLowerCase());
    filter.status = match || statusRaw;
  } else if (!statusRaw) {
    filter.status = "Active";
  }

  const dept = String(department || "").trim();
  if (dept) filter.department = new RegExp(escapeRegex(dept), "i");

  const q = String(query || "").trim();
  if (q) {
    const rx = new RegExp(escapeRegex(q), "i");
    filter.$or = [
      { name: rx },
      { email: rx },
      { phone: rx },
      { employeeId: rx },
      { designation: rx },
      { department: rx },
    ];
  }

  const field = String(dateField || "createdAt").trim() === "joiningDate" ? "joiningDate" : "createdAt";
  let periodLabel = "all";
  let range = null;
  const recent = Number(recentDays);
  if (Number.isFinite(recent) && recent > 0) {
    const days = Math.min(Math.max(Math.floor(recent), 1), 365);
    range = {
      start: moment().subtract(days - 1, "days").startOf("day").toDate(),
      end: moment().endOf("day").toDate(),
      label: `last ${days} days`,
    };
    periodLabel = range.label;
  } else if (period && period !== "all") {
    range = periodRange(period, startDate, endDate);
    periodLabel = range.label;
  }

  // createdAt can be filtered in Mongo; joiningDate is DD-MM-YYYY string → filter in memory
  if (range && field === "createdAt") {
    filter.createdAt = { $gte: range.start, $lte: range.end };
  }

  const sortFieldRaw = String(sortBy || "").trim();
  const sortField =
    sortFieldRaw === "joiningDate" || sortFieldRaw === "createdAt" || sortFieldRaw === "name"
      ? sortFieldRaw
      : range
        ? field
        : "name";
  const sortDir = String(order || "").toLowerCase() === "asc" ? 1 : range || sortField !== "name" ? -1 : 1;

  const fetchLimit =
    range && field === "joiningDate" ? Math.min(Math.max(cap * 5, 100), 300) : cap;

  const mongoSort =
    sortField === "joiningDate"
      ? { createdAt: sortDir } // provisional; re-sort in memory by parsed joiningDate
      : { [sortField]: sortDir };

  const [totalBeforeJoinFilter, byStatus, byDept, rawRows] = await Promise.all([
    Employee.countDocuments(filter),
    Employee.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    Employee.aggregate([
      { $match: filter.status ? { status: filter.status } : {} },
      { $group: { _id: "$department", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 15 },
    ]),
    Employee.find(filter)
      .select(
        "employeeId name email phone designation department status joiningDate createdAt updatedAt"
      )
      .sort(mongoSort)
      .limit(fetchLimit)
      .lean(),
  ]);

  let rows = rawRows;
  if (range && field === "joiningDate") {
    rows = rawRows.filter((e) => {
      const m = parseEmployeeJoinDate(e.joiningDate);
      if (!m) return false;
      return m.isBetween(moment(range.start), moment(range.end), "day", "[]");
    });
  }

  if (sortField === "joiningDate") {
    rows = [...rows].sort((a, b) => {
      const ma = parseEmployeeJoinDate(a.joiningDate);
      const mb = parseEmployeeJoinDate(b.joiningDate);
      const ta = ma ? ma.valueOf() : 0;
      const tb = mb ? mb.valueOf() : 0;
      return sortDir === 1 ? ta - tb : tb - ta;
    });
  }

  rows = rows.slice(0, cap);
  const total = range && field === "joiningDate" ? rows.length : totalBeforeJoinFilter;

  return {
    period: periodLabel,
    dateField: field,
    sortBy: sortField,
    order: sortDir === 1 ? "asc" : "desc",
    total,
    byStatus: byStatus.map((r) => ({ status: r._id || "Unknown", count: r.count })),
    byDepartment: byDept.map((r) => ({ department: r._id || "Unknown", count: r.count })),
    employees: rows.map((e) => ({
      id: String(e._id),
      employeeId: e.employeeId || "",
      name: e.name,
      email: e.email || "",
      phone: e.phone || "",
      designation: e.designation || "",
      department: e.department || "",
      status: e.status,
      joiningDate: e.joiningDate || "",
      createdAt: e.createdAt || null,
      url: `/admin/employee`,
    })),
    hint:
      range && field === "createdAt"
        ? "Filtered by when the employee record was added (createdAt)."
        : range && field === "joiningDate"
          ? "Filtered by joiningDate (DD-MM-YYYY)."
          : undefined,
  };
}

// ---------------------------------------------------------------------------
// 6. list_payments
// ---------------------------------------------------------------------------
async function listPayments({ period = "thisMonth", startDate, endDate, limit = 30 } = {}) {
  const cap = capLimit(limit);
  const filter = { removed: { $ne: true } };
  let periodLabel = "all";
  if (period && period !== "all") {
    const range = periodRange(period, startDate, endDate);
    periodLabel = range.label;
    filter.date = { $gte: range.start, $lte: range.end };
  }

  const [total, sumAgg, rows] = await Promise.all([
    Payment.countDocuments(filter),
    Payment.aggregate([
      { $match: filter },
      { $group: { _id: null, totalAmount: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]),
    Payment.find(filter)
      .select("number date amount currency ref description invoice created")
      .populate({ path: "invoice", select: "number total status job customer" })
      .sort({ date: -1 })
      .limit(cap)
      .lean(),
  ]);

  const totals = sumAgg[0] || { totalAmount: 0, count: 0 };
  return {
    period: periodLabel,
    totalPayments: totals.count || total,
    totalAmount: totals.totalAmount || 0,
    payments: rows.map((p) => ({
      id: String(p._id),
      number: p.number,
      date: p.date,
      amount: p.amount,
      currency: p.currency || "",
      ref: p.ref || "",
      description: p.description || "",
      invoiceNumber: p.invoice?.number || "",
      invoiceStatus: p.invoice?.status || "",
      url: `/admin/payment`,
    })),
  };
}

// ---------------------------------------------------------------------------
// 7. list_worker_tasks
// ---------------------------------------------------------------------------
async function listWorkerTasks({
  status,
  assigneeName,
  jobSearch,
  openOnly = false,
  limit = 30,
} = {}) {
  const cap = capLimit(limit);
  const filter = {};
  const statusRaw = String(status || "").trim();
  const wantOpen =
    openOnly === true || openOnly === "true" || statusRaw.toLowerCase() === "open";

  if (wantOpen) {
    filter.status = { $in: ["Assigned", "In Progress", "Submitted", "Rejected"] };
  } else if (statusRaw && statusRaw.toLowerCase() !== "all") {
    filter.status = new RegExp(`^${escapeRegex(statusRaw)}$`, "i");
  }

  const name = String(assigneeName || "").trim();
  if (name) {
    filter.assigneeName = new RegExp(escapeRegex(name), "i");
  }

  if (jobSearch) {
    const { jobIds, jobs } = await resolveJobIds(jobSearch);
    if (!jobIds?.length) {
      return { total: 0, tasks: [], hint: "No job matched that search." };
    }
    filter.jobId = { $in: jobIds };
  }

  const [total, byStatus, rows] = await Promise.all([
    WorkerTask.countDocuments(filter),
    WorkerTask.aggregate([
      { $match: filter },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    WorkerTask.find(filter)
      .select(
        "title status priority assigneeName assigneeWorkerId jobId siteZone location reviewStatus createdAt startedAt completedAt"
      )
      .sort({ priority: 1, createdAt: -1 })
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
        assigneeName: t.assigneeName || "",
        assigneeWorkerId: t.assigneeWorkerId || "",
        reviewStatus: t.reviewStatus || "",
        siteZone: t.siteZone || "",
        location: t.location || "",
        ...jobLink(job),
        customer: job?.customer || "",
        url: `/admin/worker-tasks`,
      };
    }),
  };
}

// ---------------------------------------------------------------------------
// 8. list_defects_snags
// ---------------------------------------------------------------------------
async function listDefectsSnags({ status, type, jobSearch, openOnly = true, limit = 30 } = {}) {
  const cap = capLimit(limit);
  const filter = {};
  const statusRaw = String(status || "").trim();
  const wantOpen =
    openOnly === true || openOnly === "true" || statusRaw.toLowerCase() === "open";

  if (wantOpen && !statusRaw) {
    filter.status = { $in: ["Open", "In Progress"] };
  } else if (statusRaw && statusRaw.toLowerCase() !== "all") {
    const allowed = ["Open", "In Progress", "Closed"];
    const match = allowed.find((s) => s.toLowerCase() === statusRaw.toLowerCase());
    filter.status = match || statusRaw;
  }

  const typeRaw = String(type || "").trim();
  if (typeRaw && typeRaw.toLowerCase() !== "all") {
    const match = ["Defect", "Snag"].find((s) => s.toLowerCase() === typeRaw.toLowerCase());
    filter.type = match || typeRaw;
  }

  if (jobSearch) {
    const { jobIds } = await resolveJobIds(jobSearch);
    if (!jobIds?.length) return { total: 0, items: [], hint: "No job matched." };
    filter.jobId = { $in: jobIds };
  }

  const [total, byStatus, rows] = await Promise.all([
    DefectSnag.countDocuments(filter),
    DefectSnag.aggregate([
      { $match: filter },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    DefectSnag.find(filter)
      .select("type title status owner dueDate locationArea jobId createdAt")
      .sort({ createdAt: -1 })
      .limit(cap)
      .lean(),
  ]);

  const jobMap = await loadJobMap(rows.map((r) => r.jobId));
  return {
    total,
    byStatus: byStatus.map((r) => ({ status: r._id || "Unknown", count: r.count })),
    items: rows.map((d) => {
      const job = jobMap[String(d.jobId)] || null;
      return {
        id: String(d._id),
        type: d.type,
        title: d.title,
        status: d.status,
        owner: d.owner || "",
        dueDate: d.dueDate || "",
        locationArea: d.locationArea || "",
        ...jobLink(job),
        customer: job?.customer || "",
        url: `/admin/defects-snags`,
      };
    }),
  };
}

// ---------------------------------------------------------------------------
// 9. list_material_purchases
// ---------------------------------------------------------------------------
async function listMaterialPurchases({
  status,
  jobSearch,
  delayedOnly = false,
  limit = 30,
} = {}) {
  const cap = capLimit(limit);
  const filter = {};
  const statusRaw = String(status || "").trim();

  if (delayedOnly === true || delayedOnly === "true" || statusRaw.toLowerCase() === "delayed") {
    filter.status = "Delayed";
  } else if (statusRaw && statusRaw.toLowerCase() !== "all") {
    if (statusRaw.toLowerCase() === "open") {
      filter.status = { $in: ["Pending", "Ordered", "Delayed", "Partially Received"] };
    } else {
      filter.status = new RegExp(`^${escapeRegex(statusRaw)}$`, "i");
    }
  }

  if (jobSearch) {
    const { jobIds } = await resolveJobIds(jobSearch);
    if (!jobIds?.length) return { total: 0, items: [], hint: "No job matched." };
    filter.jobId = { $in: jobIds };
  }

  const [total, byStatus, rows] = await Promise.all([
    MaterialPurchase.countDocuments(filter),
    MaterialPurchase.aggregate([
      { $match: filter },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    MaterialPurchase.find(filter)
      .select("itemName category status supplier requiredQty orderedQty receivedQty expectedDelivery jobId")
      .sort({ updatedAt: -1 })
      .limit(cap)
      .lean(),
  ]);

  const jobMap = await loadJobMap(rows.map((r) => r.jobId));
  return {
    total,
    byStatus: byStatus.map((r) => ({ status: r._id || "Unknown", count: r.count })),
    items: rows.map((m) => {
      const job = jobMap[String(m.jobId)] || null;
      return {
        id: String(m._id),
        itemName: m.itemName,
        category: m.category || "",
        status: m.status,
        supplier: m.supplier || "",
        requiredQty: m.requiredQty,
        orderedQty: m.orderedQty,
        receivedQty: m.receivedQty,
        expectedDelivery: m.expectedDelivery || "",
        ...jobLink(job),
        customer: job?.customer || "",
        url: `/admin/material-purchase`,
      };
    }),
  };
}

// ---------------------------------------------------------------------------
// 10. list_rfqs
// ---------------------------------------------------------------------------
async function listRfqs({ status, jobSearch, period = "all", startDate, endDate, limit = 30 } = {}) {
  const cap = capLimit(limit);
  const filter = {};
  const statusRaw = String(status || "").trim();
  if (statusRaw && statusRaw.toLowerCase() !== "all") {
    if (statusRaw.toLowerCase() === "open") {
      filter.status = { $in: ["Draft", "Sent", "Responses Received"] };
    } else {
      filter.status = new RegExp(`^${escapeRegex(statusRaw)}$`, "i");
    }
  }

  if (jobSearch) {
    const { jobIds } = await resolveJobIds(jobSearch);
    if (!jobIds?.length) return { total: 0, rfqs: [], hint: "No job matched." };
    filter.jobId = { $in: jobIds };
  }

  let periodLabel = "all";
  if (period && period !== "all") {
    const range = periodRange(period, startDate, endDate);
    periodLabel = range.label;
    filter.createdAt = { $gte: range.start, $lte: range.end };
  }

  const [total, byStatus, rows] = await Promise.all([
    Rfq.countDocuments(filter),
    Rfq.aggregate([
      { $match: filter },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    Rfq.find(filter)
      .select("rfqNumber title status sentAt jobId items vendorQuotes createdAt")
      .sort({ createdAt: -1 })
      .limit(cap)
      .lean(),
  ]);

  const jobMap = await loadJobMap(rows.map((r) => r.jobId));
  return {
    period: periodLabel,
    total,
    byStatus: byStatus.map((r) => ({ status: r._id || "Unknown", count: r.count })),
    rfqs: rows.map((r) => {
      const job = jobMap[String(r.jobId)] || null;
      return {
        id: String(r._id),
        rfqNumber: r.rfqNumber || "",
        title: r.title || "",
        status: r.status,
        itemCount: (r.items || []).length,
        vendorQuoteCount: (r.vendorQuotes || []).length,
        sentAt: r.sentAt,
        ...jobLink(job),
        customer: job?.customer || "",
        url: `/admin/rfq`,
      };
    }),
  };
}

// ---------------------------------------------------------------------------
// 11. list_ncrs
// ---------------------------------------------------------------------------
async function listNcrs({ status, jobSearch, openOnly = true, limit = 30 } = {}) {
  const cap = capLimit(limit);
  const filter = {};
  const statusRaw = String(status || "").trim();
  const wantOpen =
    openOnly === true || openOnly === "true" || statusRaw.toLowerCase() === "open";

  if (wantOpen && !statusRaw) {
    filter.status = { $in: ["Open", "In Progress"] };
  } else if (statusRaw && statusRaw.toLowerCase() !== "all") {
    filter.status = new RegExp(`^${escapeRegex(statusRaw)}$`, "i");
  }

  if (jobSearch) {
    const { jobIds } = await resolveJobIds(jobSearch);
    if (!jobIds?.length) return { total: 0, ncrs: [], hint: "No job matched." };
    filter.jobId = { $in: jobIds };
  }

  const [total, byStatus, rows] = await Promise.all([
    Ncr.countDocuments(filter),
    Ncr.aggregate([
      { $match: filter },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    Ncr.find(filter)
      .select(
        "ncrNumber title status assignedTo dueDate reinspectionStatus reinspectionRequired jobId createdAt"
      )
      .sort({ createdAt: -1 })
      .limit(cap)
      .lean(),
  ]);

  const jobMap = await loadJobMap(rows.map((r) => r.jobId));
  return {
    total,
    byStatus: byStatus.map((r) => ({ status: r._id || "Unknown", count: r.count })),
    ncrs: rows.map((n) => {
      const job = jobMap[String(n.jobId)] || null;
      return {
        id: String(n._id),
        ncrNumber: n.ncrNumber,
        title: n.title,
        status: n.status,
        assignedTo: n.assignedTo || "",
        dueDate: n.dueDate || "",
        reinspectionStatus: n.reinspectionStatus || "",
        reinspectionRequired: !!n.reinspectionRequired,
        ...jobLink(job),
        customer: job?.customer || "",
        url: `/admin/qc`,
      };
    }),
  };
}

// ---------------------------------------------------------------------------
// 12. list_qc_pending
// ---------------------------------------------------------------------------
async function listQcPending({ status = "Pending", jobSearch, limit = 30 } = {}) {
  const cap = capLimit(limit);
  const filter = {};
  const statusRaw = String(status || "Pending").trim();
  if (statusRaw.toLowerCase() === "pending" || statusRaw.toLowerCase() === "open") {
    filter.status = { $in: ["Pending", "Rework"] };
  } else if (statusRaw.toLowerCase() !== "all") {
    filter.status = new RegExp(`^${escapeRegex(statusRaw)}$`, "i");
  }

  if (jobSearch) {
    const { jobIds } = await resolveJobIds(jobSearch);
    if (!jobIds?.length) return { total: 0, items: [], hint: "No job matched." };
    filter.jobId = { $in: jobIds };
  }

  const [total, byStatus, rows] = await Promise.all([
    Qc.countDocuments(filter),
    Qc.aggregate([
      { $match: filter },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    Qc.find(filter)
      .select("itemName status inspectionType checkedBy checkedDate workflowStageKey jobId createdAt")
      .sort({ createdAt: -1 })
      .limit(cap)
      .lean(),
  ]);

  const jobMap = await loadJobMap(rows.map((r) => r.jobId));
  return {
    total,
    byStatus: byStatus.map((r) => ({ status: r._id || "Unknown", count: r.count })),
    items: rows.map((q) => {
      const job = jobMap[String(q.jobId)] || null;
      return {
        id: String(q._id),
        itemName: q.itemName,
        status: q.status,
        inspectionType: q.inspectionType || "",
        workflowStageKey: q.workflowStageKey || "",
        checkedBy: q.checkedBy || "",
        checkedDate: q.checkedDate || "",
        ...jobLink(job),
        customer: job?.customer || "",
        url: `/admin/qc`,
      };
    }),
  };
}

// ---------------------------------------------------------------------------
// 13. list_sites
// ---------------------------------------------------------------------------
async function listSites({ query, activeOnly = true, limit = 30 } = {}) {
  const cap = capLimit(limit);
  const filter = {};
  if (activeOnly === true || activeOnly === "true") filter.isActive = true;
  if (activeOnly === false || activeOnly === "false") filter.isActive = false;

  const q = String(query || "").trim();
  if (q) {
    const rx = new RegExp(escapeRegex(q), "i");
    filter.$or = [{ name: rx }, { code: rx }, { city: rx }, { address: rx }];
  }

  const [total, rows] = await Promise.all([
    Site.countDocuments(filter),
    Site.find(filter)
      .select("name code city address isActive notes createdAt")
      .sort({ name: 1 })
      .limit(cap)
      .lean(),
  ]);

  return {
    total,
    sites: rows.map((s) => ({
      id: String(s._id),
      name: s.name,
      code: s.code || "",
      city: s.city || "",
      address: s.address || "",
      isActive: s.isActive !== false,
      url: `/admin/sites`,
    })),
  };
}

// ---------------------------------------------------------------------------
// 14. list_contact_requests
// ---------------------------------------------------------------------------
async function listContactRequests({
  status,
  period = "all",
  startDate,
  endDate,
  openOnly = true,
  limit = 30,
} = {}) {
  const cap = capLimit(limit);
  const filter = {};
  const statusRaw = String(status || "").trim();
  const wantOpen =
    openOnly === true || openOnly === "true" || statusRaw.toLowerCase() === "open";

  if (wantOpen && !statusRaw) {
    filter.status = { $in: ["Open", "In Progress"] };
  } else if (statusRaw && statusRaw.toLowerCase() !== "all") {
    filter.status = new RegExp(`^${escapeRegex(statusRaw)}$`, "i");
  }

  let periodLabel = "all";
  if (period && period !== "all") {
    const range = periodRange(period, startDate, endDate);
    periodLabel = range.label;
    filter.createdAt = { $gte: range.start, $lte: range.end };
  }

  const [total, byStatus, rows] = await Promise.all([
    Contact.countDocuments(filter),
    Contact.aggregate([
      { $match: filter },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    Contact.find(filter)
      .select("subject priority status message customerId projectId createdAt respondedAt")
      .populate({ path: "customerId", select: "name companyName email phone" })
      .sort({ createdAt: -1 })
      .limit(cap)
      .lean(),
  ]);

  return {
    period: periodLabel,
    total,
    byStatus: byStatus.map((r) => ({ status: r._id || "Unknown", count: r.count })),
    contacts: rows.map((c) => ({
      id: String(c._id),
      subject: c.subject,
      priority: c.priority,
      status: c.status,
      messagePreview: String(c.message || "").slice(0, 160),
      customerName: c.customerId?.name || c.customerId?.companyName || "",
      customerEmail: c.customerId?.email || "",
      createdAt: c.createdAt,
      respondedAt: c.respondedAt || null,
      url: `/admin/contact-requests`,
    })),
  };
}

// ---------------------------------------------------------------------------
// 15. get_invoice_summary
// ---------------------------------------------------------------------------
async function getInvoiceSummary({
  period = "thisMonth",
  startDate,
  endDate,
  status,
  limit = 20,
} = {}) {
  const cap = capLimit(limit, 20, 40);
  const filter = { removed: { $ne: true } };
  let periodLabel = "all";
  if (period && period !== "all") {
    const range = periodRange(period, startDate, endDate);
    periodLabel = range.label;
    filter.date = { $gte: range.start, $lte: range.end };
  }

  const statusRaw = String(status || "").trim();
  if (statusRaw && statusRaw.toLowerCase() !== "all") {
    if (statusRaw.toLowerCase() === "overdue") {
      filter.$or = [{ status: "Overdue" }, { isOverdue: true }];
    } else if (statusRaw.toLowerCase() === "unpaid" || statusRaw.toLowerCase() === "outstanding") {
      filter.status = { $in: ["Issued", "Partially Paid", "Overdue"] };
      filter.amountDue = { $gt: 0 };
    } else {
      filter.status = new RegExp(`^${escapeRegex(statusRaw)}$`, "i");
    }
  }

  const [byStatus, totals, rows] = await Promise.all([
    Invoice.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          total: { $sum: "$total" },
          amountPaid: { $sum: "$amountPaid" },
          amountDue: { $sum: "$amountDue" },
        },
      },
      { $sort: { count: -1 } },
    ]),
    Invoice.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          total: { $sum: "$total" },
          amountPaid: { $sum: "$amountPaid" },
          amountDue: { $sum: "$amountDue" },
        },
      },
    ]),
    Invoice.find(filter)
      .select("number status total amountPaid amountDue date expiredDate isOverdue currency job")
      .populate({ path: "job", select: "_id jobId customer" })
      .sort({ date: -1 })
      .limit(cap)
      .lean(),
  ]);

  const t = totals[0] || { count: 0, total: 0, amountPaid: 0, amountDue: 0 };
  return {
    period: periodLabel,
    summary: {
      count: t.count,
      total: t.total,
      amountPaid: t.amountPaid,
      amountDue: t.amountDue,
    },
    byStatus: byStatus.map((r) => ({
      status: r._id || "Unknown",
      count: r.count,
      total: r.total,
      amountPaid: r.amountPaid,
      amountDue: r.amountDue,
    })),
    invoices: rows.map((inv) => ({
      number: inv.number,
      status: inv.status,
      total: inv.total,
      amountPaid: inv.amountPaid,
      amountDue: inv.amountDue,
      isOverdue: !!inv.isOverdue,
      date: inv.date,
      expiredDate: inv.expiredDate,
      currency: inv.currency || "",
      ...jobLink(inv.job),
      customer: inv.job?.customer || "",
      url: `/admin/invoice`,
    })),
  };
}

// ---------------------------------------------------------------------------
// 16. list_powder_coating
// ---------------------------------------------------------------------------
async function listPowderCoating({ status, limit = 30 } = {}) {
  const cap = capLimit(limit);
  const jobs = await Job.find({
    systemState: { $in: ["New", "Active"] },
    "workflowEvents.powderCoating": { $exists: true },
  })
    .select("_id jobId customer site systemState workflowEvents.powderCoating")
    .lean();

  const statusRaw = String(status || "").trim().toLowerCase();
  const mapped = jobs
    .map((j) => {
      const stage = j.workflowEvents?.powderCoating || {};
      const stageStatus = stage.stageStatus || (stage.isCompleted ? "Complete" : "Pending");
      return {
        ...jobLink(j),
        customer: j.customer || "",
        site: j.site || "",
        systemState: j.systemState || "",
        stageStatus,
        isCompleted: !!stage.isCompleted,
        batchRef: stage.batchRef || "",
        startActual: stage.startActual || null,
        completionActual: stage.completionActual || null,
      };
    })
    .filter((row) => {
      if (!statusRaw || statusRaw === "all") {
        return !row.isCompleted && row.stageStatus !== "Complete";
      }
      if (statusRaw === "pending" || statusRaw === "open") {
        return !row.isCompleted && ["Pending", "Not Started", ""].includes(row.stageStatus);
      }
      if (statusRaw === "in progress" || statusRaw === "inprogress") {
        return row.stageStatus === "In Progress";
      }
      if (statusRaw === "complete" || statusRaw === "completed") {
        return row.isCompleted || row.stageStatus === "Complete";
      }
      return String(row.stageStatus).toLowerCase() === statusRaw;
    })
    .slice(0, cap);

  return {
    total: mapped.length,
    jobs: mapped,
    hint:
      mapped.length === 0
        ? "No powder coating jobs matched."
        : "List job codes as markdown links using url. Default shows incomplete powder coating stages.",
  };
}

// ---------------------------------------------------------------------------
const RUNNERS = {
  list_suppliers: listSuppliers,
  get_productivity_summary: getProductivitySummary,
  list_quotes: listQuotes,
  list_leave_requests: listLeaveRequests,
  list_employees: listEmployees,
  list_payments: listPayments,
  list_worker_tasks: listWorkerTasks,
  list_defects_snags: listDefectsSnags,
  list_material_purchases: listMaterialPurchases,
  list_rfqs: listRfqs,
  list_ncrs: listNcrs,
  list_qc_pending: listQcPending,
  list_sites: listSites,
  list_contact_requests: listContactRequests,
  get_invoice_summary: getInvoiceSummary,
  list_powder_coating: listPowderCoating,
};

const PERIOD_ENUM = ["today", "last7Days", "thisWeek", "thisMonth", "lastMonth", "custom", "all"];

const TOOL_DEFINITIONS = [
  {
    type: "function",
    function: {
      name: "list_suppliers",
      description:
        "Count and list CRM suppliers. Use for how many suppliers, active suppliers, or search by name/contact/email/phone.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Optional name/contact/email/phone search" },
          activeOnly: { type: "boolean", description: "If true, only active suppliers" },
          limit: { type: "number" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_productivity_summary",
      description:
        "Productivity / hours rollup by worker, job, and module (fabrication, installation, attendance). Use for 'productivity of X', 'hours this month', 'hours on coastal job'.",
      parameters: {
        type: "object",
        properties: {
          workerName: { type: "string" },
          jobSearch: { type: "string", description: "Job nickname / code / customer" },
          jobId: { type: "string", description: "Mongo job id if known" },
          period: { type: "string", enum: PERIOD_ENUM },
          startDate: { type: "string" },
          endDate: { type: "string" },
          module: {
            type: "string",
            description: "Optional: fabrication, installation, attendance",
          },
          limit: { type: "number" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_quotes",
      description:
        "Count and list sales quotes. Use for open quotes, quote status, totals, or search by customer/quote number.",
      parameters: {
        type: "object",
        properties: {
          status: {
            type: "string",
            description: "Draft, Sent, Accepted, Rejected, open, or all",
          },
          openOnly: { type: "boolean" },
          query: { type: "string" },
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
      name: "list_leave_requests",
      description:
        "List leave requests. Use for pending approvals, who is on leave today, or leave for an employee.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", description: "Pending, Approved, Rejected, or all" },
          employeeName: { type: "string" },
          currentlyOnLeave: {
            type: "boolean",
            description: "If true, approved leave covering today",
          },
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
      name: "list_employees",
      description:
        "List/count employees. Use for roster, EMP lookup, latest/new hires. For 'new in last N days' set recentDays (e.g. 5) — defaults to createdAt (record added). Use dateField=joiningDate for join-date filter. sortBy createdAt/joiningDate for latest.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Name, EMP id, email, phone, designation" },
          status: { type: "string", description: "Active (default), Inactive, or all" },
          department: { type: "string" },
          period: {
            type: "string",
            enum: PERIOD_ENUM,
            description: "Optional date window; or use recentDays",
          },
          startDate: { type: "string" },
          endDate: { type: "string" },
          recentDays: {
            type: "number",
            description: "e.g. 5 = last 5 days including today",
          },
          dateField: {
            type: "string",
            enum: ["createdAt", "joiningDate"],
            description: "createdAt = when added to CRM (default for new); joiningDate = join date",
          },
          sortBy: {
            type: "string",
            enum: ["name", "createdAt", "joiningDate"],
          },
          order: { type: "string", enum: ["asc", "desc"] },
          limit: { type: "number" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_payments",
      description:
        "List payments received (amount, date, invoice). Use for payments this month / today / period totals.",
      parameters: {
        type: "object",
        properties: {
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
      name: "list_worker_tasks",
      description:
        "List worker tasks from Task Management. Use for pending tasks, tasks for a worker, or tasks on a job.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string" },
          openOnly: { type: "boolean" },
          assigneeName: { type: "string" },
          jobSearch: { type: "string" },
          limit: { type: "number" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_defects_snags",
      description:
        "List defects and snags. Use for open snags, defects on a job, or defect counts.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", description: "Open, In Progress, Closed, open, all" },
          type: { type: "string", description: "Defect, Snag, or all" },
          openOnly: { type: "boolean", description: "Defaults true" },
          jobSearch: { type: "string" },
          limit: { type: "number" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_material_purchases",
      description:
        "List material purchase lines. Use for delayed materials, materials for a job, open material orders.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string" },
          delayedOnly: { type: "boolean" },
          jobSearch: { type: "string" },
          limit: { type: "number" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_rfqs",
      description: "List RFQs (request for quotes). Use for open RFQs, RFQ status, RFQs for a job.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string" },
          jobSearch: { type: "string" },
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
      name: "list_ncrs",
      description: "List NCRs (non-conformance reports). Use for open NCRs or NCRs on a job.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string" },
          openOnly: { type: "boolean" },
          jobSearch: { type: "string" },
          limit: { type: "number" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_qc_pending",
      description:
        "List QC inspection items pending/rework. Use for jobs waiting on QC or QC backlog.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", description: "Pending (default), Pass, Fail, Rework, all" },
          jobSearch: { type: "string" },
          limit: { type: "number" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_sites",
      description: "Count and list sites. Use for how many sites or find a site by name/city/code.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          activeOnly: { type: "boolean" },
          limit: { type: "number" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_contact_requests",
      description:
        "List customer contact requests (inbound messages). Use for open contact requests or recent requests.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string" },
          openOnly: { type: "boolean" },
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
      name: "get_invoice_summary",
      description:
        "Invoice totals by status (paid, overdue, outstanding) for a period. Broader than list_pending_invoices.",
      parameters: {
        type: "object",
        properties: {
          period: { type: "string", enum: PERIOD_ENUM },
          startDate: { type: "string" },
          endDate: { type: "string" },
          status: {
            type: "string",
            description: "Draft, Issued, Partially Paid, Paid, Overdue, unpaid, outstanding, all",
          },
          limit: { type: "number" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_powder_coating",
      description:
        "List jobs in powder coating stage (pending / in progress / complete). Use for powder coating queue.",
      parameters: {
        type: "object",
        properties: {
          status: {
            type: "string",
            description: "pending, in progress, complete, or all (default: incomplete)",
          },
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
