const mongoose = require("mongoose");

const Job = require("../models/appModels/Job");
const Lead = require("../models/appModels/Lead");
const Customer = require("../models/appModels/Customer");
const Quote = require("../models/appModels/Quote");
const User = require("../models/appModels/User");
const Client = require("../models/appModels/Client");
const SiteMeasurement = require("../models/appModels/SiteMeasurement");
const Planning = require("../models/appModels/Planning");
const Drafting = require("../models/appModels/Drafting");
const KanbanTask = require("../models/appModels/KanbanTask");
const MaterialPurchase = require("../models/appModels/MaterialPurchase");
const Fabrication = require("../models/appModels/Fabrication");
const Qc = require("../models/appModels/Qc");
const Installation = require("../models/appModels/Installation");
const Invoice = require("../models/appModels/Invoice");
const Payment = require("../models/appModels/Payment");
const Attendance = require("../models/appModels/Attendance");
const Contact = require("../models/appModels/Contact");
const Taxes = require("../models/appModels/Taxes");
const PaymentMode = require("../models/appModels/PaymentMode");
const Admin = require("../models/coreModels/Admin");
const { linkJobToQuote } = require("../utils/linkJobQuote");
const { buildDefaultWorkflowEvents } = require("../utils/workflowDefaults");

const DEMO_MARKER_JOB_ID = "DEMO-J-001";

function daysFromNow(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

function formatDDMMYYYY(date = new Date()) {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

function completedStage(by = "System Admin") {
  return {
    isCompleted: true,
    completedBy: by,
    completedAt: new Date(),
  };
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

async function clearDemoData() {
  const demoJobIds = await Job.find({ jobId: /^DEMO-/ }).distinct("_id");
  const demoLeadIds = await Lead.find({
    $or: [{ email: /\@demo$/ }, { email: "emma@riverside.demo" }],
  }).distinct("_id");

  if (demoJobIds.length) {
    await Promise.all([
      SiteMeasurement.deleteMany({ jobId: { $in: demoJobIds } }),
      Planning.deleteMany({ jobId: { $in: demoJobIds } }),
      Drafting.deleteMany({ jobId: { $in: demoJobIds } }),
      KanbanTask.deleteMany({ jobId: { $in: demoJobIds } }),
      MaterialPurchase.deleteMany({ jobId: { $in: demoJobIds } }),
      Fabrication.deleteMany({ jobId: { $in: demoJobIds } }),
      Qc.deleteMany({ jobId: { $in: demoJobIds } }),
      Installation.deleteMany({ jobId: { $in: demoJobIds } }),
      Contact.deleteMany({ projectId: { $in: demoJobIds } }),
    ]);

    const demoInvoices = await Invoice.find({ job: { $in: demoJobIds } }).distinct("_id");
    if (demoInvoices.length) {
      await Payment.deleteMany({ invoice: { $in: demoInvoices } });
      await Invoice.deleteMany({ _id: { $in: demoInvoices } });
    }

    await Job.deleteMany({ _id: { $in: demoJobIds } });
  }

  await Quote.deleteMany({ quoteNumber: /^DEMO-Q-/ });
  await Lead.deleteMany({ _id: { $in: demoLeadIds } });
  await Client.deleteMany({ email: /\@demo\.com$|@riverside\.demo$/ });
  await Customer.deleteMany({ email: { $in: ["harbour@demo.com", "skyline@demo.com"] } });
  await Attendance.deleteMany({ workerEmail: { $in: ["worker@crm.com", "installer@crm.com", "qc@crm.com"] }, source: { $in: ["Manual", "Auto"] } });
  await Contact.deleteMany({ subject: /site measurement|Fabrication progress/i });

  console.log("🧹 Cleared previous demo data.");
}

async function seedDemoData(options = {}) {
  if (options.fresh) {
    await clearDemoData();
  }

  const existing =
    (await Job.findOne({ jobId: DEMO_MARKER_JOB_ID })) ||
    (await Lead.findOne({ email: "emma@riverside.demo" }));
  if (existing) {
    console.log("ℹ️ Demo data already exists — skipping seed.");
    return { skipped: true };
  }

  console.log("🌱 Seeding demo data for all modules...");

  const { tax, paymentMode, admin } = await ensureErpBasics();
  const adminUser = await User.findOne({ email: "admin@crm.com", role: "admin" });

  const customers = await Promise.all([
    Customer.findOneAndUpdate(
      { email: "customer@crm.com" },
      {
        name: "Default Customer",
        companyName: "Demo Customer Company",
        email: "customer@crm.com",
        mobile: "+910000000001",
        phone: "+910000000001",
        address: "12 Market Street, Sydney NSW",
        contactPerson: "Default Customer",
        status: "Active",
      },
      { upsert: true, new: true }
    ),
    Customer.create({
      name: "Harbour Homes Pty Ltd",
      companyName: "Harbour Homes Pty Ltd",
      email: "harbour@demo.com",
      mobile: "+61400111222",
      phone: "+61400111222",
      address: "45 Harbour Rd, Melbourne VIC",
      contactPerson: "Sarah Mitchell",
      status: "Active",
    }),
    Customer.create({
      name: "Skyline Offices",
      companyName: "Skyline Offices",
      email: "skyline@demo.com",
      mobile: "+61400333444",
      phone: "+61400333444",
      address: "88 Collins St, Melbourne VIC",
      contactPerson: "James Carter",
      status: "Active",
    }),
  ]);

  const [customerA, customerB, customerC] = customers;

  const leads = await Lead.insertMany([
    {
      clientName: "Riverside Residence",
      contactPerson: "Emma Wilson",
      phone: "+61400555666",
      email: "emma@riverside.demo",
      siteAddress: "5 Riverside Ave, Brisbane QLD",
      category: "Residential",
      projectType: "Balustrade",
      balustradeType: "Glass Panel",
      leadSource: "Website",
      notes: "New enquiry from website form.",
      status: "New",
      nextFollowUpDate: daysFromNow(2),
      assignedSalesperson: "System Admin",
      interactions: [
        {
          type: "Note",
          date: new Date(),
          notes: "Initial enquiry logged.",
          createdBy: "System Admin",
        },
      ],
    },
    {
      clientName: "Metro Retail Fitout",
      contactPerson: "David Chen",
      phone: "+61400777888",
      email: "david@metro.demo",
      siteAddress: "200 Queen St, Brisbane QLD",
      category: "Commercial",
      projectType: "Staircase",
      balustradeType: "Stainless Steel",
      leadSource: "Phone Call",
      notes: "Follow-up call completed.",
      status: "Contacted",
      nextFollowUpDate: daysFromNow(5),
      assignedSalesperson: "System Admin",
      interactions: [
        { type: "Call", date: daysFromNow(-1), notes: "Discussed scope and timeline.", createdBy: "System Admin" },
        { type: "Email", date: new Date(), notes: "Sent brochure and pricing guide.", createdBy: "System Admin" },
      ],
    },
    {
      clientName: "City Tower Glass",
      contactPerson: "Sarah Mitchell",
      phone: "+61400111222",
      email: "harbour@demo.com",
      siteAddress: "45 Harbour Rd, Melbourne VIC",
      category: "Commercial",
      projectType: "Balustrade",
      balustradeType: "Glass",
      leadSource: "Google",
      notes: "Quote sent, awaiting response.",
      status: "Quoted",
      assignedSalesperson: "System Admin",
      interactions: [
        { type: "Site Visit", date: daysFromNow(-3), notes: "Site measured.", createdBy: "System Admin" },
      ],
    },
    {
      clientName: "Skyline Offices",
      contactPerson: "James Carter",
      phone: "+61400333444",
      email: "skyline@demo.com",
      siteAddress: "88 Collins St, Melbourne VIC",
      category: "Commercial",
      projectType: "Balustrade",
      balustradeType: "Aluminium",
      leadSource: "Manual Entry",
      notes: "Converted to active job.",
      status: "Converted",
      isLocked: true,
      assignedSalesperson: "System Admin",
    },
    {
      clientName: "Lost Prospect Co",
      contactPerson: "Mark Lee",
      phone: "+61400999000",
      email: "lost@demo.com",
      siteAddress: "1 Test Lane, Perth WA",
      category: "Residential",
      leadSource: "Social Media",
      notes: "Chose another vendor.",
      status: "Lost",
    },
  ]);

  const [leadNew, leadContacted, leadQuoted, leadConverted, leadLost] = leads;

  await Client.insertMany([
    { name: "Riverside Residence", email: "emma@riverside.demo", phone: "+61400555666", address: "5 Riverside Ave, Brisbane QLD", createdBy: admin._id },
    { name: "Harbour Homes Pty Ltd", email: "harbour@demo.com", phone: "+61400111222", address: "45 Harbour Rd, Melbourne VIC", createdBy: admin._id },
  ]);

  const jobEarlyWf = buildDefaultWorkflowEvents(2);
  jobEarlyWf.siteMeasurement.scheduledDate = daysFromNow(1);
  jobEarlyWf.siteMeasurement.expectedHours = 4;

  const jobEarly = await Job.create({
    jobId: DEMO_MARKER_JOB_ID,
    customer: "Riverside Residence",
    site: "5 Riverside Ave, Brisbane QLD",
    stage: "Site Measurement",
    lockedValue: 45000,
    totalInvoiced: 0,
    totalPaid: 0,
    systemState: "Active",
    workflowVersion: 3,
    leadId: leadNew._id,
    customerId: customerA._id,
    workflowEvents: jobEarlyWf,
  });

  const jobScheduling = await Job.create({
    jobId: "DEMO-J-002",
    customer: "City Tower Glass",
    site: "45 Harbour Rd, Melbourne VIC",
    stage: "Job Scheduling",
    lockedValue: 85000,
    totalInvoiced: 25500,
    totalPaid: 25500,
    systemState: "Active",
    leadId: leadQuoted._id,
    customerId: customerB._id,
    workflowEvents: {
      siteMeasurement: { ...completedStage(), scheduledDate: daysFromNow(-10), actualHours: 5 },
      planning: { ...completedStage(), approvalDate: daysFromNow(-8) },
      drafting: { ...completedStage(), completionActual: daysFromNow(-5) },
      clientApproval: { ...completedStage(), approvalDate: daysFromNow(-4) },
    },
  });

  const jobFabrication = await Job.create({
    jobId: "DEMO-J-003",
    customer: "Skyline Offices",
    site: "88 Collins St, Melbourne VIC",
    stage: "Fabrication",
    lockedValue: 120000,
    totalInvoiced: 36000,
    totalPaid: 18000,
    retentionPercentage: 5,
    systemState: "Active",
    leadId: leadConverted._id,
    customerId: customerC._id,
    variations: [
      { description: "Extra glass panel on level 3", amount: 8500, status: "Approved", date: daysFromNow(-2) },
      { description: "Optional handrail upgrade", amount: 3200, status: "Draft", date: new Date() },
    ],
    workflowEvents: {
      siteMeasurement: { ...completedStage(), actualHours: 6 },
      planning: { ...completedStage() },
      drafting: { ...completedStage() },
      clientApproval: { ...completedStage() },
      materialPurchasing: { ...completedStage(), supplierRef: "SUP-4421" },
      fabrication: { startExpectedHours: 40, startActualHours: 12, isCompleted: false },
    },
  });

  const quotePayloads = [
    {
      quoteNumber: "DEMO-Q-001",
      leadId: leadContacted._id,
      customerName: leadContacted.clientName,
      contactPerson: leadContacted.contactPerson,
      phone: leadContacted.phone,
      email: leadContacted.email,
      siteAddress: leadContacted.siteAddress,
      leadSource: leadContacted.leadSource,
      scope: "Supply and install stainless balustrade — 24lm",
      inclusions: "Materials, fabrication, installation, cleanup",
      exclusions: "Scaffolding, electrical works",
      assumptions: "Site access Mon–Fri 7am–4pm",
      totalAmount: 62000,
      validUntil: daysFromNow(30),
      status: "Draft",
      valueLevel: "Medium",
      priority: 2,
      categoryCode: "Commercial",
      materialCode: "Stainless Steel",
    },
    {
      quoteNumber: "DEMO-Q-002",
      leadId: leadQuoted._id,
      customerId: customerB._id,
      jobId: jobScheduling._id,
      customerName: leadQuoted.clientName,
      contactPerson: leadQuoted.contactPerson,
      phone: leadQuoted.phone,
      email: leadQuoted.email,
      siteAddress: leadQuoted.siteAddress,
      leadSource: leadQuoted.leadSource,
      scope: "Frameless glass balustrade — 18 panels",
      inclusions: "Glass, hardware, installation",
      exclusions: "Core drilling beyond standard",
      assumptions: "Lift access available",
      totalAmount: 85000,
      validUntil: daysFromNow(21),
      status: "Sent",
      valueLevel: "High",
      priority: 1,
      categoryCode: "Commercial",
      materialCode: "Glass",
    },
    {
      quoteNumber: "DEMO-Q-003",
      leadId: leadConverted._id,
      customerId: customerC._id,
      jobId: jobFabrication._id,
      customerName: leadConverted.clientName,
      contactPerson: leadConverted.contactPerson,
      phone: leadConverted.phone,
      email: leadConverted.email,
      siteAddress: leadConverted.siteAddress,
      leadSource: leadConverted.leadSource,
      scope: "Aluminium balustrade — 3 floors",
      inclusions: "Design, supply, install",
      exclusions: "After-hours work",
      assumptions: "Approved drawings on file",
      totalAmount: 120000,
      validUntil: daysFromNow(14),
      status: "Accepted",
      valueLevel: "Low",
      priority: 3,
      categoryCode: "Commercial",
      materialCode: "Aluminium",
      acceptanceAudit: { method: "Email", acceptedBy: "James Carter", acceptedAt: daysFromNow(-7) },
      approvedAt: daysFromNow(-7),
    },
  ];

  const quotes = [];
  for (const payload of quotePayloads) {
    quotes.push(await Quote.create(payload));
  }

  await jobScheduling.updateOne({ quoteId: quotes[1]._id });
  await jobFabrication.updateOne({ quoteId: quotes[2]._id });

  await SiteMeasurement.create({
    jobId: jobEarly._id,
    measuredBy: "Default Worker",
    siteAddress: jobEarly.site,
    height: 1.1,
    width: 12.5,
    length: 24,
    materialType: "Glass Panel",
    fixingSurfaces: "Concrete slab",
    accessDetails: "Rear lane access",
    parkingDetails: "Street parking only",
    powerAvailable: true,
    powerLocation: "Garage",
    waterAvailable: false,
    liftAccess: "No lift",
    washroomAccess: "On site",
    publicRisk: "Low",
    whsHazards: "Uneven ground near entry",
    gpsLocation: "-27.4698,153.0251",
    notes: "Demo site measurement record",
    status: "Completed",
  });

  await Planning.insertMany([
    { jobId: jobEarly._id, task: "Measure balcony runs", start: formatDDMMYYYY(daysFromNow(1)), end: formatDDMMYYYY(daysFromNow(2)), workers: 2, hours: 6, status: "Pending" },
    { jobId: jobScheduling._id, task: "Schedule install crew", start: formatDDMMYYYY(daysFromNow(3)), end: formatDDMMYYYY(daysFromNow(5)), workers: 3, hours: 16, status: "In Progress" },
    { jobId: jobScheduling._id, task: "Confirm material ETA", start: formatDDMMYYYY(daysFromNow(1)), end: formatDDMMYYYY(daysFromNow(1)), workers: 1, hours: 2, status: "Done" },
  ]);

  await Drafting.insertMany([
    { jobId: jobScheduling._id, title: "Glass Panel Layout", drawingType: "GA Drawing", revision: "Rev A", status: "Under Review", preparedBy: "Planning Engineer", checkedBy: "QC Inspector" },
    { jobId: jobScheduling._id, title: "Fixing Detail Sheet", drawingType: "Detail Drawing", revision: "Rev B", status: "IFC Approved", preparedBy: "Planning Engineer", approvedBy: "System Admin", isIFCApproved: true },
    { jobId: jobFabrication._id, title: "Level 1–3 Balustrade", drawingType: "Shop Drawing", revision: "Rev C", status: "Approved", preparedBy: "Default Worker", approvedBy: "System Admin" },
  ]);

  await KanbanTask.insertMany([
    { jobId: jobScheduling._id, title: "Book install date", description: "Confirm crane access", plannedStart: formatDDMMYYYY(daysFromNow(2)), plannedEnd: formatDDMMYYYY(daysFromNow(3)), priority: "High", assignedTeam: "Install Team A", status: "Scheduled" },
    { jobId: jobScheduling._id, title: "Order glass panels", description: "Supplier lead time 10 days", plannedStart: formatDDMMYYYY(daysFromNow(1)), plannedEnd: formatDDMMYYYY(daysFromNow(4)), priority: "Urgent", assignedTeam: "Procurement", status: "Material Purchase" },
    { jobId: jobFabrication._id, title: "Weld frame sections", description: "Bay 2 workstation", plannedStart: formatDDMMYYYY(daysFromNow(-1)), plannedEnd: formatDDMMYYYY(daysFromNow(2)), priority: "Medium", assignedTeam: "Fab Team", status: "Fabrication" },
    { jobId: jobFabrication._id, title: "Pre-install QC", description: "Final dimension check", plannedStart: formatDDMMYYYY(daysFromNow(3)), plannedEnd: formatDDMMYYYY(daysFromNow(4)), priority: "Low", assignedTeam: "QC Team", status: "To Schedule" },
  ]);

  await MaterialPurchase.insertMany([
    { jobId: jobScheduling._id, itemName: "Tempered Glass 12mm", category: "Glass", specification: "12mm clear toughened", unit: "Sqft", requiredQty: 180, orderedQty: 180, receivedQty: 0, supplier: "GlassCo", expectedDelivery: formatDDMMYYYY(daysFromNow(10)), status: "Ordered" },
    { jobId: jobFabrication._id, itemName: "Aluminium Channel", category: "Metal", specification: "50x50mm", unit: "Meter", requiredQty: 120, orderedQty: 120, receivedQty: 90, supplier: "MetalWorks", expectedDelivery: formatDDMMYYYY(daysFromNow(-2)), status: "Partially Received" },
    { jobId: jobFabrication._id, itemName: "Fixing Brackets", category: "Hardware", specification: "SS316", unit: "Set", requiredQty: 48, orderedQty: 48, receivedQty: 48, supplier: "FixRight", expectedDelivery: formatDDMMYYYY(daysFromNow(-5)), status: "Received" },
  ]);

  await Fabrication.insertMany([
    {
      jobId: jobFabrication._id,
      itemName: "Level 1 Balustrade Frame",
      drawingRef: "SD-003-C",
      workstation: "Bay 2",
      assignedTeam: "Fab Team",
      quantity: 1,
      targetDate: formatDDMMYYYY(daysFromNow(5)),
      status: "In Progress",
      checklist: { ifcVerified: true, materialAvailable: true, cuttingCompleted: true, weldingCompleted: false },
      hoursLog: [{ workerName: "Default Worker", role: "Welder", hours: 6, workDate: formatDDMMYYYY(), notes: "Started welding" }],
    },
    {
      jobId: jobFabrication._id,
      itemName: "Level 2 Balustrade Frame",
      drawingRef: "SD-003-C",
      workstation: "Bay 1",
      assignedTeam: "Fab Team",
      quantity: 1,
      targetDate: formatDDMMYYYY(daysFromNow(7)),
      status: "Pending",
    },
  ]);

  await Qc.insertMany([
    { jobId: jobFabrication._id, itemName: "Bracket batch #12", inspectionType: "Dimensional", checkedBy: "QC Inspector", checkedDate: formatDDMMYYYY(daysFromNow(-1)), status: "Pass", remarks: "Within tolerance" },
    { jobId: jobFabrication._id, itemName: "Level 1 weld sample", inspectionType: "Visual", checkedBy: "QC Inspector", checkedDate: formatDDMMYYYY(), status: "Pending" },
    { jobId: jobScheduling._id, itemName: "Glass panel sample", inspectionType: "Incoming", checkedBy: "QC Inspector", checkedDate: formatDDMMYYYY(daysFromNow(2)), status: "Fail", remarks: "Minor chip — reorder" },
  ]);

  await Installation.insertMany([
    { jobId: jobScheduling._id, activityName: "Ground floor install", locationArea: "Lobby", assignedTeam: ["Install Team A"], plannedDate: formatDDMMYYYY(daysFromNow(8)), status: "Pending", expectedHours: 8 },
    { jobId: jobFabrication._id, activityName: "Level 1 install", locationArea: "North wing", assignedTeam: ["Install Team A", "Install Team B"], plannedDate: formatDDMMYYYY(daysFromNow(10)), completedDate: "", status: "In Progress", expectedHours: 12, actualHours: 4 },
    { jobId: jobFabrication._id, activityName: "Snag fix — handrail gap", locationArea: "Level 2", assignedTeam: ["Install Team B"], plannedDate: formatDDMMYYYY(daysFromNow(12)), status: "Snag", snagIssue: "5mm gap at post base", expectedHours: 2 },
  ]);

  const year = new Date().getFullYear();
  const invoiceDraft = await Invoice.create({
    createdBy: admin._id,
    number: "INV-DEMO-001",
    year,
    date: new Date(),
    expiredDate: daysFromNow(30),
    job: jobEarly._id,
    invoiceType: "Progress Payment",
    stage: "siteMeasurement",
    percentageOfContract: 20,
    items: [{ itemName: "Deposit — site measurement", description: "20% progress", quantity: 1, price: 9000, total: 9000 }],
    taxRate: Number(tax.taxValue),
    subTotal: 8181.82,
    taxTotal: 818.18,
    total: 9000,
    currency: "AUD",
    status: "Draft",
    amountPaid: 0,
    amountDue: 9000,
  });

  const invoiceIssued = await Invoice.create({
    createdBy: admin._id,
    number: "INV-DEMO-002",
    year,
    date: daysFromNow(-14),
    expiredDate: daysFromNow(16),
    job: jobFabrication._id,
    invoiceType: "Progress Payment",
    stage: "fabrication",
    percentageOfContract: 30,
    items: [{ itemName: "Fabrication progress", description: "30% of contract", quantity: 1, price: 36000, total: 36000 }],
    taxRate: Number(tax.taxValue),
    subTotal: 32727.27,
    taxTotal: 3272.73,
    total: 36000,
    currency: "AUD",
    status: "Partially Paid",
    amountPaid: 18000,
    amountDue: 18000,
  });

  const paymentCount = await Payment.countDocuments();
  await Payment.create({
    createdBy: admin._id,
    number: paymentCount + 1,
    date: daysFromNow(-7),
    amount: 18000,
    currency: "AUD",
    paymentMode: paymentMode._id,
    ref: "PAY-DEMO-001",
    description: "Partial payment — fabrication stage",
    invoice: invoiceIssued._id,
  });

  await Attendance.insertMany([
    { workerName: "Default Worker", workerEmail: "worker@crm.com", employeeId: "EMP123", designation: "Welder", department: "Fabrication", date: formatDDMMYYYY(), checkin: "08:00", checkout: "16:30", hours: 8, status: "Full Day", source: "Manual" },
    { workerName: "Installation Specialist", workerEmail: "installer@crm.com", employeeId: "EMP124", designation: "Installer", department: "Installation", date: formatDDMMYYYY(), checkin: "07:30", checkout: "12:30", hours: 5, status: "Half Day", source: "Auto" },
    { workerName: "QC Inspector", workerEmail: "qc@crm.com", employeeId: "EMP125", designation: "QC Inspector", department: "Quality Control", date: formatDDMMYYYY(daysFromNow(-1)), checkin: "09:00", checkout: "17:00", hours: 8, status: "Full Day", source: "Manual" },
  ]);

  await Contact.insertMany([
    {
      customerId: customerA._id,
      projectId: jobEarly._id,
      subject: "When will site measurement happen?",
      message: "Please confirm the measurement date for our balcony project.",
      priority: "Medium",
      status: "Open",
      conversation: [{ sender: "customer", message: "Please confirm the measurement date for our balcony project.", createdAt: new Date() }],
    },
    {
      customerId: customerC._id,
      projectId: jobFabrication._id,
      subject: "Fabrication progress update",
      message: "Can you share an update on level 1 fabrication?",
      priority: "High",
      status: "Closed",
      response: "Level 1 frame is 60% complete. Install scheduled next week.",
      respondedBy: adminUser?._id || null,
      respondedAt: daysFromNow(-1),
      conversation: [
        { sender: "customer", message: "Can you share an update on level 1 fabrication?", createdAt: daysFromNow(-2) },
        { sender: "admin", userId: adminUser?._id || null, message: "Level 1 frame is 60% complete. Install scheduled next week.", createdAt: daysFromNow(-1) },
      ],
    },
  ]);

  console.log("✅ Demo data seeded:");
  console.log(`   Leads: 5 (New, Contacted, Quoted, Converted, Lost)`);
  console.log(`   Jobs: 3 (Site Measurement, Job Scheduling, Fabrication)`);
  console.log(`   Quotes: 3 (Draft, Sent, Accepted)`);
  console.log(`   Workflow: measurement, planning, drafting, kanban, materials, fabrication, QC, installation`);
  console.log(`   Finance: 2 invoices, 1 payment`);
  console.log(`   HR: 3 attendance records`);
  console.log(`   Portal: 2 contact requests`);

  return { skipped: false };
}

async function ensureCustomerPortalData() {
  const { tax, paymentMode, admin } = await ensureErpBasics();
  const customerUser = await User.findOne({ email: "customer@crm.com", role: "customer" });

  let customer = await Customer.findOne({ email: "customer@crm.com" });
  if (!customer) {
    customer = await Customer.create({
      name: "Default Customer",
      companyName: "Demo Customer Company",
      email: "customer@crm.com",
      mobile: "+910000000001",
      phone: "+910000000001",
      address: "12 Market Street, Sydney NSW",
      contactPerson: "Default Customer",
      portalEmail: "customer@crm.com",
      portalInvitedAt: new Date(),
      status: "Active",
    });
  }

  if (customerUser) {
    customerUser.customer = customer._id;
    await customerUser.save();
    customer.user = customerUser._id;
    customer.portalEmail = "customer@crm.com";
    await customer.save();
  }

  let job = await Job.findOne({ jobId: DEMO_MARKER_JOB_ID });
  if (!job) {
    let lead = await Lead.findOne({ email: "emma@riverside.demo" });
    if (!lead) {
      lead = await Lead.create({
        clientName: "Riverside Residence",
        contactPerson: "Default Customer",
        phone: "+910000000001",
        email: "emma@riverside.demo",
        siteAddress: "12 Market Street, Sydney NSW",
        category: "Residential",
        projectType: "Balustrade",
        leadSource: "Manual Entry",
        status: "Converted",
      });
    }

    job = await Job.create({
      jobId: DEMO_MARKER_JOB_ID,
      customer: "Default Customer",
      site: "12 Market Street, Sydney NSW",
      stage: "Site Measurement",
      lockedValue: 45000,
      systemState: "Active",
      leadId: lead._id,
      customerId: customer._id,
      workflowEvents: {
        siteMeasurement: {
          scheduledDate: daysFromNow(2),
          expectedHours: 4,
          isCompleted: false,
        },
      },
    });
  } else {
    const updates = {};
    if (!job.leadId) {
      const lead = await Lead.findOne({ email: "emma@riverside.demo" });
      if (lead) updates.leadId = lead._id;
    }
    if (!job.customerId || String(job.customerId) !== String(customer._id)) {
      updates.customerId = customer._id;
    }
    if (Object.keys(updates).length) {
      await Job.updateOne({ _id: job._id }, { $set: updates });
      job = await Job.findById(job._id);
    }
  }

  let quote = await Quote.findOne({ jobId: job._id });
  if (!quote && job.leadId) {
    quote = await Quote.findOne({ leadId: job.leadId }).sort({ createdAt: -1 });
  }
  if (!quote && job.leadId) {
    const lead = await Lead.findById(job.leadId);
    quote = await Quote.create({
      leadId: job.leadId,
      customerId: customer._id,
      jobId: job._id,
      customerName: lead?.clientName || customer.name,
      contactPerson: lead?.contactPerson || customer.contactPerson,
      phone: lead?.phone || customer.phone || "+910000000001",
      email: lead?.email || customer.email,
      siteAddress: lead?.siteAddress || job.site,
      scope: "Supply and installation of balustrade as per approved design.",
      inclusions: "Materials, fabrication, delivery, and installation.",
      exclusions: "Civil works and scaffolding beyond standard scope.",
      totalAmount: Number(job.lockedValue || 45000),
      validUntil: daysFromNow(30),
      status: "Accepted",
      approvedAt: new Date(),
      categoryCode: "Residential",
      materialCode: "Aluminium",
    });
    await Job.updateOne({ _id: job._id }, { $set: { quoteId: quote._id } });
  } else if (quote) {
    await linkJobToQuote({ job, quoteId: quote._id, leadId: job.leadId });
  }

  const year = new Date().getFullYear();
  const invoiceSpecs = [
    {
      number: "INV-DEMO-C01",
      date: daysFromNow(-20),
      expiredDate: daysFromNow(10),
      total: 9000,
      subTotal: 8181.82,
      taxTotal: 818.18,
      amountPaid: 0,
      amountDue: 9000,
      status: "Issued",
      invoiceType: "Progress Payment",
      stage: "siteMeasurement",
      items: [{ itemName: "Deposit — site measurement", description: "20% progress", quantity: 1, price: 9000, total: 9000 }],
    },
    {
      number: "INV-DEMO-C02",
      date: daysFromNow(-45),
      expiredDate: daysFromNow(-15),
      total: 5000,
      subTotal: 4545.45,
      taxTotal: 454.55,
      amountPaid: 5000,
      amountDue: 0,
      status: "Paid",
      invoiceType: "Progress Payment",
      stage: "drafting",
      items: [{ itemName: "Design deposit", description: "Paid in full", quantity: 1, price: 5000, total: 5000 }],
    },
    {
      number: "INV-DEMO-C03",
      date: daysFromNow(-10),
      expiredDate: daysFromNow(20),
      total: 12000,
      subTotal: 10909.09,
      taxTotal: 1090.91,
      amountPaid: 6000,
      amountDue: 6000,
      status: "Partially Paid",
      invoiceType: "Progress Payment",
      stage: "fabrication",
      items: [{ itemName: "Fabrication milestone", description: "50% paid", quantity: 1, price: 12000, total: 12000 }],
    },
    {
      number: "INV-DEMO-C04",
      date: daysFromNow(-35),
      expiredDate: daysFromNow(-5),
      total: 4500,
      subTotal: 4090.91,
      taxTotal: 409.09,
      amountPaid: 0,
      amountDue: 4500,
      status: "Overdue",
      invoiceType: "Final",
      stage: "jobCompletion",
      items: [{ itemName: "Variation invoice", description: "Overdue balance", quantity: 1, price: 4500, total: 4500 }],
    },
  ];

  const invoiceIds = [];
  for (const spec of invoiceSpecs) {
    const invoice = await Invoice.findOneAndUpdate(
      { number: spec.number },
      {
        ...spec,
        createdBy: admin._id,
        year,
        job: job._id,
        taxRate: Number(tax.taxValue),
        currency: "AUD",
        removed: false,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    invoiceIds.push(invoice._id);
  }

  const paidInvoice = await Invoice.findOne({ number: "INV-DEMO-C02" });
  const partialInvoice = await Invoice.findOne({ number: "INV-DEMO-C03" });

  if (paidInvoice) {
    const existing = await Payment.findOne({ ref: "PAY-DEMO-C02" });
    if (!existing) {
      const paymentCount = await Payment.countDocuments();
      await Payment.create({
        createdBy: admin._id,
        number: paymentCount + 1,
        date: daysFromNow(-30),
        amount: 5000,
        currency: "AUD",
        paymentMode: paymentMode._id,
        ref: "PAY-DEMO-C02",
        description: "Full payment — design deposit",
        invoice: paidInvoice._id,
      });
    }
  }

  if (partialInvoice) {
    const existing = await Payment.findOne({ ref: "PAY-DEMO-C03" });
    if (!existing) {
      const paymentCount = await Payment.countDocuments();
      await Payment.create({
        createdBy: admin._id,
        number: paymentCount + 1,
        date: daysFromNow(-5),
        amount: 6000,
        currency: "AUD",
        paymentMode: paymentMode._id,
        ref: "PAY-DEMO-C03",
        description: "Partial payment — fabrication",
        invoice: partialInvoice._id,
      });
    }
  }

  const totals = await Invoice.aggregate([
    { $match: { job: job._id, removed: false } },
    {
      $group: {
        _id: null,
        totalInvoiced: { $sum: "$total" },
        totalPaid: { $sum: "$amountPaid" },
      },
    },
  ]);

  if (totals[0]) {
    job.totalInvoiced = totals[0].totalInvoiced;
    job.totalPaid = totals[0].totalPaid;
    await job.save();
  }

  const openContact = await Contact.findOne({
    customerId: customer._id,
    subject: "When will site measurement happen?",
  });
  if (!openContact) {
    await Contact.create({
      customerId: customer._id,
      projectId: job._id,
      subject: "When will site measurement happen?",
      message: "Please confirm the measurement date for our balcony project.",
      priority: "Medium",
      status: "Open",
      conversation: [
        {
          sender: "customer",
          message: "Please confirm the measurement date for our balcony project.",
          createdAt: new Date(),
        },
      ],
    });
  }

  console.log("✅ Customer portal demo data ready (projects, invoices, payments, contacts, quotes)");
}

module.exports = { seedDemoData, clearDemoData, ensureCustomerPortalData, DEMO_MARKER_JOB_ID };
