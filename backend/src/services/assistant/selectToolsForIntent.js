/**
 * Select a subset of Ask-CRM tools by user intent to stay under Groq TPM limits.
 * Always includes a small core set (search, jobs, digest). Compacts descriptions when sending.
 */
const MAX_TOOL_DESC = 140;
const MAX_PARAM_DESC = 55;

const CORE = [
  "search_crm",
  "list_jobs",
  "get_job_status",
  "get_job_blockers",
  "get_dashboard_overview",
  "weekly_ops_digest",
  "list_overdue_items",
];

const OPS = [
  "get_checkins_summary",
  "list_workers_without_checkins",
  "get_worker_attendance_summary",
  "list_schedule_for_date",
  "who_is_on_site_today",
  "get_jobs_for_worker",
  "list_workers_with_assignments",
  "list_workers_without_assignments",
  "get_assignees_for_job",
  "list_worker_tasks",
  "list_employees",
  "list_leave_requests",
  "list_upcoming_day_offs",
  "get_productivity_summary",
  "get_worker_utilization",
  "list_notifications",
  "list_kanban_tasks",
  "announce_company_day_off",
  "mark_worker_day_off",
  "prepare_worker_email",
];

const STAGES = [
  "list_jobs_by_workflow_stage",
  "list_jobs_awaiting_site_engineer",
  "list_site_engineer_reviews",
  "list_site_measurements",
  "list_planning",
  "list_drafting",
  "list_fabrication_progress",
  "list_fabrication_progress_logs",
  "get_fabrication_hours",
  "list_installation_progress",
  "get_installation_hours",
  "get_installation_summary",
  "list_job_cards",
  "list_job_comments",
  "get_job_timeline",
  "compare_jobs",
  "list_powder_coating",
  "list_defects_snags",
  "list_ncrs",
  "list_qc_pending",
  "list_material_purchases",
];

const FINANCE = [
  "list_pending_invoices",
  "list_invoices",
  "get_invoice_summary",
  "get_job_financials",
  "get_aging_receivables",
  "get_retention_summary",
  "list_payments",
  "list_purchase_orders",
  "list_rfqs",
  "list_suppliers",
  "get_supplier",
  "list_clients",
];

const SALES = [
  "list_leads",
  "list_lead_followups",
  "list_customers",
  "get_customer",
  "list_quotes",
  "get_quote_summary",
  "get_sales_pipeline_summary",
  "list_contact_requests",
  "list_sites",
];

const EXPORT = [
  "export_jobs_excel",
  "export_invoices_excel",
  "export_payments_excel",
  "export_attendance_excel",
  "export_leads_excel",
  "export_quotes_excel",
  "export_defects_excel",
  "export_purchase_orders_excel",
  "export_rfqs_excel",
];

const clip = (s, max) => {
  const t = String(s || "").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trim()}…`;
};

function compactToolDefs(defs) {
  return (defs || []).map((def) => {
    const fn = def.function || {};
    const params = fn.parameters || {};
    const props = params.properties || {};
    const nextProps = {};
    Object.entries(props).forEach(([key, schema]) => {
      nextProps[key] = {
        ...schema,
        ...(schema.description
          ? { description: clip(schema.description, MAX_PARAM_DESC) }
          : {}),
      };
    });
    return {
      type: "function",
      function: {
        name: fn.name,
        description: clip(fn.description || fn.name, MAX_TOOL_DESC),
        parameters: {
          ...params,
          properties: nextProps,
        },
      },
    };
  });
}

function matchAny(text, patterns) {
  return patterns.some((p) => p.test(text));
}

/**
 * Pick tool names for this user turn.
 */
function selectToolNames(userText = "") {
  const t = String(userText || "").toLowerCase();
  const names = new Set(CORE);

  const wantExport = matchAny(t, [
    /\bexcel\b/,
    /\bspreadsheet\b/,
    /\bexport\b/,
    /\bdownload\b/,
    /\breport\b/,
    /\bcsv\b/,
  ]);
  const wantOps = matchAny(t, [
    /\bon\s*site\b/,
    /\bcheck[- ]?in/,
    /\battendance\b/,
    /\bschedule\b/,
    /\bworker\b/,
    /\bemployee\b/,
    /\bleave\b/,
    /\bday\s*off\b/,
    /\bholiday\b/,
    /\bemail\b/,
    /\bmail\b/,
    /\bnotify\b/,
    /\butilization\b/,
    /\bproductivity\b/,
    /\bhours?\b/,
    /\bkanban\b/,
    /\bnotification/,
    /\bwho\s+is\b/,
    /\broom\b/,
    /\broster\b/,
  ]);
  const wantStages = matchAny(t, [
    /\bstage\b/,
    /\bfabricat/,
    /\binstall/,
    /\bdraft/,
    /\bplanning\b/,
    /\bmeasurement\b/,
    /\bsite\s*engineer\b/,
    /\bse\b/,
    /\bjob\s*card\b/,
    /\bcomment\b/,
    /\btimeline\b/,
    /\bhistory\b/,
    /\bprogress\b/,
    /\bpowder\b/,
    /\bdefect\b/,
    /\bsnag\b/,
    /\bncr\b/,
    /\bqc\b/,
    /\bmaterial\b/,
    /\bblocker\b/,
    /\bcompare\b/,
    /\bworkflow\b/,
  ]);
  const wantFinance = matchAny(t, [
    /\binvoice\b/,
    /\bpayment\b/,
    /\bpaid\b/,
    /\bunpaid\b/,
    /\boutstanding\b/,
    /\boverdue\b/,
    /\bbill\b/,
    /\baging\b/,
    /\bretention\b/,
    /\bpo\b/,
    /\bpurchase\s*order\b/,
    /\brfq\b/,
    /\bsupplier\b/,
    /\bcontract\b/,
    /\bfinancial\b/,
    /\bmoney\b/,
    /\bamount\b/,
    /\breceivable/,
  ]);
  const wantSales = matchAny(t, [
    /\blead\b/,
    /\bfollow\s*up\b/,
    /\bquote\b/,
    /\bcustomer\b/,
    /\bpipeline\b/,
    /\bsales\b/,
    /\bcontact\s*request\b/,
    /\bsite\b/,
    /\bclient\b/,
  ]);
  const wantDigest = matchAny(t, [
    /\bdigest\b/,
    /\bbrief\b/,
    /\boverview\b/,
    /\bsummary\b/,
    /\bwhat'?s\s+going\s+on\b/,
    /\btoday\b/,
    /\bthis\s+week\b/,
  ]);

  if (wantExport) EXPORT.forEach((n) => names.add(n));
  if (wantOps) OPS.forEach((n) => names.add(n));
  if (wantStages) STAGES.forEach((n) => names.add(n));
  if (wantFinance) FINANCE.forEach((n) => names.add(n));
  if (wantSales) SALES.forEach((n) => names.add(n));
  if (wantDigest) {
    OPS.slice(0, 8).forEach((n) => names.add(n));
    FINANCE.slice(0, 6).forEach((n) => names.add(n));
  }

  // Search-like: light coverage from each area (not full catalogs).
  // Vague / no-domain stays CORE-only (~7 tools) for speed.
  const wantSearch = matchAny(t, [
    /\bfind\b/,
    /\bsearch\b/,
    /\blookup\b/,
    /\blook\s+up\b/,
    /\bwhere\s+is\b/,
    /\bshow\s+me\b/,
  ]);

  if (wantSearch) {
    [
      ...OPS.slice(0, 6),
      ...STAGES.slice(0, 6),
      ...FINANCE.slice(0, 5),
      ...SALES.slice(0, 5),
    ].forEach((n) => names.add(n));
  }

  return [...names];
}

function selectToolsForMessage(allDefs, userText) {
  const wanted = new Set(selectToolNames(userText));
  const selected = (allDefs || []).filter((d) => wanted.has(d.function?.name));
  // Safety: if filter somehow empty, fall back to core-compacted all is too big — use CORE only
  const defs =
    selected.length > 0
      ? selected
      : (allDefs || []).filter((d) => CORE.includes(d.function?.name));
  return compactToolDefs(defs);
}

module.exports = {
  selectToolsForMessage,
  selectToolNames,
  compactToolDefs,
  CORE,
};
