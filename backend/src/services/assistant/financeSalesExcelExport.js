/**
 * In-memory Excel/CSV builders for invoices, payments, attendance exports.
 * Same pattern as jobsExcelExport — nothing stored on disk.
 */
const moment = require("moment");
const Invoice = require("../../models/appModels/Invoice");
const Payment = require("../../models/appModels/Payment");
const WorkerAttendanceSession = require("../../models/appModels/WorkerAttendanceSession");

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
    "<html><head><meta charset=\"utf-8\"></head><body><table border=\"1\"><thead><tr>";
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
const fmtDateTime = (d) => (d ? moment(d).format("YYYY-MM-DD HH:mm") : "");

// ---- Invoices ----
const INVOICE_EXPORT_HEADERS = [
  "Number",
  "Status",
  "Type",
  "Total",
  "Paid",
  "Due",
  "Date",
  "Due Date",
  "Overdue",
  "Job",
  "Customer",
  "Currency",
];

async function fetchInvoicesForExport({
  period = "thisMonth",
  startDate,
  endDate,
  status,
  limit = 100,
} = {}) {
  const cap = Math.min(Math.max(Number(limit) || 100, 1), 300);
  const filter = { removed: { $ne: true } };
  const range = periodRange(period, startDate, endDate);
  if (range) filter.date = { $gte: range.start, $lte: range.end };

  const statusRaw = String(status || "").trim();
  if (statusRaw && statusRaw.toLowerCase() !== "all") {
    const lower = statusRaw.toLowerCase();
    if (lower === "overdue") {
      filter.$or = [{ status: "Overdue" }, { isOverdue: true }];
    } else if (lower === "unpaid" || lower === "outstanding" || lower === "pending") {
      filter.status = { $in: ["Draft", "Issued", "Partially Paid", "Overdue"] };
      filter.amountDue = { $gt: 0 };
    } else {
      filter.status = new RegExp(`^${escapeRegex(statusRaw)}$`, "i");
    }
  }

  const rows = await Invoice.find(filter)
    .select(
      "number status invoiceType total amountPaid amountDue date expiredDate isOverdue currency job"
    )
    .populate({ path: "job", select: "jobId customer" })
    .sort({ date: -1 })
    .limit(cap)
    .lean();

  return rows.map((inv) => ({
    number: inv.number || "",
    status: inv.status || "",
    invoiceType: inv.invoiceType || "",
    total: inv.total ?? "",
    amountPaid: inv.amountPaid ?? "",
    amountDue: inv.amountDue ?? "",
    date: fmtDate(inv.date),
    expiredDate: fmtDate(inv.expiredDate),
    isOverdue: inv.isOverdue ? "Yes" : "No",
    jobId: inv.job?.jobId || "",
    customer: inv.job?.customer || "",
    currency: inv.currency || "",
  }));
}

function invoicesToCellRows(rows) {
  return rows.map((r) => [
    r.number,
    r.status,
    r.invoiceType,
    r.total,
    r.amountPaid,
    r.amountDue,
    r.date,
    r.expiredDate,
    r.isOverdue,
    r.jobId,
    r.customer,
    r.currency,
  ]);
}

function buildInvoicesExportBuffer(rows, format = "excel") {
  return buildExportBuffer(INVOICE_EXPORT_HEADERS, invoicesToCellRows(rows), format);
}

function buildInvoicesExportDownloadUrl({
  period,
  startDate,
  endDate,
  status,
  limit,
  format = "excel",
} = {}) {
  const params = new URLSearchParams();
  if (period) params.set("period", String(period));
  if (startDate) params.set("startDate", String(startDate));
  if (endDate) params.set("endDate", String(endDate));
  if (status) params.set("status", String(status));
  if (limit) params.set("limit", String(limit));
  params.set("format", format === "csv" ? "csv" : "excel");
  return `/assistant/exports/invoices?${params.toString()}`;
}

// ---- Payments ----
const PAYMENT_EXPORT_HEADERS = [
  "Number",
  "Date",
  "Amount",
  "Currency",
  "Ref",
  "Description",
  "Invoice",
  "Invoice Status",
];

async function fetchPaymentsForExport({
  period = "thisMonth",
  startDate,
  endDate,
  limit = 100,
} = {}) {
  const cap = Math.min(Math.max(Number(limit) || 100, 1), 300);
  const filter = { removed: { $ne: true } };
  const range = periodRange(period, startDate, endDate);
  if (range) filter.date = { $gte: range.start, $lte: range.end };

  const rows = await Payment.find(filter)
    .select("number date amount currency ref description invoice")
    .populate({ path: "invoice", select: "number status" })
    .sort({ date: -1 })
    .limit(cap)
    .lean();

  return rows.map((p) => ({
    number: p.number ?? "",
    date: fmtDate(p.date),
    amount: p.amount ?? "",
    currency: p.currency || "",
    ref: p.ref || "",
    description: p.description || "",
    invoiceNumber: p.invoice?.number || "",
    invoiceStatus: p.invoice?.status || "",
  }));
}

function paymentsToCellRows(rows) {
  return rows.map((r) => [
    r.number,
    r.date,
    r.amount,
    r.currency,
    r.ref,
    r.description,
    r.invoiceNumber,
    r.invoiceStatus,
  ]);
}

function buildPaymentsExportBuffer(rows, format = "excel") {
  return buildExportBuffer(PAYMENT_EXPORT_HEADERS, paymentsToCellRows(rows), format);
}

function buildPaymentsExportDownloadUrl({
  period,
  startDate,
  endDate,
  limit,
  format = "excel",
} = {}) {
  const params = new URLSearchParams();
  if (period) params.set("period", String(period));
  if (startDate) params.set("startDate", String(startDate));
  if (endDate) params.set("endDate", String(endDate));
  if (limit) params.set("limit", String(limit));
  params.set("format", format === "csv" ? "csv" : "excel");
  return `/assistant/exports/payments?${params.toString()}`;
}

// ---- Attendance ----
const ATTENDANCE_EXPORT_HEADERS = [
  "Worker Name",
  "Worker Email",
  "Worker ID",
  "Status",
  "Check In",
  "Check Out",
  "Job Hint",
];

async function fetchAttendanceForExport({
  period = "thisMonth",
  startDate,
  endDate,
  workerName,
  limit = 200,
} = {}) {
  const cap = Math.min(Math.max(Number(limit) || 200, 1), 500);
  const filter = {};
  const range = periodRange(period, startDate, endDate);
  if (range) filter.checkInTime = { $gte: range.start, $lte: range.end };
  if (workerName) {
    const rx = new RegExp(escapeRegex(String(workerName).trim()), "i");
    filter.$or = [{ workerName: rx }, { workerEmail: rx }, { workerId: rx }];
  }

  const rows = await WorkerAttendanceSession.find(filter)
    .select("workerName workerEmail workerId status checkInTime checkOutTime jobId")
    .sort({ checkInTime: -1 })
    .limit(cap)
    .lean();

  return rows.map((s) => ({
    workerName: s.workerName || "",
    workerEmail: s.workerEmail || "",
    workerId: s.workerId || "",
    status: s.status || "",
    checkInTime: fmtDateTime(s.checkInTime),
    checkOutTime: fmtDateTime(s.checkOutTime),
    jobHint: s.jobId || "",
  }));
}

function attendanceToCellRows(rows) {
  return rows.map((r) => [
    r.workerName,
    r.workerEmail,
    r.workerId,
    r.status,
    r.checkInTime,
    r.checkOutTime,
    r.jobHint,
  ]);
}

function buildAttendanceExportBuffer(rows, format = "excel") {
  return buildExportBuffer(ATTENDANCE_EXPORT_HEADERS, attendanceToCellRows(rows), format);
}

function buildAttendanceExportDownloadUrl({
  period,
  startDate,
  endDate,
  workerName,
  limit,
  format = "excel",
} = {}) {
  const params = new URLSearchParams();
  if (period) params.set("period", String(period));
  if (startDate) params.set("startDate", String(startDate));
  if (endDate) params.set("endDate", String(endDate));
  if (workerName) params.set("workerName", String(workerName));
  if (limit) params.set("limit", String(limit));
  params.set("format", format === "csv" ? "csv" : "excel");
  return `/assistant/exports/attendance?${params.toString()}`;
}

module.exports = {
  stampFilename,
  INVOICE_EXPORT_HEADERS,
  PAYMENT_EXPORT_HEADERS,
  ATTENDANCE_EXPORT_HEADERS,
  fetchInvoicesForExport,
  buildInvoicesExportBuffer,
  buildInvoicesExportDownloadUrl,
  fetchPaymentsForExport,
  buildPaymentsExportBuffer,
  buildPaymentsExportDownloadUrl,
  fetchAttendanceForExport,
  buildAttendanceExportBuffer,
  buildAttendanceExportDownloadUrl,
};
