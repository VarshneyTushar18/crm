/**
 * Unified CRM search tool — one query across multiple modules.
 * Wired into tools.js RUNNERS + TOOL_DEFINITIONS.
 */
const Job = require("../../models/appModels/Job");
const Lead = require("../../models/appModels/Lead");
const Customer = require("../../models/appModels/Customer");
const Invoice = require("../../models/appModels/Invoice");
const PurchaseOrder = require("../../models/appModels/PurchaseOrder");
const Quote = require("../../models/appModels/Quote");
const Supplier = require("../../models/appModels/Supplier");
const Site = require("../../models/appModels/Site");
const Employee = require("../../models/appModels/Employee");
const Rfq = require("../../models/appModels/Rfq");

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const MODULES = [
  "jobs",
  "leads",
  "customers",
  "invoices",
  "purchase_orders",
  "quotes",
  "suppliers",
  "sites",
  "employees",
  "rfqs",
];

const jobLink = (job) => {
  if (!job?._id) return {};
  return {
    jobMongoId: String(job._id),
    jobCode: job.jobId || "",
    url: `/admin/job/${job._id}`,
  };
};

const capPer = (limit, def = 8, max = 20) =>
  Math.min(Math.max(Number(limit) || def, 1), max);

function parseModules(modules) {
  if (!modules) return [...MODULES];
  const raw = Array.isArray(modules)
    ? modules
    : String(modules)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
  const normalized = raw
    .map((m) => String(m).trim().toLowerCase().replace(/\s+/g, "_"))
    .map((m) => {
      if (m === "pos" || m === "po" || m === "purchaseorders") return "purchase_orders";
      if (m === "job") return "jobs";
      if (m === "lead") return "leads";
      if (m === "customer") return "customers";
      if (m === "invoice") return "invoices";
      if (m === "quote") return "quotes";
      if (m === "supplier") return "suppliers";
      if (m === "site") return "sites";
      if (m === "employee" || m === "workers" || m === "worker") return "employees";
      if (m === "rfq") return "rfqs";
      return m;
    })
    .filter((m) => MODULES.includes(m));
  return normalized.length ? [...new Set(normalized)] : [...MODULES];
}

async function searchJobs(rx, q, limit) {
  const filter = {
    removed: { $ne: true },
    $or: [{ jobId: rx }, { customer: rx }, { site: rx }],
  };
  const [total, rows] = await Promise.all([
    Job.countDocuments(filter),
    Job.find(filter)
      .select("_id jobId customer site systemState stage lockedValue")
      .sort({ updatedAt: -1 })
      .limit(limit)
      .lean(),
  ]);
  return {
    total,
    items: rows.map((j) => ({
      type: "job",
      label: j.jobId || String(j._id),
      subtitle: [j.customer, j.site].filter(Boolean).join(" · "),
      status: j.systemState || j.stage || "",
      lockedValue: Number(j.lockedValue || 0),
      ...jobLink(j),
      matchedOn: "jobId/customer/site",
    })),
  };
}

async function searchLeads(rx, limit) {
  const filter = {
    $or: [
      { clientName: rx },
      { contactPerson: rx },
      { phone: rx },
      { email: rx },
      { siteAddress: rx },
      { assignedSalesperson: rx },
    ],
  };
  const [total, rows] = await Promise.all([
    Lead.countDocuments(filter),
    Lead.find(filter)
      .select("clientName contactPerson phone email siteAddress status assignedSalesperson")
      .sort({ updatedAt: -1 })
      .limit(limit)
      .lean(),
  ]);
  return {
    total,
    items: rows.map((l) => ({
      type: "lead",
      id: String(l._id),
      label: l.clientName || "",
      subtitle: [l.contactPerson, l.phone, l.siteAddress].filter(Boolean).join(" · "),
      status: l.status || "",
      assignedSalesperson: l.assignedSalesperson || "",
      url: `/admin/leads`,
      matchedOn: "client/contact/phone/email/site",
    })),
  };
}

async function searchCustomers(rx, limit) {
  const filter = {
    $or: [
      { name: rx },
      { companyName: rx },
      { email: rx },
      { portalEmail: rx },
      { phone: rx },
      { mobile: rx },
      { contactPerson: rx },
      { "contacts.name": rx },
      { "contacts.email": rx },
      { "contacts.phone": rx },
      { "phones.number": rx },
    ],
  };
  const [total, rows] = await Promise.all([
    Customer.countDocuments(filter),
    Customer.find(filter)
      .select("name companyName email phone mobile contactPerson status")
      .sort({ updatedAt: -1 })
      .limit(limit)
      .lean(),
  ]);
  return {
    total,
    items: rows.map((c) => ({
      type: "customer",
      id: String(c._id),
      label: c.name || c.companyName || "",
      subtitle: [c.companyName || c.contactPerson, c.email, c.phone || c.mobile]
        .filter(Boolean)
        .join(" · "),
      status: c.status || "",
      url: `/admin/customer`,
      matchedOn: "name/company/email/phone",
    })),
  };
}

async function searchInvoices(rx, limit) {
  const filter = {
    removed: { $ne: true },
    $or: [{ number: rx }],
  };

  // Also match invoices whose linked job customer/code matches
  const jobs = await Job.find({
    removed: { $ne: true },
    $or: [{ jobId: rx }, { customer: rx }, { site: rx }],
  })
    .select("_id")
    .limit(40)
    .lean();
  if (jobs.length) {
    filter.$or.push({ job: { $in: jobs.map((j) => j._id) } });
  }

  const [total, rows] = await Promise.all([
    Invoice.countDocuments(filter),
    Invoice.find(filter)
      .select("number status total amountDue date job currency")
      .populate({ path: "job", select: "_id jobId customer" })
      .sort({ date: -1 })
      .limit(limit)
      .lean(),
  ]);
  return {
    total,
    items: rows.map((inv) => ({
      type: "invoice",
      id: String(inv._id),
      label: inv.number || "",
      subtitle: [inv.job?.jobId, inv.job?.customer, inv.status]
        .filter(Boolean)
        .join(" · "),
      status: inv.status || "",
      total: inv.total,
      amountDue: inv.amountDue,
      ...jobLink(inv.job),
      url: `/admin/invoice`,
      matchedOn: "number/job",
    })),
  };
}

async function searchPurchaseOrders(rx, limit) {
  const jobMatches = await Job.find({
    removed: { $ne: true },
    $or: [{ jobId: rx }, { customer: rx }, { site: rx }],
  })
    .select("_id")
    .limit(40)
    .lean();

  const filter = {
    $or: [{ poNumber: rx }],
  };
  if (jobMatches.length) {
    filter.$or.push({ jobId: { $in: jobMatches.map((j) => j._id) } });
  }

  const [total, rows] = await Promise.all([
    PurchaseOrder.countDocuments(filter),
    PurchaseOrder.find(filter)
      .select("poNumber status expectedDelivery jobId supplierId orderedAt")
      .populate({ path: "supplierId", select: "name" })
      .sort({ orderedAt: -1 })
      .limit(limit)
      .lean(),
  ]);

  const jobMap = {};
  const jobIds = rows.map((r) => r.jobId).filter(Boolean);
  if (jobIds.length) {
    const jobs = await Job.find({ _id: { $in: jobIds } })
      .select("_id jobId customer")
      .lean();
    jobs.forEach((j) => {
      jobMap[String(j._id)] = j;
    });
  }

  return {
    total,
    items: rows.map((p) => {
      const job = jobMap[String(p.jobId)] || null;
      return {
        type: "purchase_order",
        id: String(p._id),
        label: p.poNumber || "",
        subtitle: [p.supplierId?.name, job?.jobId, p.status].filter(Boolean).join(" · "),
        status: p.status || "",
        expectedDelivery: p.expectedDelivery || "",
        ...jobLink(job),
        url: `/admin/purchase-order`,
        matchedOn: "poNumber/job",
      };
    }),
  };
}

async function searchQuotes(rx, limit) {
  const filter = {
    removed: { $ne: true },
    $or: [
      { quoteNumber: rx },
      { customerName: rx },
      { contactPerson: rx },
      { phone: rx },
      { email: rx },
      { siteAddress: rx },
    ],
  };
  const [total, rows] = await Promise.all([
    Quote.countDocuments(filter),
    Quote.find(filter)
      .select("quoteNumber customerName contactPerson status totalAmount siteAddress")
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean(),
  ]);
  return {
    total,
    items: rows.map((q) => ({
      type: "quote",
      id: String(q._id),
      label: q.quoteNumber || q.customerName || "",
      subtitle: [q.customerName, q.status, q.siteAddress].filter(Boolean).join(" · "),
      status: q.status || "",
      totalAmount: q.totalAmount,
      url: `/admin/quote`,
      matchedOn: "quoteNumber/customer/site",
    })),
  };
}

async function searchSuppliers(rx, limit) {
  const filter = {
    $or: [{ name: rx }, { contactPerson: rx }, { email: rx }, { phone: rx }],
  };
  const [total, rows] = await Promise.all([
    Supplier.countDocuments(filter),
    Supplier.find(filter)
      .select("name contactPerson email phone isActive")
      .sort({ name: 1 })
      .limit(limit)
      .lean(),
  ]);
  return {
    total,
    items: rows.map((s) => ({
      type: "supplier",
      id: String(s._id),
      label: s.name || "",
      subtitle: [s.contactPerson, s.email, s.phone].filter(Boolean).join(" · "),
      status: s.isActive === false ? "Inactive" : "Active",
      url: `/admin/suppliers`,
      matchedOn: "name/contact/email/phone",
    })),
  };
}

async function searchSites(rx, limit) {
  const filter = {
    $or: [{ name: rx }, { code: rx }, { city: rx }, { address: rx }],
  };
  const [total, rows] = await Promise.all([
    Site.countDocuments(filter),
    Site.find(filter)
      .select("name code city address isActive")
      .sort({ name: 1 })
      .limit(limit)
      .lean(),
  ]);
  return {
    total,
    items: rows.map((s) => ({
      type: "site",
      id: String(s._id),
      label: s.name || s.code || "",
      subtitle: [s.code, s.city, s.address].filter(Boolean).join(" · "),
      status: s.isActive === false ? "Inactive" : "Active",
      url: `/admin/sites`,
      matchedOn: "name/code/city/address",
    })),
  };
}

async function searchEmployees(rx, limit) {
  const filter = {
    $or: [
      { name: rx },
      { employeeId: rx },
      { email: rx },
      { phone: rx },
      { designation: rx },
      { department: rx },
    ],
  };
  const [total, rows] = await Promise.all([
    Employee.countDocuments(filter),
    Employee.find(filter)
      .select("name employeeId email phone designation department status")
      .sort({ name: 1 })
      .limit(limit)
      .lean(),
  ]);
  return {
    total,
    items: rows.map((e) => ({
      type: "employee",
      id: String(e._id),
      label: e.name || e.employeeId || "",
      subtitle: [e.employeeId, e.designation, e.department, e.email]
        .filter(Boolean)
        .join(" · "),
      status: e.status || "",
      url: `/admin/employee`,
      matchedOn: "name/employeeId/email/phone",
    })),
  };
}

async function searchRfqs(rx, limit) {
  const jobMatches = await Job.find({
    removed: { $ne: true },
    $or: [{ jobId: rx }, { customer: rx }, { site: rx }],
  })
    .select("_id")
    .limit(40)
    .lean();

  const filter = {
    $or: [{ rfqNumber: rx }, { title: rx }],
  };
  if (jobMatches.length) {
    filter.$or.push({ jobId: { $in: jobMatches.map((j) => j._id) } });
  }

  const [total, rows] = await Promise.all([
    Rfq.countDocuments(filter),
    Rfq.find(filter)
      .select("rfqNumber title status jobId sentAt")
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean(),
  ]);

  const jobMap = {};
  const jobIds = rows.map((r) => r.jobId).filter(Boolean);
  if (jobIds.length) {
    const jobs = await Job.find({ _id: { $in: jobIds } })
      .select("_id jobId customer")
      .lean();
    jobs.forEach((j) => {
      jobMap[String(j._id)] = j;
    });
  }

  return {
    total,
    items: rows.map((r) => {
      const job = jobMap[String(r.jobId)] || null;
      return {
        type: "rfq",
        id: String(r._id),
        label: r.rfqNumber || r.title || "",
        subtitle: [r.title, job?.jobId, r.status].filter(Boolean).join(" · "),
        status: r.status || "",
        ...jobLink(job),
        url: `/admin/rfq`,
        matchedOn: "rfqNumber/title/job",
      };
    }),
  };
}

async function searchCrm({ query, modules, limitPerModule = 8 } = {}) {
  const q = String(query || "").trim();
  if (!q || q.length < 2) {
    return {
      error: "query is required (at least 2 characters).",
      hint: 'Example: search_crm with query="metro"',
    };
  }

  const per = capPer(limitPerModule, 8, 20);
  const mods = parseModules(modules);
  const rx = new RegExp(escapeRegex(q), "i");

  const runners = {
    jobs: () => searchJobs(rx, q, per),
    leads: () => searchLeads(rx, per),
    customers: () => searchCustomers(rx, per),
    invoices: () => searchInvoices(rx, per),
    purchase_orders: () => searchPurchaseOrders(rx, per),
    quotes: () => searchQuotes(rx, per),
    suppliers: () => searchSuppliers(rx, per),
    sites: () => searchSites(rx, per),
    employees: () => searchEmployees(rx, per),
    rfqs: () => searchRfqs(rx, per),
  };

  const results = {};
  const settled = await Promise.all(
    mods.map(async (m) => {
      try {
        const data = await runners[m]();
        return [m, data];
      } catch (err) {
        return [m, { total: 0, items: [], error: err.message }];
      }
    })
  );

  let grandTotal = 0;
  settled.forEach(([m, data]) => {
    results[m] = data;
    grandTotal += Number(data.total || 0);
  });

  const topHits = [];
  settled.forEach(([m, data]) => {
    (data.items || []).slice(0, 3).forEach((item) => {
      topHits.push({ module: m, ...item });
    });
  });

  return {
    query: q,
    modulesSearched: mods,
    totalMatches: grandTotal,
    results,
    topHits: topHits.slice(0, 20),
    hint:
      grandTotal === 0
        ? "No matches. Try a shorter keyword (e.g. metro) or a different spelling."
        : "Summarize by module. Prefer markdown links using each item's url / job url fields. If many hits, ask which module or record the admin means.",
  };
}

const RUNNERS = {
  search_crm: searchCrm,
};

const TOOL_DEFINITIONS = [
  {
    type: "function",
    function: {
      name: "search_crm",
      description:
        "Unified search across CRM modules (jobs, leads, customers, invoices, purchase orders, quotes, suppliers, sites, employees, RFQs). Use when the admin says find/search/lookup something without specifying the module, or when a nickname might exist in several places (e.g. 'metro'). Prefer this over calling many list_* tools one-by-one for a vague search.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search text (job code, customer, phone, invoice/PO number, name, etc.)",
          },
          modules: {
            type: "string",
            description:
              "Optional comma-separated subset: jobs,leads,customers,invoices,purchase_orders,quotes,suppliers,sites,employees,rfqs. Default = all.",
          },
          limitPerModule: {
            type: "number",
            description: "Max hits per module (default 8, max 20)",
          },
        },
        required: ["query"],
      },
    },
  },
];

module.exports = {
  RUNNERS,
  TOOL_DEFINITIONS,
};
