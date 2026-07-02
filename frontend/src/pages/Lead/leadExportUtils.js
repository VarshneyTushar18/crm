import dayjs from "dayjs";
import { formatLeadAddress, getLeadAddresses, getLeadSiteAddress } from "./leadAddressUtils";

const csvEscape = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;

const htmlEscape = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export const LEAD_EXPORT_FORMATS = [
  { key: "csv", label: "CSV (.csv)" },
  { key: "excel", label: "Excel (.xls)" },
  { key: "pdf", label: "PDF (Print)" },
];

export function getLeadPhonesList(lead) {
  const fromList = Array.isArray(lead?.phones)
    ? lead.phones.filter((p) => p?.number)
    : [];
  if (fromList.length) return fromList;
  if (lead?.phone) {
    return [{ label: "Primary", number: lead.phone, isPrimary: true }];
  }
  return [];
}

export function buildLeadExportRow(lead) {
  const phones = getLeadPhonesList(lead);
  const addresses = getLeadAddresses(lead);

  return [
    lead.clientName || "",
    lead.contactPerson || "",
    lead.phone || "",
    phones.map((p) => `${p.label}: ${p.number}`).join(" | "),
    lead.email || "",
    getLeadSiteAddress(lead) || "",
    addresses.map((a) => `${a.type}: ${formatLeadAddress(a)}`).join(" | "),
    lead.category || "",
    lead.assignedSalesperson || "",
    lead.nextFollowUpDate ? dayjs(lead.nextFollowUpDate).format("DD MMM YYYY") : "",
    lead.leadSource || "",
    lead.status || "",
    lead.notes || "",
    lead.createdAt ? dayjs(lead.createdAt).format("DD MMM YYYY HH:mm") : "",
    lead.updatedAt ? dayjs(lead.updatedAt).format("DD MMM YYYY HH:mm") : "",
  ];
}

export const LEAD_EXPORT_HEADERS = [
  "Client Name",
  "Contact Person",
  "Primary Phone",
  "All Phones",
  "Email",
  "Job Location",
  "All Addresses",
  "Category",
  "Salesperson",
  "Next Follow Up",
  "Lead Source",
  "Status",
  "Notes",
  "Created Date",
  "Updated Date",
];

export function filterLeadsByDateRange(
  leads = [],
  range = null,
  dateField = "createdAt"
) {
  if (!range || !range[0] || !range[1]) return leads;

  const from = dayjs(range[0]).startOf("day");
  const to = dayjs(range[1]).endOf("day");

  return leads.filter((lead) => {
    const raw = lead?.[dateField];
    if (!raw) return false;
    const value = dayjs(raw);
    return (
      (value.isAfter(from) || value.isSame(from)) &&
      (value.isBefore(to) || value.isSame(to))
    );
  });
}

function sortLeadsByDate(leads = []) {
  return [...leads].sort((a, b) => {
    const aDate = new Date(a?.createdAt || 0).getTime();
    const bDate = new Date(b?.createdAt || 0).getTime();
    return bDate - aDate;
  });
}

function buildExportFilename(prefix, rangeLabel, extension) {
  const suffix = rangeLabel ? `-${rangeLabel}` : `-${dayjs().format("YYYYMMDD-HHmm")}`;
  return `${prefix}${suffix}.${extension}`;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function prepareExportTable(leads = []) {
  const sorted = sortLeadsByDate(leads);
  return {
    headers: LEAD_EXPORT_HEADERS,
    rows: sorted.map((lead) => buildLeadExportRow(lead)),
    sorted,
  };
}

export function exportLeadsToCsv(leads = [], filenamePrefix = "leads", rangeLabel = "") {
  const { headers, rows } = prepareExportTable(leads);
  const csv = [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  downloadBlob(blob, buildExportFilename(filenamePrefix, rangeLabel, "csv"));
}

function exportLeadsToExcel(leads, filenamePrefix, rangeLabel) {
  const { headers, rows } = prepareExportTable(leads);
  let table =
    '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"></head><body><table border="1"><thead><tr>';
  headers.forEach((h) => {
    table += `<th>${htmlEscape(h)}</th>`;
  });
  table += "</tr></thead><tbody>";
  rows.forEach((row) => {
    table += "<tr>";
    row.forEach((cell) => {
      table += `<td>${htmlEscape(cell)}</td>`;
    });
    table += "</tr>";
  });
  table += "</tbody></table></body></html>";

  const blob = new Blob(["\ufeff", table], {
    type: "application/vnd.ms-excel;charset=utf-8;",
  });
  downloadBlob(blob, buildExportFilename(filenamePrefix, rangeLabel, "xls"));
}

function exportLeadsToPdf(leads, filenamePrefix, rangeLabel) {
  const { headers, rows } = prepareExportTable(leads);
  const title = `Leads Export${rangeLabel ? ` (${rangeLabel})` : ""}`;

  let tableRows = "";
  rows.forEach((row) => {
    tableRows += "<tr>";
    row.forEach((cell) => {
      tableRows += `<td style="border:1px solid #ccc;padding:6px;font-size:11px;">${htmlEscape(cell)}</td>`;
    });
    tableRows += "</tr>";
  });

  let headerCells = "";
  headers.forEach((h) => {
    headerCells += `<th style="border:1px solid #ccc;padding:6px;background:#f5f5f5;font-size:11px;">${htmlEscape(h)}</th>`;
  });

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>${htmlEscape(title)}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 24px; }
    h1 { font-size: 18px; margin-bottom: 8px; }
    p { color: #666; margin-bottom: 16px; }
    table { border-collapse: collapse; width: 100%; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <h1>${htmlEscape(title)}</h1>
  <p>Generated on ${dayjs().format("DD MMM YYYY HH:mm")} — ${rows.length} record(s)</p>
  <table>
    <thead><tr>${headerCells}</tr></thead>
    <tbody>${tableRows}</tbody>
  </table>
  <script>window.onload = () => { window.print(); };</script>
</body>
</html>`;

  const blob = new Blob([html], { type: "text/html;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank", "noopener,noreferrer");
  if (!win) {
    downloadBlob(blob, buildExportFilename(filenamePrefix, rangeLabel, "html"));
  }
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export function exportLeads(leads = [], format = "csv", filenamePrefix = "leads", rangeLabel = "") {
  switch (format) {
    case "excel":
      exportLeadsToExcel(leads, filenamePrefix, rangeLabel);
      break;
    case "pdf":
      exportLeadsToPdf(leads, filenamePrefix, rangeLabel);
      break;
    case "csv":
    default:
      exportLeadsToCsv(leads, filenamePrefix, rangeLabel);
      break;
  }
}

export function buildLeadRangeLabel(dateRange) {
  if (dateRange?.[0] && dateRange?.[1]) {
    return `${dayjs(dateRange[0]).format("YYYYMMDD")}-to-${dayjs(dateRange[1]).format("YYYYMMDD")}`;
  }
  return dayjs().format("YYYYMMDD-HHmm");
}
