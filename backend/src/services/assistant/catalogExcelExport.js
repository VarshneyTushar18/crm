/**
 * In-memory Excel/CSV builders for leads, quotes, defects, POs, RFQs.
 * Nothing is written to disk, public/, or Mongo — buffer streamed on download click.
 */
const moment = require("moment");
const Lead = require("../../models/appModels/Lead");
const Quote = require("../../models/appModels/Quote");
const DefectSnag = require("../../models/appModels/DefectSnag");
const PurchaseOrder = require("../../models/appModels/PurchaseOrder");
const Rfq = require("../../models/appModels/Rfq");
const Job = require("../../models/appModels/Job");
const Supplier = require("../../models/appModels/Supplier");

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const periodRange = (period = "thisMonth", startDate, endDate) => {
  const p = String(period || "thisMonth").trim();
  if (p === "today") {
    return {
      start: moment().startOf("day").toDate(),
      end: moment().endOf("day").toDate(),
    };
  }
  if (p === "last7Days" || p === "last7days") {
    return {
      start: moment().subtract(6, "days").startOf("day").toDate(),
      end: moment().endOf("day").toDate(),
    };
  }
  if (p === "thisWeek") {
    return {
      start: moment().startOf("week").toDate(),
      end: moment().endOf("week").toDate(),
    };
  }
  if (p === "lastMonth") {
    const m = moment().subtract(1, "month");
    return {
      start: m.clone().startOf("month").toDate(),
      end: m.clone().endOf("month").toDate(),
    };
  }
  if (p === "thisQuarter" || p === "quarter") {
    return {
      start: moment().startOf("quarter").toDate(),
      end: moment().endOf("quarter").toDate(),
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
    };
  }
  if (p === "all") return null;
  return {
    start: moment().startOf("month").toDate(),
    end: moment().endOf("month").toDate(),
  };
};

const htmlEscape = (v) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const csvEscape = (v) => {
  const s = String(v ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
};

function stampFilename(prefix, extension) {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
  return `${prefix}-${stamp}.${extension}`;
}

function buildExcelHtmlBuffer(headers, rows) {
  let table =
    '<html><head><meta charset="utf-8"></head><body><table border="1"><thead><tr>';
  headers.forEach((h) => {
    table += `<th>${htmlEscape(h)}</th>`;
  });
  table += "</tr></thead><tbody>";
  rows.forEach((cells) => {
    table += "<tr>";
    cells.forEach((cell) => {
      table += `<td>${htmlEscape(cell)}</td>`;
    });
    table += "</tr>";
  });
  table += "</tbody></table></body></html>";
  return Buffer.from(`\ufeff${table}`, "utf8");
}

function buildCsvBuffer(headers, rows) {
  const lines = [
    headers.map(csvEscape).join(","),
    ...rows.map((cells) => cells.map(csvEscape).join(",")),
  ];
  return Buffer.from(`\ufeff${lines.join("\n")}`, "utf8");
}

function buildExportBuffer(headers, rows, format = "excel") {
  const fmt = String(format || "excel").toLowerCase();
  if (fmt === "csv") {
    return {
      buffer: buildCsvBuffer(headers, rows),
      contentType: "text/csv; charset=utf-8",
      extension: "csv",
    };
  }
  return {
    buffer: buildExcelHtmlBuffer(headers, rows),
    contentType: "application/vnd.ms-excel; charset=utf-8",
    extension: "xls",
  };
}

const fmtDate = (d) => (d ? moment(d).format("YYYY-MM-DD") : "");

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

function qsUrl(path, paramsObj = {}) {
  const params = new URLSearchParams();
  Object.entries(paramsObj).forEach(([k, v]) => {
    if (v !== undefined && v !== null && String(v).trim() !== "") {
      params.set(k, String(v));
    }
  });
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

// ---- Leads ----
const LEAD_EXPORT_HEADERS = [
  "Client",
  "Contact",
  "Phone",
  "Email",
  "Site",
  "Category",
  "Status",
  "Source",
  "Assigned",
  "Next Follow-up",
  "Created",
];

async function fetchLeadsForExport({
  period = "thisMonth",
  startDate,
  endDate,
  status,
  openOnly,
  limit = 200,
} = {}) {
  const cap = Math.min(Math.max(Number(limit) || 200, 1), 500);
  const filter = {};
  const range = periodRange(period, startDate, endDate);
  if (range) filter.createdAt = { $gte: range.start, $lte: range.end };

  const statusRaw = String(status || "").trim();
  const wantOpen =
    openOnly === true || openOnly === "true" || statusRaw.toLowerCase() === "open";
  if (wantOpen) {
    filter.status = { $in: ["New", "Contacted", "Quoted"] };
  } else if (statusRaw && statusRaw.toLowerCase() !== "all") {
    filter.status = new RegExp(`^${escapeRegex(statusRaw)}$`, "i");
  }

  const rows = await Lead.find(filter)
    .select(
      "clientName contactPerson phone email siteAddress category status leadSource assignedSalesperson nextFollowUpDate createdAt"
    )
    .sort({ createdAt: -1 })
    .limit(cap)
    .lean();

  return rows.map((l) => ({
    clientName: l.clientName || "",
    contactPerson: l.contactPerson || "",
    phone: l.phone || "",
    email: l.email || "",
    siteAddress: l.siteAddress || "",
    category: l.category || "",
    status: l.status || "",
    leadSource: l.leadSource || "",
    assignedSalesperson: l.assignedSalesperson || "",
    nextFollowUpDate: fmtDate(l.nextFollowUpDate),
    createdAt: fmtDate(l.createdAt),
  }));
}

function leadsToCells(rows) {
  return rows.map((r) => [
    r.clientName,
    r.contactPerson,
    r.phone,
    r.email,
    r.siteAddress,
    r.category,
    r.status,
    r.leadSource,
    r.assignedSalesperson,
    r.nextFollowUpDate,
    r.createdAt,
  ]);
}

function buildLeadsExportBuffer(rows, format = "excel") {
  return buildExportBuffer(LEAD_EXPORT_HEADERS, leadsToCells(rows), format);
}

function buildLeadsExportDownloadUrl(opts = {}) {
  return qsUrl("/assistant/exports/leads", {
    period: opts.period,
    startDate: opts.startDate,
    endDate: opts.endDate,
    status: opts.status,
    openOnly: opts.openOnly,
    limit: opts.limit,
    format: opts.format === "csv" ? "csv" : "excel",
  });
}

// ---- Quotes ----
const QUOTE_EXPORT_HEADERS = [
  "Quote Number",
  "Customer",
  "Contact",
  "Phone",
  "Status",
  "Amount",
  "Valid Until",
  "Site",
  "Created",
];

async function fetchQuotesForExport({
  period = "thisMonth",
  startDate,
  endDate,
  status,
  openOnly,
  limit = 200,
} = {}) {
  const cap = Math.min(Math.max(Number(limit) || 200, 1), 500);
  const filter = { removed: { $ne: true } };
  const range = periodRange(period, startDate, endDate);
  if (range) filter.createdAt = { $gte: range.start, $lte: range.end };

  const statusRaw = String(status || "").trim();
  const wantOpen =
    openOnly === true || openOnly === "true" || statusRaw.toLowerCase() === "open";
  if (wantOpen) {
    filter.status = { $in: ["Draft", "Sent"] };
  } else if (statusRaw && statusRaw.toLowerCase() !== "all") {
    filter.status = new RegExp(`^${escapeRegex(statusRaw)}$`, "i");
  }

  const rows = await Quote.find(filter)
    .select(
      "quoteNumber customerName contactPerson phone status totalAmount validUntil siteAddress createdAt"
    )
    .sort({ createdAt: -1 })
    .limit(cap)
    .lean();

  return rows.map((q) => ({
    quoteNumber: q.quoteNumber || "",
    customerName: q.customerName || "",
    contactPerson: q.contactPerson || "",
    phone: q.phone || "",
    status: q.status || "",
    totalAmount: q.totalAmount ?? "",
    validUntil: fmtDate(q.validUntil),
    siteAddress: q.siteAddress || "",
    createdAt: fmtDate(q.createdAt),
  }));
}

function quotesToCells(rows) {
  return rows.map((r) => [
    r.quoteNumber,
    r.customerName,
    r.contactPerson,
    r.phone,
    r.status,
    r.totalAmount,
    r.validUntil,
    r.siteAddress,
    r.createdAt,
  ]);
}

function buildQuotesExportBuffer(rows, format = "excel") {
  return buildExportBuffer(QUOTE_EXPORT_HEADERS, quotesToCells(rows), format);
}

function buildQuotesExportDownloadUrl(opts = {}) {
  return qsUrl("/assistant/exports/quotes", {
    period: opts.period,
    startDate: opts.startDate,
    endDate: opts.endDate,
    status: opts.status,
    openOnly: opts.openOnly,
    limit: opts.limit,
    format: opts.format === "csv" ? "csv" : "excel",
  });
}

// ---- Defects / Snags ----
const DEFECT_EXPORT_HEADERS = [
  "Type",
  "Title",
  "Status",
  "Owner",
  "Due Date",
  "Location",
  "Job",
  "Customer",
  "Created",
];

async function fetchDefectsForExport({
  period = "all",
  startDate,
  endDate,
  status,
  type,
  openOnly = true,
  limit = 200,
} = {}) {
  const cap = Math.min(Math.max(Number(limit) || 200, 1), 500);
  const filter = {};
  const range = periodRange(period, startDate, endDate);
  if (range) filter.createdAt = { $gte: range.start, $lte: range.end };

  const statusRaw = String(status || "").trim();
  const wantOpen =
    openOnly === true || openOnly === "true" || statusRaw.toLowerCase() === "open";
  if (wantOpen && !statusRaw) {
    filter.status = { $in: ["Open", "In Progress"] };
  } else if (statusRaw && statusRaw.toLowerCase() !== "all") {
    filter.status = new RegExp(`^${escapeRegex(statusRaw)}$`, "i");
  }

  const typeRaw = String(type || "").trim();
  if (typeRaw && typeRaw.toLowerCase() !== "all") {
    filter.type = new RegExp(`^${escapeRegex(typeRaw)}$`, "i");
  }

  const rows = await DefectSnag.find(filter)
    .select("type title status owner dueDate locationArea jobId createdAt")
    .sort({ createdAt: -1 })
    .limit(cap)
    .lean();

  const jobMap = await loadJobMap(rows.map((r) => r.jobId));
  return rows.map((d) => {
    const job = jobMap[String(d.jobId)] || null;
    return {
      type: d.type || "",
      title: d.title || "",
      status: d.status || "",
      owner: d.owner || "",
      dueDate: d.dueDate || "",
      locationArea: d.locationArea || "",
      jobCode: job?.jobId || "",
      customer: job?.customer || "",
      createdAt: fmtDate(d.createdAt),
    };
  });
}

function defectsToCells(rows) {
  return rows.map((r) => [
    r.type,
    r.title,
    r.status,
    r.owner,
    r.dueDate,
    r.locationArea,
    r.jobCode,
    r.customer,
    r.createdAt,
  ]);
}

function buildDefectsExportBuffer(rows, format = "excel") {
  return buildExportBuffer(DEFECT_EXPORT_HEADERS, defectsToCells(rows), format);
}

function buildDefectsExportDownloadUrl(opts = {}) {
  return qsUrl("/assistant/exports/defects", {
    period: opts.period,
    startDate: opts.startDate,
    endDate: opts.endDate,
    status: opts.status,
    type: opts.type,
    openOnly: opts.openOnly,
    limit: opts.limit,
    format: opts.format === "csv" ? "csv" : "excel",
  });
}

// ---- Purchase Orders ----
const PO_EXPORT_HEADERS = [
  "PO Number",
  "Status",
  "Expected Delivery",
  "Ordered At",
  "Delay Reason",
  "Supplier",
  "Job",
  "Customer",
];

async function fetchPurchaseOrdersForExport({
  period = "thisMonth",
  startDate,
  endDate,
  status,
  limit = 200,
} = {}) {
  const cap = Math.min(Math.max(Number(limit) || 200, 1), 500);
  const filter = {};
  const range = periodRange(period, startDate, endDate);
  if (range) filter.orderedAt = { $gte: range.start, $lte: range.end };

  const statusRaw = String(status || "").trim();
  if (statusRaw && statusRaw.toLowerCase() !== "all") {
    if (statusRaw.toLowerCase() === "open") {
      filter.status = { $in: ["Ordered", "Delayed", "Partially Received"] };
    } else {
      filter.status = new RegExp(`^${escapeRegex(statusRaw)}$`, "i");
    }
  }

  const rows = await PurchaseOrder.find(filter)
    .select(
      "poNumber status expectedDelivery orderedAt delayReason jobId supplierId"
    )
    .sort({ orderedAt: -1 })
    .limit(cap)
    .lean();

  const jobMap = await loadJobMap(rows.map((r) => r.jobId));
  const supplierIds = [...new Set(rows.map((r) => String(r.supplierId || "")).filter(Boolean))];
  const suppliers = supplierIds.length
    ? await Supplier.find({ _id: { $in: supplierIds } }).select("name").lean()
    : [];
  const supplierMap = {};
  suppliers.forEach((s) => {
    supplierMap[String(s._id)] = s.name || "";
  });

  return rows.map((p) => {
    const job = jobMap[String(p.jobId)] || null;
    return {
      poNumber: p.poNumber || "",
      status: p.status || "",
      expectedDelivery: p.expectedDelivery || "",
      orderedAt: fmtDate(p.orderedAt),
      delayReason: p.delayReason || "",
      supplier: supplierMap[String(p.supplierId)] || "",
      jobCode: job?.jobId || "",
      customer: job?.customer || "",
    };
  });
}

function posToCells(rows) {
  return rows.map((r) => [
    r.poNumber,
    r.status,
    r.expectedDelivery,
    r.orderedAt,
    r.delayReason,
    r.supplier,
    r.jobCode,
    r.customer,
  ]);
}

function buildPurchaseOrdersExportBuffer(rows, format = "excel") {
  return buildExportBuffer(PO_EXPORT_HEADERS, posToCells(rows), format);
}

function buildPurchaseOrdersExportDownloadUrl(opts = {}) {
  return qsUrl("/assistant/exports/purchase-orders", {
    period: opts.period,
    startDate: opts.startDate,
    endDate: opts.endDate,
    status: opts.status,
    limit: opts.limit,
    format: opts.format === "csv" ? "csv" : "excel",
  });
}

// ---- RFQs ----
const RFQ_EXPORT_HEADERS = [
  "RFQ Number",
  "Title",
  "Status",
  "Items",
  "Vendor Quotes",
  "Sent At",
  "Job",
  "Customer",
  "Created",
];

async function fetchRfqsForExport({
  period = "thisMonth",
  startDate,
  endDate,
  status,
  limit = 200,
} = {}) {
  const cap = Math.min(Math.max(Number(limit) || 200, 1), 500);
  const filter = {};
  const range = periodRange(period, startDate, endDate);
  if (range) filter.createdAt = { $gte: range.start, $lte: range.end };

  const statusRaw = String(status || "").trim();
  if (statusRaw && statusRaw.toLowerCase() !== "all") {
    if (statusRaw.toLowerCase() === "open") {
      filter.status = { $in: ["Draft", "Sent", "Responses Received"] };
    } else {
      filter.status = new RegExp(`^${escapeRegex(statusRaw)}$`, "i");
    }
  }

  const rows = await Rfq.find(filter)
    .select("rfqNumber title status items vendorQuotes sentAt jobId createdAt")
    .sort({ createdAt: -1 })
    .limit(cap)
    .lean();

  const jobMap = await loadJobMap(rows.map((r) => r.jobId));
  return rows.map((r) => {
    const job = jobMap[String(r.jobId)] || null;
    return {
      rfqNumber: r.rfqNumber || "",
      title: r.title || "",
      status: r.status || "",
      itemCount: (r.items || []).length,
      vendorQuoteCount: (r.vendorQuotes || []).length,
      sentAt: fmtDate(r.sentAt),
      jobCode: job?.jobId || "",
      customer: job?.customer || "",
      createdAt: fmtDate(r.createdAt),
    };
  });
}

function rfqsToCells(rows) {
  return rows.map((r) => [
    r.rfqNumber,
    r.title,
    r.status,
    r.itemCount,
    r.vendorQuoteCount,
    r.sentAt,
    r.jobCode,
    r.customer,
    r.createdAt,
  ]);
}

function buildRfqsExportBuffer(rows, format = "excel") {
  return buildExportBuffer(RFQ_EXPORT_HEADERS, rfqsToCells(rows), format);
}

function buildRfqsExportDownloadUrl(opts = {}) {
  return qsUrl("/assistant/exports/rfqs", {
    period: opts.period,
    startDate: opts.startDate,
    endDate: opts.endDate,
    status: opts.status,
    limit: opts.limit,
    format: opts.format === "csv" ? "csv" : "excel",
  });
}

module.exports = {
  stampFilename,
  LEAD_EXPORT_HEADERS,
  QUOTE_EXPORT_HEADERS,
  DEFECT_EXPORT_HEADERS,
  PO_EXPORT_HEADERS,
  RFQ_EXPORT_HEADERS,
  fetchLeadsForExport,
  buildLeadsExportBuffer,
  buildLeadsExportDownloadUrl,
  fetchQuotesForExport,
  buildQuotesExportBuffer,
  buildQuotesExportDownloadUrl,
  fetchDefectsForExport,
  buildDefectsExportBuffer,
  buildDefectsExportDownloadUrl,
  fetchPurchaseOrdersForExport,
  buildPurchaseOrdersExportBuffer,
  buildPurchaseOrdersExportDownloadUrl,
  fetchRfqsForExport,
  buildRfqsExportBuffer,
  buildRfqsExportDownloadUrl,
};
