const Job = require("../../models/appModels/Job");
const Customer = require("../../models/appModels/Customer");
const {
  STAGE_LABELS,
  ensureV3WorkflowEvents,
  getWorkflowStageKeys,
} = require("../../utils/workflowDefaults");

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

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
  "excel",
  "report",
  "export",
  "latest",
  "their",
  "stages",
  "stage",
]);

const tokenizeJobSearch = (input) => {
  const raw = String(input || "")
    .trim()
    .toLowerCase();
  if (!raw) return [];
  return [
    ...new Set(
      raw
        .split(/[^a-z0-9]+/i)
        .map((t) => t.trim())
        .filter((t) => t.length >= 2 && !JOB_SEARCH_STOPWORDS.has(t))
    ),
  ];
};

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
  const customers = await Customer.find({ $or: or }).select("_id").limit(40).lean();
  return customers.map((c) => c._id);
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

const htmlEscape = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const csvEscape = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;

const EXPORT_HEADERS = [
  "Job ID",
  "Customer",
  "Site",
  "System State",
  "Current Stage",
  "Stage Status",
  "On Hold",
  "Contract (lockedValue)",
  "Updated At",
];

/**
 * Load jobs for export (read-only). Nothing is written to disk or Mongo.
 */
async function fetchJobsForExport({ systemState, search, limit = 50 } = {}) {
  const cap = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const filter = { removed: { $ne: true } };
  if (systemState) {
    filter.systemState = systemState;
  }

  const q = search && String(search).trim() ? String(search).trim() : "";
  if (q) {
    const textOr = buildJobTextSearchOr(q);
    const customerIds = await findCustomerIdsForJobSearch(q);
    filter.$or = [...textOr];
    if (customerIds.length) {
      filter.$or.push({ customerId: { $in: customerIds } });
    }
  }

  const jobs = await Job.find(filter)
    .select(
      "jobId customer site systemState stage conditions.onHold lockedValue workflowEvents workflowVersion updatedAt"
    )
    .sort({ updatedAt: -1 })
    .limit(cap)
    .lean();

  return jobs.map((job) => {
    const currentKey = getCurrentWorkflowStage(job);
    const wf = ensureV3WorkflowEvents(job.workflowEvents || {});
    const stageData = wf[currentKey] || {};
    return {
      jobId: job.jobId || "",
      customer: job.customer || "",
      site: job.site || "",
      systemState: job.systemState || "",
      currentStage: STAGE_LABELS[currentKey] || currentKey,
      stageStatus: stageData.stageStatus || "Pending",
      onHold: job.conditions?.onHold ? "Yes" : "No",
      lockedValue: Number(job.lockedValue || 0),
      updatedAt: job.updatedAt ? new Date(job.updatedAt).toISOString() : "",
    };
  });
}

function buildExcelHtmlBuffer(rows) {
  let table =
    '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"></head><body><table border="1"><thead><tr>';
  EXPORT_HEADERS.forEach((h) => {
    table += `<th>${htmlEscape(h)}</th>`;
  });
  table += "</tr></thead><tbody>";
  rows.forEach((r) => {
    const cells = [
      r.jobId,
      r.customer,
      r.site,
      r.systemState,
      r.currentStage,
      r.stageStatus,
      r.onHold,
      r.lockedValue,
      r.updatedAt,
    ];
    table += "<tr>";
    cells.forEach((cell) => {
      table += `<td>${htmlEscape(cell)}</td>`;
    });
    table += "</tr>";
  });
  table += "</tbody></table></body></html>";
  return Buffer.from(`\ufeff${table}`, "utf8");
}

function buildCsvBuffer(rows) {
  const lines = [
    EXPORT_HEADERS.map(csvEscape).join(","),
    ...rows.map((r) =>
      [
        r.jobId,
        r.customer,
        r.site,
        r.systemState,
        r.currentStage,
        r.stageStatus,
        r.onHold,
        r.lockedValue,
        r.updatedAt,
      ]
        .map(csvEscape)
        .join(",")
    ),
  ];
  return Buffer.from(`\ufeff${lines.join("\n")}`, "utf8");
}

function buildJobsExportBuffer(rows, format = "excel") {
  const fmt = String(format || "excel").toLowerCase();
  if (fmt === "csv") {
    return {
      buffer: buildCsvBuffer(rows),
      contentType: "text/csv; charset=utf-8",
      extension: "csv",
    };
  }
  return {
    buffer: buildExcelHtmlBuffer(rows),
    contentType: "application/vnd.ms-excel; charset=utf-8",
    extension: "xls",
  };
}

function stampFilename(prefix, extension) {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
  return `${prefix}-${stamp}.${extension}`;
}

/**
 * Build a relative API download path (no file stored). Frontend prepends API_BASE_URL.
 */
function buildJobsExportDownloadUrl({ limit, systemState, search, format = "excel" } = {}) {
  const params = new URLSearchParams();
  if (limit) params.set("limit", String(limit));
  if (systemState) params.set("systemState", String(systemState));
  if (search) params.set("search", String(search));
  params.set("format", format === "csv" ? "csv" : "excel");
  const qs = params.toString();
  return `/assistant/exports/jobs${qs ? `?${qs}` : ""}`;
}

module.exports = {
  fetchJobsForExport,
  buildJobsExportBuffer,
  stampFilename,
  buildJobsExportDownloadUrl,
  EXPORT_HEADERS,
};
