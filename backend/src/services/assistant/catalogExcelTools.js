/**
 * Ask-CRM catalog Excel export tools (leads, quotes, defects, POs, RFQs).
 * In-memory download only — nothing stored on disk or in Mongo.
 */
const {
  fetchLeadsForExport,
  buildLeadsExportDownloadUrl,
  fetchQuotesForExport,
  buildQuotesExportDownloadUrl,
  fetchDefectsForExport,
  buildDefectsExportDownloadUrl,
  fetchPurchaseOrdersForExport,
  buildPurchaseOrdersExportDownloadUrl,
  fetchRfqsForExport,
  buildRfqsExportDownloadUrl,
  stampFilename,
  LEAD_EXPORT_HEADERS,
  QUOTE_EXPORT_HEADERS,
  DEFECT_EXPORT_HEADERS,
  PO_EXPORT_HEADERS,
  RFQ_EXPORT_HEADERS,
} = require("./catalogExcelExport");

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

const downloadHint = (rows, downloadUrl, emptyMsg) =>
  rows.length === 0
    ? emptyMsg
    : `Include this exact markdown link: [Download Excel report](${downloadUrl}). File is generated on click — not stored on the server.`;

async function exportLeadsExcel({
  period = "thisMonth",
  startDate,
  endDate,
  status,
  openOnly,
  limit = 200,
  format = "excel",
} = {}) {
  const cap = Math.min(Math.max(Number(limit) || 200, 1), 500);
  const fmt = String(format || "excel").toLowerCase() === "csv" ? "csv" : "excel";
  const rows = await fetchLeadsForExport({
    period,
    startDate,
    endDate,
    status,
    openOnly,
    limit: cap,
  });
  const downloadUrl = buildLeadsExportDownloadUrl({
    period,
    startDate,
    endDate,
    status,
    openOnly,
    limit: cap,
    format: fmt,
  });
  return {
    rowCount: rows.length,
    columns: LEAD_EXPORT_HEADERS,
    filename: stampFilename("leads", fmt === "csv" ? "csv" : "xls"),
    downloadUrl,
    format: fmt,
    stored: false,
    hint: downloadHint(rows, downloadUrl, "No leads matched. Do not invent a download."),
    preview: rows.slice(0, 5),
  };
}

async function exportQuotesExcel({
  period = "thisMonth",
  startDate,
  endDate,
  status,
  openOnly,
  limit = 200,
  format = "excel",
} = {}) {
  const cap = Math.min(Math.max(Number(limit) || 200, 1), 500);
  const fmt = String(format || "excel").toLowerCase() === "csv" ? "csv" : "excel";
  const rows = await fetchQuotesForExport({
    period,
    startDate,
    endDate,
    status,
    openOnly,
    limit: cap,
  });
  const downloadUrl = buildQuotesExportDownloadUrl({
    period,
    startDate,
    endDate,
    status,
    openOnly,
    limit: cap,
    format: fmt,
  });
  return {
    rowCount: rows.length,
    columns: QUOTE_EXPORT_HEADERS,
    filename: stampFilename("quotes", fmt === "csv" ? "csv" : "xls"),
    downloadUrl,
    format: fmt,
    stored: false,
    hint: downloadHint(rows, downloadUrl, "No quotes matched. Do not invent a download."),
    preview: rows.slice(0, 5),
  };
}

async function exportDefectsExcel({
  period = "all",
  startDate,
  endDate,
  status,
  type,
  openOnly = true,
  limit = 200,
  format = "excel",
} = {}) {
  const cap = Math.min(Math.max(Number(limit) || 200, 1), 500);
  const fmt = String(format || "excel").toLowerCase() === "csv" ? "csv" : "excel";
  const rows = await fetchDefectsForExport({
    period,
    startDate,
    endDate,
    status,
    type,
    openOnly,
    limit: cap,
  });
  const downloadUrl = buildDefectsExportDownloadUrl({
    period,
    startDate,
    endDate,
    status,
    type,
    openOnly,
    limit: cap,
    format: fmt,
  });
  return {
    rowCount: rows.length,
    columns: DEFECT_EXPORT_HEADERS,
    filename: stampFilename("defects-snags", fmt === "csv" ? "csv" : "xls"),
    downloadUrl,
    format: fmt,
    stored: false,
    hint: downloadHint(
      rows,
      downloadUrl,
      "No defects/snags matched. Do not invent a download."
    ),
    preview: rows.slice(0, 5),
  };
}

async function exportPurchaseOrdersExcel({
  period = "thisMonth",
  startDate,
  endDate,
  status,
  limit = 200,
  format = "excel",
} = {}) {
  const cap = Math.min(Math.max(Number(limit) || 200, 1), 500);
  const fmt = String(format || "excel").toLowerCase() === "csv" ? "csv" : "excel";
  const rows = await fetchPurchaseOrdersForExport({
    period,
    startDate,
    endDate,
    status,
    limit: cap,
  });
  const downloadUrl = buildPurchaseOrdersExportDownloadUrl({
    period,
    startDate,
    endDate,
    status,
    limit: cap,
    format: fmt,
  });
  return {
    rowCount: rows.length,
    columns: PO_EXPORT_HEADERS,
    filename: stampFilename("purchase-orders", fmt === "csv" ? "csv" : "xls"),
    downloadUrl,
    format: fmt,
    stored: false,
    hint: downloadHint(rows, downloadUrl, "No purchase orders matched. Do not invent a download."),
    preview: rows.slice(0, 5),
  };
}

async function exportRfqsExcel({
  period = "thisMonth",
  startDate,
  endDate,
  status,
  limit = 200,
  format = "excel",
} = {}) {
  const cap = Math.min(Math.max(Number(limit) || 200, 1), 500);
  const fmt = String(format || "excel").toLowerCase() === "csv" ? "csv" : "excel";
  const rows = await fetchRfqsForExport({
    period,
    startDate,
    endDate,
    status,
    limit: cap,
  });
  const downloadUrl = buildRfqsExportDownloadUrl({
    period,
    startDate,
    endDate,
    status,
    limit: cap,
    format: fmt,
  });
  return {
    rowCount: rows.length,
    columns: RFQ_EXPORT_HEADERS,
    filename: stampFilename("rfqs", fmt === "csv" ? "csv" : "xls"),
    downloadUrl,
    format: fmt,
    stored: false,
    hint: downloadHint(rows, downloadUrl, "No RFQs matched. Do not invent a download."),
    preview: rows.slice(0, 5),
  };
}

const RUNNERS = {
  export_leads_excel: exportLeadsExcel,
  export_quotes_excel: exportQuotesExcel,
  export_defects_excel: exportDefectsExcel,
  export_purchase_orders_excel: exportPurchaseOrdersExcel,
  export_rfqs_excel: exportRfqsExcel,
};

const TOOL_DEFINITIONS = [
  {
    type: "function",
    function: {
      name: "export_leads_excel",
      description:
        "Create downloadable Excel/CSV of sales leads. Returns downloadUrl — do NOT paste rows into chat. File generated on click, not stored.",
      parameters: {
        type: "object",
        properties: {
          period: { type: "string", enum: PERIOD_ENUM },
          status: { type: "string", description: "New, Contacted, Quoted, Lost, Converted, open, or all" },
          openOnly: { type: "boolean" },
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
      name: "export_quotes_excel",
      description:
        "Create downloadable Excel/CSV of quotes. Returns downloadUrl — do NOT paste rows into chat. File generated on click, not stored.",
      parameters: {
        type: "object",
        properties: {
          period: { type: "string", enum: PERIOD_ENUM },
          status: { type: "string", description: "Draft, Sent, Accepted, Rejected, open, or all" },
          openOnly: { type: "boolean" },
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
      name: "export_defects_excel",
      description:
        "Create downloadable Excel/CSV of defects/snags. Returns downloadUrl — do NOT paste rows into chat. File generated on click, not stored.",
      parameters: {
        type: "object",
        properties: {
          period: { type: "string", enum: PERIOD_ENUM },
          status: { type: "string", description: "Open, In Progress, Closed, open, or all" },
          type: { type: "string", description: "Defect, Snag, or all" },
          openOnly: { type: "boolean", description: "Default true = Open/In Progress only" },
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
      name: "export_purchase_orders_excel",
      description:
        "Create downloadable Excel/CSV of purchase orders. Returns downloadUrl — do NOT paste rows into chat. File generated on click, not stored.",
      parameters: {
        type: "object",
        properties: {
          period: { type: "string", enum: PERIOD_ENUM },
          status: {
            type: "string",
            description: "Ordered, Delayed, Partially Received, Received, Cancelled, open, or all",
          },
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
      name: "export_rfqs_excel",
      description:
        "Create downloadable Excel/CSV of RFQs. Returns downloadUrl — do NOT paste rows into chat. File generated on click, not stored.",
      parameters: {
        type: "object",
        properties: {
          period: { type: "string", enum: PERIOD_ENUM },
          status: {
            type: "string",
            description: "Draft, Sent, Responses Received, Awarded, Cancelled, open, or all",
          },
          startDate: { type: "string" },
          endDate: { type: "string" },
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
