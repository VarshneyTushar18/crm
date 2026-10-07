/**
 * Ask-CRM finance + sales read tools (no write/action tools).
 * Wired into tools.js RUNNERS + TOOL_DEFINITIONS.
 */
const moment = require("moment");
const Invoice = require("../../models/appModels/Invoice");
const Payment = require("../../models/appModels/Payment");
const Quote = require("../../models/appModels/Quote");
const Lead = require("../../models/appModels/Lead");
const Supplier = require("../../models/appModels/Supplier");
const PurchaseOrder = require("../../models/appModels/PurchaseOrder");
const Rfq = require("../../models/appModels/Rfq");
const Job = require("../../models/appModels/Job");
const Client = require("../../models/appModels/Client");
const {
  fetchInvoicesForExport,
  buildInvoicesExportDownloadUrl,
  fetchPaymentsForExport,
  buildPaymentsExportDownloadUrl,
  fetchAttendanceForExport,
  buildAttendanceExportDownloadUrl,
  stampFilename,
  INVOICE_EXPORT_HEADERS,
  PAYMENT_EXPORT_HEADERS,
  ATTENDANCE_EXPORT_HEADERS,
} = require("./financeSalesExcelExport");

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
  if (p === "thisQuarter" || p === "quarter") {
    return {
      start: moment().startOf("quarter").toDate(),
      end: moment().endOf("quarter").toDate(),
      label: `Q${moment().quarter()} ${moment().year()}`,
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
      "_id jobId customer site systemState lockedValue totalInvoiced totalPaid variations retentionPercentage"
    )
    .limit(limit)
    .lean();
}

async function resolveJobIds(jobSearch) {
  const q = String(jobSearch || "").trim();
  if (!q) return { jobIds: null, jobs: [] };
  const jobs = await findJobsBySearch(q, 40);
  return { jobIds: jobs.map((j) => j._id), jobs };
}

// ---------------------------------------------------------------------------
// get_job_financials
// ---------------------------------------------------------------------------
async function getJobFinancials({ jobSearch, limit = 15 } = {}) {
  const cap = capLimit(limit, 15, 30);
  const q = String(jobSearch || "").trim();
  if (!q) {
    return { error: "jobSearch is required (job code or customer/site nickname)." };
  }

  const jobs = await findJobsBySearch(q, 10);
  if (!jobs.length) {
    return { jobs: [], hint: "No job matched. Try a shorter keyword or job code." };
  }
  if (jobs.length > 1) {
    return {
      multipleJobs: jobs.map((j) => ({
        ...jobLink(j),
        customer: j.customer || "",
        site: j.site || "",
        lockedValue: Number(j.lockedValue || 0),
        totalInvoiced: Number(j.totalInvoiced || 0),
        totalPaid: Number(j.totalPaid || 0),
      })),
      hint: "Multiple jobs matched. Ask which job code, then call again.",
    };
  }

  const job = jobs[0];
  const lockedValue = Number(job.lockedValue || 0);
  const variations = Array.isArray(job.variations) ? job.variations : [];
  const approvedVariations = variations
    .filter((v) => v.status === "Approved")
    .reduce((s, v) => s + Number(v.amount || 0), 0);
  const revisedContract = lockedValue + approvedVariations;
  const totalInvoiced = Number(job.totalInvoiced || 0);
  const totalPaid = Number(job.totalPaid || 0);
  const outstanding = Math.max(revisedContract - totalPaid, 0);
  const unbilled = Math.max(revisedContract - totalInvoiced, 0);

  const invoices = await Invoice.find({
    removed: { $ne: true },
    job: job._id,
  })
    .select(
      "number status total amountPaid amountDue date expiredDate invoiceType isOverdue currency"
    )
    .sort({ date: -1 })
    .limit(cap)
    .lean();

  return {
    ...jobLink(job),
    customer: job.customer || "",
    site: job.site || "",
    systemState: job.systemState || "",
    financials: {
      lockedValue,
      approvedVariations,
      revisedContract,
      totalInvoiced,
      totalPaid,
      amountDueOnInvoices: invoices.reduce((s, i) => s + Number(i.amountDue || 0), 0),
      outstandingVsContract: outstanding,
      unbilledVsContract: unbilled,
      retentionPercentage: Number(job.retentionPercentage || 0),
    },
    invoices: invoices.map((inv) => ({
      number: inv.number,
      status: inv.status,
      invoiceType: inv.invoiceType,
      total: inv.total,
      amountPaid: inv.amountPaid,
      amountDue: inv.amountDue,
      isOverdue: !!inv.isOverdue,
      date: inv.date,
      expiredDate: inv.expiredDate,
      currency: inv.currency || "",
      url: `/admin/invoice`,
    })),
    hint: "Use financials.revisedContract / totalInvoiced / totalPaid / unbilledVsContract. Link the job with url.",
  };
}

// ---------------------------------------------------------------------------
// list_invoices
// ---------------------------------------------------------------------------
async function listInvoices({
  status,
  period = "thisMonth",
  startDate,
  endDate,
  jobSearch,
  invoiceType,
  limit = 30,
} = {}) {
  const cap = capLimit(limit);
  const filter = { removed: { $ne: true } };

  let periodLabel = "all";
  if (period && period !== "all") {
    const range = periodRange(period, startDate, endDate);
    periodLabel = range.label;
    filter.date = { $gte: range.start, $lte: range.end };
  }

  const statusRaw = String(status || "").trim();
  if (statusRaw && statusRaw.toLowerCase() !== "all") {
    const lower = statusRaw.toLowerCase();
    if (lower === "overdue") {
      filter.$or = [{ status: "Overdue" }, { isOverdue: true }];
    } else if (lower === "unpaid" || lower === "outstanding" || lower === "pending") {
      filter.status = { $in: ["Draft", "Issued", "Partially Paid", "Overdue"] };
      filter.amountDue = { $gt: 0 };
    } else if (lower === "paid") {
      filter.status = "Paid";
    } else {
      filter.status = new RegExp(`^${escapeRegex(statusRaw)}$`, "i");
    }
  }

  const typeRaw = String(invoiceType || "").trim();
  if (typeRaw && typeRaw.toLowerCase() !== "all") {
    filter.invoiceType = new RegExp(`^${escapeRegex(typeRaw)}$`, "i");
  }

  if (jobSearch) {
    const { jobIds } = await resolveJobIds(jobSearch);
    if (!jobIds?.length) {
      return { period: periodLabel, total: 0, invoices: [], hint: "No job matched." };
    }
    filter.job = { $in: jobIds };
  }

  const [total, byStatus, rows] = await Promise.all([
    Invoice.countDocuments(filter),
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
    Invoice.find(filter)
      .select(
        "number status total amountPaid amountDue date expiredDate invoiceType isOverdue currency job"
      )
      .populate({ path: "job", select: "_id jobId customer site" })
      .sort({ date: -1 })
      .limit(cap)
      .lean(),
  ]);

  return {
    period: periodLabel,
    total,
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
      invoiceType: inv.invoiceType,
      total: inv.total,
      amountPaid: inv.amountPaid,
      amountDue: inv.amountDue,
      isOverdue: !!inv.isOverdue,
      date: inv.date,
      expiredDate: inv.expiredDate,
      currency: inv.currency || "",
      ...jobLink(inv.job),
      customer: inv.job?.customer || "",
      site: inv.job?.site || "",
      url: `/admin/invoice`,
    })),
    hint: "Broader than list_pending_invoices / get_invoice_summary — use for any invoice list by period/status/job.",
  };
}

// ---------------------------------------------------------------------------
// get_quote_summary
// ---------------------------------------------------------------------------
async function getQuoteSummary({
  period = "thisMonth",
  startDate,
  endDate,
  limit = 15,
} = {}) {
  const cap = capLimit(limit, 15, 30);
  const filter = { removed: { $ne: true } };
  let periodLabel = "all";
  if (period && period !== "all") {
    const range = periodRange(period, startDate, endDate);
    periodLabel = range.label;
    filter.createdAt = { $gte: range.start, $lte: range.end };
  }

  const [byStatus, totals, recent] = await Promise.all([
    Quote.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalAmount: { $sum: "$totalAmount" },
        },
      },
      { $sort: { count: -1 } },
    ]),
    Quote.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          totalAmount: { $sum: "$totalAmount" },
        },
      },
    ]),
    Quote.find(filter)
      .select("quoteNumber customerName status totalAmount createdAt validUntil")
      .sort({ createdAt: -1 })
      .limit(cap)
      .lean(),
  ]);

  const t = totals[0] || { count: 0, totalAmount: 0 };
  const statusMap = {};
  byStatus.forEach((r) => {
    statusMap[r._id || "Unknown"] = {
      count: r.count,
      totalAmount: r.totalAmount || 0,
    };
  });

  return {
    period: periodLabel,
    summary: {
      count: t.count,
      totalAmount: t.totalAmount,
      draft: statusMap.Draft || { count: 0, totalAmount: 0 },
      sent: statusMap.Sent || { count: 0, totalAmount: 0 },
      accepted: statusMap.Accepted || { count: 0, totalAmount: 0 },
      rejected: statusMap.Rejected || { count: 0, totalAmount: 0 },
    },
    byStatus: byStatus.map((r) => ({
      status: r._id || "Unknown",
      count: r.count,
      totalAmount: r.totalAmount || 0,
    })),
    recentQuotes: recent.map((q) => ({
      quoteNumber: q.quoteNumber || "",
      customerName: q.customerName,
      status: q.status,
      totalAmount: q.totalAmount,
      createdAt: q.createdAt,
      validUntil: q.validUntil,
      url: `/admin/quote`,
    })),
  };
}

// ---------------------------------------------------------------------------
// get_sales_pipeline_summary
// ---------------------------------------------------------------------------
async function getSalesPipelineSummary({
  period = "thisMonth",
  startDate,
  endDate,
} = {}) {
  const filterLead = {};
  const filterQuote = { removed: { $ne: true } };
  let periodLabel = "all";
  if (period && period !== "all") {
    const range = periodRange(period, startDate, endDate);
    periodLabel = range.label;
    filterLead.createdAt = { $gte: range.start, $lte: range.end };
    filterQuote.createdAt = { $gte: range.start, $lte: range.end };
  }

  const [leadsByStatus, openLeads, quotesByStatus, quoteTotals] = await Promise.all([
    Lead.aggregate([
      { $match: filterLead },
      { $group: { _id: "$status", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    Lead.countDocuments({
      ...filterLead,
      status: { $in: ["New", "Contacted", "Quoted"] },
    }),
    Quote.aggregate([
      { $match: filterQuote },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalAmount: { $sum: "$totalAmount" },
        },
      },
      { $sort: { count: -1 } },
    ]),
    Quote.aggregate([
      { $match: filterQuote },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          totalAmount: { $sum: "$totalAmount" },
        },
      },
    ]),
  ]);

  const leadMap = {};
  leadsByStatus.forEach((r) => {
    leadMap[r._id || "Unknown"] = r.count;
  });
  const quoteMap = {};
  quotesByStatus.forEach((r) => {
    quoteMap[r._id || "Unknown"] = {
      count: r.count,
      totalAmount: r.totalAmount || 0,
    };
  });
  const qt = quoteTotals[0] || { count: 0, totalAmount: 0 };

  return {
    period: periodLabel,
    leads: {
      openPipeline: openLeads,
      byStatus: leadsByStatus.map((r) => ({
        status: r._id || "Unknown",
        count: r.count,
      })),
      new: leadMap.New || 0,
      contacted: leadMap.Contacted || 0,
      quoted: leadMap.Quoted || 0,
      converted: leadMap.Converted || 0,
      lost: leadMap.Lost || 0,
    },
    quotes: {
      count: qt.count,
      totalAmount: qt.totalAmount,
      byStatus: quotesByStatus.map((r) => ({
        status: r._id || "Unknown",
        count: r.count,
        totalAmount: r.totalAmount || 0,
      })),
      sentValue: quoteMap.Sent?.totalAmount || 0,
      acceptedValue: quoteMap.Accepted?.totalAmount || 0,
      rejectedValue: quoteMap.Rejected?.totalAmount || 0,
    },
    hint: "Summarize open leads → sent quotes → accepted/won. Use period=thisQuarter for quarter view.",
  };
}

// ---------------------------------------------------------------------------
// get_supplier
// ---------------------------------------------------------------------------
async function getSupplier({ query, limit = 10 } = {}) {
  const cap = capLimit(limit, 10, 20);
  const q = String(query || "").trim();
  if (!q) return { error: "query is required (supplier name/email/phone)." };

  const rx = new RegExp(escapeRegex(q), "i");
  const matches = await Supplier.find({
    $or: [{ name: rx }, { contactPerson: rx }, { email: rx }, { phone: rx }],
  })
    .select("name contactPerson email phone address notes isActive")
    .limit(8)
    .lean();

  if (!matches.length) {
    return { suppliers: [], hint: "No supplier matched." };
  }
  if (matches.length > 1) {
    return {
      multipleSuppliers: matches.map((s) => ({
        id: String(s._id),
        name: s.name,
        email: s.email || "",
        phone: s.phone || "",
        isActive: s.isActive !== false,
        url: `/admin/suppliers`,
      })),
      hint: "Multiple suppliers matched. Ask which one, then call again with a clearer name.",
    };
  }

  const supplier = matches[0];
  const [pos, rfqs] = await Promise.all([
    PurchaseOrder.find({ supplierId: supplier._id })
      .select("poNumber status expectedDelivery orderedAt jobId delayReason")
      .sort({ orderedAt: -1 })
      .limit(cap)
      .lean(),
    Rfq.find({
      $or: [
        { supplierIds: supplier._id },
        { "vendorQuotes.supplierId": supplier._id },
      ],
    })
      .select("rfqNumber title status sentAt jobId createdAt")
      .sort({ createdAt: -1 })
      .limit(cap)
      .lean(),
  ]);

  const jobIds = [
    ...pos.map((p) => p.jobId),
    ...rfqs.map((r) => r.jobId),
  ].filter(Boolean);
  const jobs = jobIds.length
    ? await Job.find({ _id: { $in: jobIds } })
        .select("_id jobId customer")
        .lean()
    : [];
  const jobMap = {};
  jobs.forEach((j) => {
    jobMap[String(j._id)] = j;
  });

  return {
    supplier: {
      id: String(supplier._id),
      name: supplier.name,
      contactPerson: supplier.contactPerson || "",
      email: supplier.email || "",
      phone: supplier.phone || "",
      address: supplier.address || "",
      notes: supplier.notes || "",
      isActive: supplier.isActive !== false,
      url: `/admin/suppliers`,
    },
    recentPurchaseOrders: pos.map((p) => {
      const job = jobMap[String(p.jobId)] || null;
      return {
        poNumber: p.poNumber,
        status: p.status,
        expectedDelivery: p.expectedDelivery || "",
        orderedAt: p.orderedAt,
        delayReason: p.delayReason || "",
        ...jobLink(job),
        customer: job?.customer || "",
        url: `/admin/purchase-order`,
      };
    }),
    recentRfqs: rfqs.map((r) => {
      const job = jobMap[String(r.jobId)] || null;
      return {
        rfqNumber: r.rfqNumber || "",
        title: r.title || "",
        status: r.status,
        sentAt: r.sentAt,
        ...jobLink(job),
        customer: job?.customer || "",
        url: `/admin/rfq`,
      };
    }),
  };
}

// ---------------------------------------------------------------------------
// list_clients
// ---------------------------------------------------------------------------
async function listClients({ query, enabledOnly = true, limit = 30 } = {}) {
  const cap = capLimit(limit);
  const filter = { removed: { $ne: true } };
  if (enabledOnly === true || enabledOnly === "true") filter.enabled = true;
  if (enabledOnly === false || enabledOnly === "false") filter.enabled = false;

  const q = String(query || "").trim();
  if (q) {
    const rx = new RegExp(escapeRegex(q), "i");
    filter.$or = [{ name: rx }, { email: rx }, { phone: rx }, { address: rx }, { country: rx }];
  }

  const [total, rows] = await Promise.all([
    Client.countDocuments(filter),
    Client.find(filter)
      .select("name email phone address country enabled created")
      .sort({ name: 1 })
      .limit(cap)
      .lean(),
  ]);

  return {
    total,
    clients: rows.map((c) => ({
      id: String(c._id),
      name: c.name,
      email: c.email || "",
      phone: c.phone || "",
      address: c.address || "",
      country: c.country || "",
      enabled: c.enabled !== false,
      created: c.created,
      url: `/admin/client`,
    })),
    hint: "Client is the legacy/billing client module (separate from Customer). Prefer list_customers for job customers.",
  };
}

// ---------------------------------------------------------------------------
// Exports (download link only — file built on click)
// ---------------------------------------------------------------------------
async function exportInvoicesExcel({
  period = "thisMonth",
  startDate,
  endDate,
  status,
  limit = 100,
  format = "excel",
} = {}) {
  const cap = Math.min(Math.max(Number(limit) || 100, 1), 300);
  const fmt = String(format || "excel").toLowerCase() === "csv" ? "csv" : "excel";
  const rows = await fetchInvoicesForExport({
    period,
    startDate,
    endDate,
    status,
    limit: cap,
  });
  const downloadUrl = buildInvoicesExportDownloadUrl({
    period,
    startDate,
    endDate,
    status,
    limit: cap,
    format: fmt,
  });
  return {
    rowCount: rows.length,
    columns: INVOICE_EXPORT_HEADERS,
    filename: stampFilename("invoices", fmt === "csv" ? "csv" : "xls"),
    downloadUrl,
    format: fmt,
    stored: false,
    hint:
      rows.length === 0
        ? "No invoices matched. Do not invent a download."
        : `Include this exact markdown link: [Download Excel report](${downloadUrl})`,
    preview: rows.slice(0, 5),
  };
}

async function exportPaymentsExcel({
  period = "thisMonth",
  startDate,
  endDate,
  limit = 100,
  format = "excel",
} = {}) {
  const cap = Math.min(Math.max(Number(limit) || 100, 1), 300);
  const fmt = String(format || "excel").toLowerCase() === "csv" ? "csv" : "excel";
  const rows = await fetchPaymentsForExport({
    period,
    startDate,
    endDate,
    limit: cap,
  });
  const downloadUrl = buildPaymentsExportDownloadUrl({
    period,
    startDate,
    endDate,
    limit: cap,
    format: fmt,
  });
  return {
    rowCount: rows.length,
    columns: PAYMENT_EXPORT_HEADERS,
    filename: stampFilename("payments", fmt === "csv" ? "csv" : "xls"),
    downloadUrl,
    format: fmt,
    stored: false,
    hint:
      rows.length === 0
        ? "No payments matched. Do not invent a download."
        : `Include this exact markdown link: [Download Excel report](${downloadUrl})`,
    preview: rows.slice(0, 5),
  };
}

async function exportAttendanceExcel({
  period = "thisMonth",
  startDate,
  endDate,
  workerName,
  limit = 200,
  format = "excel",
} = {}) {
  const cap = Math.min(Math.max(Number(limit) || 200, 1), 500);
  const fmt = String(format || "excel").toLowerCase() === "csv" ? "csv" : "excel";
  const rows = await fetchAttendanceForExport({
    period,
    startDate,
    endDate,
    workerName,
    limit: cap,
  });
  const downloadUrl = buildAttendanceExportDownloadUrl({
    period,
    startDate,
    endDate,
    workerName,
    limit: cap,
    format: fmt,
  });
  return {
    rowCount: rows.length,
    columns: ATTENDANCE_EXPORT_HEADERS,
    filename: stampFilename("attendance", fmt === "csv" ? "csv" : "xls"),
    downloadUrl,
    format: fmt,
    stored: false,
    hint:
      rows.length === 0
        ? "No attendance sessions matched. Do not invent a download."
        : `Include this exact markdown link: [Download Excel report](${downloadUrl})`,
    preview: rows.slice(0, 5),
  };
}

// ---------------------------------------------------------------------------
const RUNNERS = {
  get_job_financials: getJobFinancials,
  list_invoices: listInvoices,
  get_quote_summary: getQuoteSummary,
  get_sales_pipeline_summary: getSalesPipelineSummary,
  get_supplier: getSupplier,
  list_clients: listClients,
  export_invoices_excel: exportInvoicesExcel,
  export_payments_excel: exportPaymentsExcel,
  export_attendance_excel: exportAttendanceExcel,
};

const PERIOD_ENUM = [
  "today",
  "last7Days",
  "thisWeek",
  "thisMonth",
  "lastMonth",
  "thisQuarter",
  "custom",
  "all",
];

const TOOL_DEFINITIONS = [
  {
    type: "function",
    function: {
      name: "get_job_financials",
      description:
        "Contract vs invoiced vs paid for one job (lockedValue, variations, unbilled, outstanding). Use for 'how much left to bill on X' / job money summary.",
      parameters: {
        type: "object",
        properties: {
          jobSearch: {
            type: "string",
            description: "Job code or customer/site nickname",
          },
          limit: { type: "number", description: "Max invoices to list" },
        },
        required: ["jobSearch"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_invoices",
      description:
        "List invoices by period/status/job/type (broader than pending-only). Use for invoices this month, paid invoices, overdue list, invoices on a job.",
      parameters: {
        type: "object",
        properties: {
          period: { type: "string", enum: PERIOD_ENUM },
          status: {
            type: "string",
            description: "Draft, Issued, Paid, Overdue, unpaid/outstanding, or all",
          },
          invoiceType: {
            type: "string",
            description: "Progress Payment, Variation, Final, Retention",
          },
          jobSearch: { type: "string" },
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
      name: "get_quote_summary",
      description:
        "Quote totals by status (Draft/Sent/Accepted/Rejected) for a period. Use for 'quotes sent vs accepted this month'.",
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
      name: "get_sales_pipeline_summary",
      description:
        "Sales pipeline snapshot: leads by status + quotes by status/value for a period. Use for pipeline / sales overview.",
      parameters: {
        type: "object",
        properties: {
          period: { type: "string", enum: PERIOD_ENUM },
          startDate: { type: "string" },
          endDate: { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_supplier",
      description:
        "Look up one supplier by name/email/phone and show recent POs + RFQs linked to them.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          limit: { type: "number" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_clients",
      description:
        "List legacy Client records (separate from Customer). Use only when admin asks about clients module, not job customers.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          enabledOnly: { type: "boolean" },
          limit: { type: "number" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "export_invoices_excel",
      description:
        "Create downloadable Excel/CSV of invoices. Returns downloadUrl — do NOT paste rows into chat.",
      parameters: {
        type: "object",
        properties: {
          period: { type: "string", enum: PERIOD_ENUM },
          status: { type: "string" },
          startDate: { type: "string" },
          endDate: { type: "string" },
          limit: { type: "number" },
          format: { type: "string", enum: ["excel", "csv"] },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "export_payments_excel",
      description:
        "Create downloadable Excel/CSV of payments received. Returns downloadUrl — do NOT paste rows into chat.",
      parameters: {
        type: "object",
        properties: {
          period: { type: "string", enum: PERIOD_ENUM },
          startDate: { type: "string" },
          endDate: { type: "string" },
          limit: { type: "number" },
          format: { type: "string", enum: ["excel", "csv"] },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "export_attendance_excel",
      description:
        "Create downloadable Excel/CSV of worker attendance sessions. Returns downloadUrl — do NOT paste rows into chat.",
      parameters: {
        type: "object",
        properties: {
          period: { type: "string", enum: PERIOD_ENUM },
          startDate: { type: "string" },
          endDate: { type: "string" },
          workerName: { type: "string" },
          limit: { type: "number" },
          format: { type: "string", enum: ["excel", "csv"] },
        },
      },
    },
  },
];

module.exports = {
  RUNNERS,
  TOOL_DEFINITIONS,
};
