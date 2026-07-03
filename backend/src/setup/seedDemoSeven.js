const mongoose = require("mongoose");

const Job = require("../models/appModels/Job");
const Lead = require("../models/appModels/Lead");
const Customer = require("../models/appModels/Customer");
const Quote = require("../models/appModels/Quote");
const Client = require("../models/appModels/Client");
const SiteMeasurement = require("../models/appModels/SiteMeasurement");
const Planning = require("../models/appModels/Planning");
const Drafting = require("../models/appModels/Drafting");
const KanbanTask = require("../models/appModels/KanbanTask");
const MaterialPurchase = require("../models/appModels/MaterialPurchase");
const Fabrication = require("../models/appModels/Fabrication");
const Qc = require("../models/appModels/Qc");
const Installation = require("../models/appModels/Installation");
const InstallationSummary = require("../models/appModels/InstallationSummary");
const Invoice = require("../models/appModels/Invoice");
const Payment = require("../models/appModels/Payment");
const Attendance = require("../models/appModels/Attendance");
const Contact = require("../models/appModels/Contact");
const Notification = require("../models/appModels/Notification");
const SiteEngineerReview = require("../models/appModels/SiteEngineerReview");
const ScheduleAssignment = require("../models/appModels/ScheduleAssignment");
const JobComment = require("../models/appModels/JobComment");
const Leave = require("../models/appModels/Leave");
const Rfq = require("../models/appModels/Rfq");
const PurchaseOrder = require("../models/appModels/PurchaseOrder");
const Supplier = require("../models/appModels/Supplier");
const Site = require("../models/appModels/Site");
const Taxes = require("../models/appModels/Taxes");
const PaymentMode = require("../models/appModels/PaymentMode");
const Admin = require("../models/coreModels/Admin");
const User = require("../models/appModels/User");

const {
  buildDefaultWorkflowEvents,
  WORKFLOW_STAGE_KEYS_V3,
} = require("../utils/workflowDefaults");

const DEMO_PREFIX = "DEMO-7";
const INVOICE_STAGE_MAP = {
  siteMeasurement: "siteMeasurement",
  planning: "siteMeasurement",
  scheduling: "drafting",
  drafting: "drafting",
  materialPurchasing: "materialPurchasing",
  fabrication: "fabrication",
  fabricationQc: "finishing",
  powderCoating: "finishing",
  powderCoatingQc: "finishing",
  installation: "installation",
  jobCompletion: "jobCompletion",
};
const DEMO_MARKER_JOB_ID = `${DEMO_PREFIX}-J-001`;

function mapMaterialCode(balustradeType = "") {
  const map = {
    "Glass Panel": "Glass",
    Glass: "Glass",
    "Stainless Steel": "Stainless Steel",
    Aluminium: "Aluminium",
  };
  return map[balustradeType] || "Other";
}

function daysFromNow(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

function formatDDMMYYYY(date = new Date()) {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

function stageDone(by = "Demo Seed", seStatus = "Approved") {
  return {
    isCompleted: true,
    moduleWorkComplete: true,
    stageStatus: "Complete",
    completedBy: by,
    completedAt: daysFromNow(-5),
    siteEngineerStatus: seStatus,
    ...(seStatus === "Approved"
      ? { siteEngineerCheckedBy: "Site Engineer", siteEngineerCheckedAt: daysFromNow(-4) }
      : {}),
  };
}

function stagePendingSE(by = "Demo Seed") {
  return {
    ...stageDone(by, "Pending"),
    siteEngineerStatus: "Pending",
  };
}

function stageInProgress() {
  return {
    isCompleted: false,
    moduleWorkComplete: false,
    stageStatus: "In Progress",
    siteEngineerStatus: "NotRequired",
  };
}

/** Mark all workflow stages before `currentKey` as complete; current stage is in progress. */
function buildWorkflowSnapshot(currentKey, options = {}) {
  const wf = buildDefaultWorkflowEvents(3);
  const keys = WORKFLOW_STAGE_KEYS_V3.filter((k) => k !== "siteEngineerApproval");
  const currentIdx = keys.indexOf(currentKey);

  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    if (i < currentIdx) {
      const se = options.sePendingOn?.includes(key) ? "Pending" : "Approved";
      wf[key] = { ...wf[key], ...stageDone("Demo Seed", se) };
    } else if (i === currentIdx) {
      wf[key] = { ...wf[key], ...stageInProgress() };
    }
  }

  if (options.sePendingOn?.length || keys.slice(0, currentIdx).some((k) => options.sePendingOn?.includes(k))) {
    wf.siteEngineerApproval = {
      ...wf.siteEngineerApproval,
      stageStatus: "In Progress",
      isCompleted: false,
    };
  }

  return wf;
}

async function ensureErpBasics() {
  let tax = await Taxes.findOne({ removed: false });
  if (!tax) {
    tax = await Taxes.create({ taxName: "GST 10%", taxValue: 10, isDefault: true });
  }

  let paymentMode = await PaymentMode.findOne({ removed: false });
  if (!paymentMode) {
    paymentMode = await PaymentMode.create({
      name: "Bank Transfer",
      description: "Direct bank transfer",
      isDefault: true,
    });
  }

  let admin = await Admin.findOne({ email: "admin@crm.com" });
  if (!admin) {
    admin = await Admin.create({
      email: "admin@crm.com",
      name: "System",
      surname: "Admin",
      enabled: true,
      role: "owner",
    });
  }

  return { tax, paymentMode, admin };
}

async function clearAllBusinessData() {
  const allJobIds = await Job.distinct("_id");

  await Promise.all([
    Payment.deleteMany({}),
    Invoice.deleteMany({}),
    JobComment.deleteMany({}),
    SiteMeasurement.deleteMany({}),
    Planning.deleteMany({}),
    Drafting.deleteMany({}),
    KanbanTask.deleteMany({}),
    MaterialPurchase.deleteMany({}),
    Fabrication.deleteMany({}),
    Qc.deleteMany({}),
    Installation.deleteMany({}),
    InstallationSummary.deleteMany({}),
    Contact.deleteMany({}),
    SiteEngineerReview.deleteMany({}),
    ScheduleAssignment.deleteMany({}),
    Notification.deleteMany({}),
    Leave.deleteMany({}),
    Rfq.deleteMany({}),
    PurchaseOrder.deleteMany({}),
    Supplier.deleteMany({}),
    Site.deleteMany({}),
    Quote.deleteMany({}),
    Job.deleteMany({}),
    Lead.deleteMany({}),
    Client.deleteMany({}),
    Attendance.deleteMany({}),
  ]);

  await Customer.deleteMany({
    email: {
      $nin: ["customer@crm.com"],
    },
  });

  if (allJobIds.length) {
    console.log(`🧹 Cleared all business data (${allJobIds.length} jobs removed).`);
  } else {
    console.log("🧹 Cleared all business data.");
  }
}

const LEAD_SCENARIOS = [
  {
    key: "riverside",
    leadStatus: "New",
    clientName: "Riverside Residence",
    contactPerson: "Emma Wilson",
    email: "emma.riverside@demo.com",
    phone: "+61400555601",
    siteAddress: "5 Riverside Ave, Brisbane QLD",
    category: "Residential",
    projectType: "Balustrade",
    balustradeType: "Glass Panel",
    leadSource: "Website",
    jobId: `${DEMO_PREFIX}-J-001`,
    jobStage: "Site Measurement",
    workflowCurrent: "siteMeasurement",
    lockedValue: 42000,
    quoteStatus: null,
    hasJob: true,
  },
  {
    key: "metro",
    leadStatus: "Contacted",
    clientName: "Metro Retail Fitout",
    contactPerson: "David Chen",
    email: "david.metro@demo.com",
    phone: "+61400555602",
    siteAddress: "200 Queen St, Brisbane QLD",
    category: "Commercial",
    projectType: "Staircase",
    balustradeType: "Stainless Steel",
    leadSource: "Phone Call",
    jobId: `${DEMO_PREFIX}-J-002`,
    jobStage: "Planning Lock",
    workflowCurrent: "planning",
    lockedValue: 68000,
    quoteStatus: "Draft",
    hasJob: true,
  },
  {
    key: "harbour",
    leadStatus: "Quoted",
    clientName: "Harbour Homes Pty Ltd",
    contactPerson: "Sarah Mitchell",
    email: "harbour.homes@demo.com",
    phone: "+61400555603",
    siteAddress: "45 Harbour Rd, Melbourne VIC",
    category: "Commercial",
    projectType: "Balustrade",
    balustradeType: "Glass",
    leadSource: "Google",
    jobId: `${DEMO_PREFIX}-J-003`,
    jobStage: "Job Scheduling",
    workflowCurrent: "scheduling",
    lockedValue: 85000,
    quoteStatus: "Sent",
    sePendingOn: ["planning"],
    hasJob: true,
  },
  {
    key: "skyline",
    leadStatus: "Converted",
    clientName: "Skyline Offices",
    contactPerson: "James Carter",
    email: "skyline.offices@demo.com",
    phone: "+61400555604",
    siteAddress: "88 Collins St, Melbourne VIC",
    category: "Commercial",
    projectType: "Balustrade",
    balustradeType: "Aluminium",
    leadSource: "Referral",
    jobId: `${DEMO_PREFIX}-J-004`,
    jobStage: "Drafting",
    workflowCurrent: "drafting",
    lockedValue: 120000,
    quoteStatus: "Accepted",
    hasJob: true,
  },
  {
    key: "pacific",
    leadStatus: "Converted",
    clientName: "Pacific Towers",
    contactPerson: "Michael Tran",
    email: "pacific.towers@demo.com",
    phone: "+61400555605",
    siteAddress: "10 Pacific Hwy, Sydney NSW",
    category: "Commercial",
    projectType: "Balustrade",
    balustradeType: "Stainless Steel",
    leadSource: "Trade Show",
    jobId: `${DEMO_PREFIX}-J-005`,
    jobStage: "Material Purchase",
    workflowCurrent: "materialPurchasing",
    lockedValue: 95000,
    quoteStatus: "Accepted",
    hasJob: true,
  },
  {
    key: "coastal",
    leadStatus: "Converted",
    clientName: "Coastal Homes",
    contactPerson: "Lisa Nguyen",
    email: "coastal.homes@demo.com",
    phone: "+61400555606",
    siteAddress: "22 Beach Rd, Gold Coast QLD",
    category: "Residential",
    projectType: "Balustrade",
    balustradeType: "Glass Panel",
    leadSource: "Website",
    jobId: `${DEMO_PREFIX}-J-006`,
    jobStage: "Fabrication",
    workflowCurrent: "fabrication",
    lockedValue: 78000,
    quoteStatus: "Accepted",
    hasJob: true,
  },
  {
    key: "apex",
    leadStatus: "Converted",
    clientName: "Apex Developments",
    contactPerson: "Tom Bradley",
    email: "apex.dev@demo.com",
    phone: "+61400555607",
    siteAddress: "500 King St, Sydney NSW",
    category: "Commercial",
    projectType: "Balustrade",
    balustradeType: "Aluminium",
    leadSource: "Manual Entry",
    jobId: `${DEMO_PREFIX}-J-007`,
    jobStage: "Installation",
    workflowCurrent: "installation",
    lockedValue: 145000,
    quoteStatus: "Accepted",
    hasJob: true,
  },
];

async function seedModuleRecordsForJob(job, scenario, index) {
  const jobId = job._id;
  const wfCurrent = scenario.workflowCurrent;

  if (["siteMeasurement", "planning", "scheduling", "drafting", "materialPurchasing", "fabrication", "installation"].includes(wfCurrent) || true) {
    await SiteMeasurement.create({
      jobId,
      measuredBy: "Default Worker",
      siteAddress: scenario.siteAddress,
      height: 1.1,
      width: 10 + index,
      length: 20 + index * 2,
      materialType: scenario.balustradeType,
      fixingSurfaces: "Concrete slab",
      accessDetails: "Street access",
      status: wfCurrent === "siteMeasurement" ? "Pending" : "Completed",
      notes: `Demo measurement — ${scenario.clientName}`,
    });
  }

  await Planning.insertMany([
    {
      jobId,
      task: `Site visit — ${scenario.clientName}`,
      start: formatDDMMYYYY(daysFromNow(1)),
      end: formatDDMMYYYY(daysFromNow(2)),
      workers: 2,
      hours: 6,
      status: wfCurrent === "planning" ? "In Progress" : "Done",
      country: "Australia",
      location: scenario.siteAddress,
      city: scenario.siteAddress.split(",")[0],
    },
    {
      jobId,
      task: "Crew allocation",
      start: formatDDMMYYYY(daysFromNow(3)),
      end: formatDDMMYYYY(daysFromNow(4)),
      workers: 3,
      hours: 8,
      status: "Done",
      country: "Australia",
      location: scenario.siteAddress,
    },
  ]);

  const draftingStatuses = ["Draft", "Under Review", "IFC Approved"];
  await Drafting.insertMany([
    {
      jobId,
      title: `${scenario.clientName} — GA Layout`,
      drawingType: "GA Drawing",
      revision: "Rev A",
      status: draftingStatuses[index % 3],
      preparedBy: "Planning Engineer",
      isIFCApproved: index >= 3,
    },
    {
      jobId,
      title: `${scenario.clientName} — Shop Drawing`,
      drawingType: "Shop Drawing",
      revision: "Rev B",
      status: index >= 5 ? "IFC Approved" : "Draft",
      preparedBy: "Default Worker",
      isIFCApproved: index >= 5,
    },
  ]);

  await ScheduleAssignment.create({
    jobId,
    title: `Site visit — ${scenario.clientName}`,
    assignmentType: "General",
    role: "Installer",
    assigneeName: "Installation Specialist",
    teams: ["Install Team A"],
    assignees: [{ assigneeName: "Installation Specialist" }],
    startTime: daysFromNow(2),
    endTime: daysFromNow(2 + 0.5),
    location: scenario.siteAddress,
    status: wfCurrent === "scheduling" ? "Scheduled" : "Completed",
    notes: "Demo schedule assignment",
  });

  await MaterialPurchase.insertMany([
    {
      jobId,
      itemName: "Tempered Glass 12mm",
      category: "Glass",
      specification: "12mm clear",
      unit: "Sqft",
      requiredQty: 100 + index * 10,
      orderedQty: 100 + index * 10,
      receivedQty: index >= 4 ? 80 : 0,
      supplier: "GlassCo",
      expectedDelivery: formatDDMMYYYY(daysFromNow(7)),
      status: index >= 4 ? "Partially Received" : "Ordered",
    },
    {
      jobId,
      itemName: "Aluminium Channel",
      category: "Metal",
      specification: "50x50mm",
      unit: "Meter",
      requiredQty: 60,
      orderedQty: 60,
      receivedQty: index >= 5 ? 60 : 20,
      supplier: "MetalWorks",
      status: index >= 5 ? "Received" : "Ordered",
    },
  ]);

  if (index >= 5) {
    await Fabrication.insertMany([
      {
        jobId,
        itemName: `Frame section — ${scenario.clientName}`,
        drawingRef: `SD-${index}-B`,
        workstation: "Bay 1",
        assignedTeam: "Fab Team",
        quantity: 1,
        targetDate: formatDDMMYYYY(daysFromNow(5)),
        status: wfCurrent === "fabrication" ? "In Progress" : "Completed",
        progressPercentage: wfCurrent === "fabrication" ? 55 : 100,
        checklist: {
          ifcVerified: true,
          materialAvailable: true,
          cuttingCompleted: true,
          weldingCompleted: false,
        },
        photoUrls: ["/uploads/fabrication/demo-seed.jpg"],
        hoursLog: [{ workerName: "Default Worker", role: "Welder", hours: 6, workDate: formatDDMMYYYY(), notes: "Demo hours" }],
      },
    ]);
  }

  if (index >= 5) {
    await Qc.insertMany([
      {
        jobId,
        itemName: "Weld sample",
        inspectionType: "Visual",
        checkedBy: "QC Inspector",
        checkedDate: formatDDMMYYYY(),
        status: index === 5 ? "Pending" : "Pass",
      },
      {
        jobId,
        itemName: "Powder coat finish",
        inspectionType: "Surface",
        checkedBy: "QC Inspector",
        checkedDate: formatDDMMYYYY(daysFromNow(-1)),
        status: "Pass",
      },
    ]);
  }

  if (index >= 6) {
    await Installation.insertMany([
      {
        jobId,
        activityName: "Ground floor install",
        locationArea: "Lobby",
        assignedTeam: ["Install Team A"],
        plannedDate: formatDDMMYYYY(daysFromNow(3)),
        status: wfCurrent === "installation" ? "In Progress" : "Pending",
        expectedHours: 8,
        actualHours: wfCurrent === "installation" ? 4 : 0,
        photoUrls: wfCurrent === "installation" ? ["/uploads/installation/demo-seed.jpg"] : [],
      },
      {
        jobId,
        activityName: "Level 1 snag fix",
        locationArea: "North wing",
        assignedTeam: ["Install Team B"],
        plannedDate: formatDDMMYYYY(daysFromNow(5)),
        status: "Pending",
        expectedHours: 4,
      },
    ]);
  }

  const kanbanStatuses = ["To Schedule", "Scheduled", "Material Purchase", "Fabrication", "QC", "Ready for Installation"];
  await KanbanTask.create({
    jobId,
    title: `Kanban — ${scenario.jobStage}`,
    description: "Auto-generated demo task",
    plannedStart: formatDDMMYYYY(daysFromNow(1)),
    plannedEnd: formatDDMMYYYY(daysFromNow(3)),
    priority: index % 2 === 0 ? "High" : "Medium",
    assignedTeam: "Demo Team",
    status: kanbanStatuses[Math.min(index, kanbanStatuses.length - 1)],
  });

  for (const stageKey of scenario.sePendingOn || []) {
    await SiteEngineerReview.create({
      jobId,
      moduleStageKey: stageKey,
      reviewType: "module",
      title: stageKey,
      drawingRef: stageKey,
      status: "Pending Review",
    });
  }

  if (index >= 3) {
    await SiteEngineerReview.create({
      jobId,
      moduleStageKey: "siteMeasurement",
      reviewType: "module",
      title: "Site Measurement",
      status: "Approved",
      reviewedBy: "Site Engineer",
      reviewedAt: daysFromNow(-10),
    });
  }
}

async function seedDemoSeven(options = {}) {
  if (options.fresh !== false) {
    await clearAllBusinessData();
  }

  const existing = await Job.findOne({ jobId: DEMO_MARKER_JOB_ID });
  if (existing && !options.force) {
    console.log("ℹ️ DEMO-7 data already exists. Run with --force to re-seed.");
    return { skipped: true };
  }

  if (existing && options.force) {
    await clearAllBusinessData();
  }

  console.log("🌱 Seeding 7 leads + 7 jobs (all modules / decision paths)...");

  const { tax, paymentMode, admin } = await ensureErpBasics();
  const adminUser = await User.findOne({ email: "admin@crm.com" });

  const customers = [];
  const leads = [];
  const jobs = [];

  for (let i = 0; i < LEAD_SCENARIOS.length; i += 1) {
    const scenario = LEAD_SCENARIOS[i];

    const customer = await Customer.create({
      name: scenario.clientName,
      companyName: scenario.clientName,
      email: scenario.email,
      mobile: scenario.phone,
      phone: scenario.phone,
      address: scenario.siteAddress,
      contactPerson: scenario.contactPerson,
      status: "Active",
    });
    customers.push(customer);

    if (i === 0) {
      const portalUser = await User.findOne({ email: "customer@crm.com", role: "customer" });
      await Customer.findByIdAndUpdate(customer._id, {
        portalEmail: "customer@crm.com",
        portalInvitedAt: new Date(),
        ...(portalUser ? { user: portalUser._id } : {}),
      });
      if (portalUser) {
        portalUser.customer = customer._id;
        await portalUser.save();
      }
    }

    const lead = await Lead.create({
      clientName: scenario.clientName,
      contactPerson: scenario.contactPerson,
      phone: scenario.phone,
      email: scenario.email,
      siteAddress: scenario.siteAddress,
      category: scenario.category,
      projectType: scenario.projectType,
      balustradeType: scenario.balustradeType,
      leadSource: scenario.leadSource,
      status: scenario.leadStatus,
      isLocked: scenario.leadStatus === "Converted",
      assignedSalesperson: "System Admin",
      nextFollowUpDate: daysFromNow(3),
      notes: `Demo lead #${i + 1} — ${scenario.leadStatus}`,
      interactions: [
        {
          type: "Note",
          date: daysFromNow(-2),
          notes: `Initial contact for ${scenario.clientName}`,
          createdBy: "System Admin",
        },
      ],
    });
    leads.push(lead);

    await Client.create({
      name: scenario.clientName,
      email: scenario.email,
      phone: scenario.phone,
      address: scenario.siteAddress,
      createdBy: admin._id,
    });

    if (!scenario.hasJob) continue;

    const workflowEvents = buildWorkflowSnapshot(scenario.workflowCurrent, {
      sePendingOn: scenario.sePendingOn || [],
    });

    const job = await Job.create({
      jobId: scenario.jobId,
      customer: scenario.clientName,
      site: scenario.siteAddress,
      stage: scenario.jobStage,
      lockedValue: scenario.lockedValue,
      totalInvoiced: Math.round(scenario.lockedValue * 0.3),
      totalPaid: Math.round(scenario.lockedValue * 0.15),
      systemState: "Active",
      workflowVersion: 3,
      leadId: lead._id,
      customerId: customer._id,
      workflowEvents,
      ...(i === 6
        ? {
            variations: [
              { description: "Extra glass panel", amount: 4500, status: "Approved", date: daysFromNow(-3) },
            ],
            retentionPercentage: 5,
          }
        : {}),
    });
    jobs.push(job);

    if (scenario.quoteStatus) {
      const quote = await Quote.create({
        quoteNumber: `${DEMO_PREFIX}-Q-${String(i + 1).padStart(3, "0")}`,
        leadId: lead._id,
        customerId: customer._id,
        jobId: job._id,
        customerName: scenario.clientName,
        contactPerson: scenario.contactPerson,
        phone: scenario.phone,
        email: scenario.email,
        siteAddress: scenario.siteAddress,
        leadSource: scenario.leadSource,
        scope: `Supply & install ${scenario.balustradeType} balustrade`,
        inclusions: "Design, materials, fabrication, installation",
        exclusions: "Scaffolding, electrical",
        assumptions: "Standard site access Mon–Fri",
        totalAmount: scenario.lockedValue,
        validUntil: daysFromNow(30),
        status: scenario.quoteStatus,
        valueLevel: i % 3 === 0 ? "High" : i % 3 === 1 ? "Medium" : "Low",
        priority: (i % 3) + 1,
        categoryCode: scenario.category,
        materialCode: mapMaterialCode(scenario.balustradeType),
        ...(scenario.quoteStatus === "Accepted"
          ? {
              approvedAt: daysFromNow(-7),
              acceptanceAudit: { method: "Email", acceptedBy: scenario.contactPerson, acceptedAt: daysFromNow(-7) },
            }
          : {}),
      });
      await Job.updateOne({ _id: job._id }, { quoteId: quote._id });
    }

    await seedModuleRecordsForJob(job, scenario, i);

    const year = new Date().getFullYear();
    const invoice = await Invoice.create({
      createdBy: admin._id,
      number: `${DEMO_PREFIX}-INV-${String(i + 1).padStart(3, "0")}`,
      year,
      date: daysFromNow(-7),
      expiredDate: daysFromNow(23),
      job: job._id,
      invoiceType: "Progress Payment",
      stage: INVOICE_STAGE_MAP[scenario.workflowCurrent] || "siteMeasurement",
      percentageOfContract: 20 + i * 5,
      items: [
        {
          itemName: `Progress — ${scenario.jobStage}`,
          description: "Demo milestone invoice",
          quantity: 1,
          price: Math.round(scenario.lockedValue * 0.2),
          total: Math.round(scenario.lockedValue * 0.2),
        },
      ],
      taxRate: Number(tax.taxValue),
      subTotal: Math.round((scenario.lockedValue * 0.2) / 1.1),
      taxTotal: Math.round((scenario.lockedValue * 0.2) * 0.1),
      total: Math.round(scenario.lockedValue * 0.2),
      currency: "AUD",
      status: i % 2 === 0 ? "Issued" : "Partially Paid",
      amountPaid: i % 2 === 0 ? 0 : Math.round(scenario.lockedValue * 0.1),
      amountDue: i % 2 === 0 ? Math.round(scenario.lockedValue * 0.2) : Math.round(scenario.lockedValue * 0.1),
    });

    if (i % 2 === 1) {
      const paymentCount = await Payment.countDocuments();
      await Payment.create({
        createdBy: admin._id,
        number: paymentCount + 1,
        date: daysFromNow(-3),
        amount: Math.round(scenario.lockedValue * 0.1),
        currency: "AUD",
        paymentMode: paymentMode._id,
        ref: `${DEMO_PREFIX}-PAY-${i + 1}`,
        description: `Partial payment — ${scenario.jobId}`,
        invoice: invoice._id,
      });
    }

    await Contact.create({
      customerId: customer._id,
      projectId: job._id,
      subject: `Demo enquiry — ${scenario.clientName}`,
      message: `Portal message for job ${scenario.jobId}`,
      priority: i % 2 === 0 ? "Medium" : "High",
      status: i % 3 === 0 ? "Open" : "Closed",
      conversation: [
        { sender: "customer", message: "Please confirm next steps.", createdAt: daysFromNow(-1) },
        ...(adminUser
          ? [{ sender: "admin", userId: adminUser._id, message: "We are on track.", createdAt: new Date() }]
          : []),
      ],
    });
  }

  await Attendance.insertMany([
    { workerName: "Default Worker", workerEmail: "worker@crm.com", employeeId: "EMP123", designation: "Welder", department: "Fabrication", date: formatDDMMYYYY(), checkin: "08:00", checkout: "16:30", hours: 8, status: "Full Day", source: "Manual" },
    { workerName: "Installation Specialist", workerEmail: "installer@crm.com", employeeId: "EMP124", designation: "Installer", department: "Installation", date: formatDDMMYYYY(), checkin: "07:30", checkout: "15:30", hours: 8, status: "Full Day", source: "Manual" },
    { workerName: "QC Inspector", workerEmail: "qc@crm.com", employeeId: "EMP125", designation: "QC Inspector", department: "Quality Control", date: formatDDMMYYYY(daysFromNow(-1)), checkin: "09:00", checkout: "17:00", hours: 8, status: "Full Day", source: "Manual" },
  ]);

  console.log("✅ DEMO-7 seed complete:");
  console.log("   7 leads  — New, Contacted, Quoted, Converted×4");
  console.log("   7 jobs   — Site Meas → Planning → Scheduling → Drafting → Materials → Fabrication → Installation");
  console.log("   7 customers, quotes, invoices, module records per job");
  console.log("   SE: approved + pending (Harbour job planning pending)");
  console.log("");
  console.log("   Logins unchanged: admin@crm.com / Admin@123");
  console.log(`   Jobs: ${LEAD_SCENARIOS.map((s) => s.jobId).join(", ")}`);

  return { skipped: false, jobs: jobs.length, leads: leads.length };
}

module.exports = {
  seedDemoSeven,
  clearAllBusinessData,
  DEMO_PREFIX,
  DEMO_MARKER_JOB_ID,
};
