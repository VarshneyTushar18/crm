require("module-alias/register");
const path = require("path");
const mongoose = require("mongoose");

const envPath = path.resolve(__dirname, "../../.env");
const envLocalPath = path.resolve(__dirname, "../../.env.local");
require("dotenv").config({ path: envPath, override: true });
require("dotenv").config({ path: envLocalPath, override: true });

require("../models/appModels/User");
require("../models/appModels/Employee");
require("../models/appModels/Customer");
require("../models/appModels/Job");
require("../models/appModels/Lead");
require("../models/appModels/Quote");
require("../models/appModels/Client");
require("../models/appModels/SiteMeasurement");
require("../models/appModels/Planning");
require("../models/appModels/Drafting");
require("../models/appModels/KanbanTask");
require("../models/appModels/MaterialPurchase");
require("../models/appModels/Fabrication");
require("../models/appModels/Qc");
require("../models/appModels/Installation");
require("../models/appModels/Invoice");
require("../models/appModels/Payment");
require("../models/appModels/Attendance");
require("../models/appModels/Contact");
require("../models/appModels/Notification");
require("../models/appModels/SiteEngineerReview");
require("../models/appModels/ScheduleAssignment");
require("../models/coreModels/Admin");

const { seedDefaultUsers } = require("../setup/seedUsers");
const {
  seedDemoData,
  ensureCustomerPortalData,
  clearDemoData,
} = require("../setup/seedDemoData");

const Job = mongoose.models.Job;
const Lead = mongoose.models.Lead;
const Customer = mongoose.models.Customer;
const Quote = mongoose.models.Quote;
const Client = mongoose.models.Client;
const SiteMeasurement = mongoose.models.SiteMeasurement;
const Planning = mongoose.models.Planning;
const Drafting = mongoose.models.Drafting;
const KanbanTask = mongoose.models.KanbanTask;
const MaterialPurchase = mongoose.models.MaterialPurchase;
const Fabrication = mongoose.models.Fabrication;
const Qc = mongoose.models.Qc;
const Installation = mongoose.models.Installation;
const Invoice = mongoose.models.Invoice;
const Payment = mongoose.models.Payment;
const Employee = mongoose.models.Employee;
const Attendance = mongoose.models.Attendance;
const Contact = mongoose.models.Contact;
const Notification = mongoose.models.Notification;
const SiteEngineerReview = mongoose.models.SiteEngineerReview;
const ScheduleAssignment = mongoose.models.ScheduleAssignment;
const PaymentMode = mongoose.models.PaymentMode;
const Admin = mongoose.models.Admin;

async function keepLatestTwo(model, filter, sort = { createdAt: -1 }) {
  const docs = await model.find(filter).sort(sort).select("_id");
  const keep = docs.slice(0, 2).map((d) => d._id);
  const remove = docs.slice(2).map((d) => d._id);
  if (remove.length) {
    await model.deleteMany({ _id: { $in: remove } });
  }
  return keep;
}

async function trimToTwoPerModule() {
  const demoJobs = await Job.find({ jobId: /^DEMO-/ }).sort({ createdAt: -1 });
  const keptJobIds = demoJobs.slice(0, 2).map((d) => d._id);
  const removedJobIds = demoJobs.slice(2).map((d) => d._id);

  if (removedJobIds.length) {
    await Job.deleteMany({ _id: { $in: removedJobIds } });
  }

  await Promise.all([
    SiteMeasurement.deleteMany({ jobId: { $nin: keptJobIds } }),
    Planning.deleteMany({ jobId: { $nin: keptJobIds } }),
    Drafting.deleteMany({ jobId: { $nin: keptJobIds } }),
    KanbanTask.deleteMany({ jobId: { $nin: keptJobIds } }),
    MaterialPurchase.deleteMany({ jobId: { $nin: keptJobIds } }),
    Fabrication.deleteMany({ jobId: { $nin: keptJobIds } }),
    Qc.deleteMany({ jobId: { $nin: keptJobIds } }),
    Installation.deleteMany({ jobId: { $nin: keptJobIds } }),
    Contact.deleteMany({ projectId: { $nin: keptJobIds } }),
    SiteEngineerReview.deleteMany({ jobId: { $nin: keptJobIds } }),
    ScheduleAssignment.deleteMany({ jobId: { $nin: keptJobIds } }),
  ]);

  await keepLatestTwo(SiteMeasurement, { jobId: { $in: keptJobIds } });
  await keepLatestTwo(Planning, { jobId: { $in: keptJobIds } });
  await keepLatestTwo(Drafting, { jobId: { $in: keptJobIds } });
  await keepLatestTwo(KanbanTask, { jobId: { $in: keptJobIds } });
  await keepLatestTwo(MaterialPurchase, { jobId: { $in: keptJobIds } });
  await keepLatestTwo(Fabrication, { jobId: { $in: keptJobIds } });
  await keepLatestTwo(Qc, { jobId: { $in: keptJobIds } });
  await keepLatestTwo(Installation, { jobId: { $in: keptJobIds } });
  await keepLatestTwo(Contact, { projectId: { $in: keptJobIds } });
  await keepLatestTwo(SiteEngineerReview, { jobId: { $in: keptJobIds } });
  await keepLatestTwo(ScheduleAssignment, { jobId: { $in: keptJobIds } });

  await Lead.deleteMany({ email: /@demo\.com$|@demo$|@riverside\.demo$/ });
  await Quote.deleteMany({ quoteNumber: /^DEMO-Q-/ });
  await Client.deleteMany({ email: /@demo\.com$|@riverside\.demo$/ });
  await Customer.deleteMany({ email: { $in: ["harbour@demo.com", "skyline@demo.com"] } });

  const keptJobs = await Job.find({ _id: { $in: keptJobIds } }).select("leadId customerId");
  const keepLeadIds = keptJobs.map((j) => j.leadId).filter(Boolean);
  const keepCustomerIds = keptJobs.map((j) => j.customerId).filter(Boolean);

  const leadDocs = await Lead.find({ _id: { $in: keepLeadIds } }).sort({ createdAt: -1 }).limit(2);
  const finalLeadIds = leadDocs.map((l) => l._id);
  const customerDocs = await Customer.find({ _id: { $in: keepCustomerIds } }).sort({ createdAt: -1 }).limit(2);
  const finalCustomerIds = customerDocs.map((c) => c._id);

  await keepLatestTwo(Quote, { jobId: { $in: keptJobIds } });

  const invoiceKeepIds = await keepLatestTwo(Invoice, { job: { $in: keptJobIds } });
  await Payment.deleteMany({ invoice: { $nin: invoiceKeepIds } });
  await keepLatestTwo(Payment, { invoice: { $in: invoiceKeepIds } });

  await keepLatestTwo(Employee, { status: { $ne: "Removed" } });
  await keepLatestTwo(Attendance, { workerEmail: /@crm\.com$/i });
  await keepLatestTwo(Notification, {});
  await keepLatestTwo(Client, {});

  await Job.updateMany({ _id: { $in: keptJobIds }, leadId: { $nin: finalLeadIds } }, { $set: { leadId: finalLeadIds[0] || null } });
  await Job.updateMany(
    { _id: { $in: keptJobIds }, customerId: { $nin: finalCustomerIds } },
    { $set: { customerId: finalCustomerIds[0] || null } }
  );

  const keptJobsHydrated = await Job.find({ _id: { $in: keptJobIds } });
  for (let i = 0; i < keptJobsHydrated.length; i += 1) {
    const job = keptJobsHydrated[i];

    if (!job.leadId) {
      const lead = await Lead.create({
        clientName: job.customer || `Demo Client ${i + 1}`,
        contactPerson: `Demo Contact ${i + 1}`,
        phone: `+6140000000${i + 1}`,
        email: `demo-lite-lead-${i + 1}@demo.com`,
        siteAddress: job.site || `Demo Site ${i + 1}`,
        category: "Commercial",
        projectType: "Balustrade",
        leadSource: "Manual Entry",
        status: "Quoted",
      });
      job.leadId = lead._id;
      await job.save();
    }

    const hasQuote = await Quote.exists({ jobId: job._id });
    if (!hasQuote) {
      await Quote.create({
        quoteNumber: `DEMO-Q-LITE-${i + 1}`,
        leadId: job.leadId,
        customerId: job.customerId || null,
        jobId: job._id,
        customerName: job.customer || `Demo Client ${i + 1}`,
        contactPerson: `Demo Contact ${i + 1}`,
        phone: `+6140000000${i + 1}`,
        email: `demo-lite-lead-${i + 1}@demo.com`,
        siteAddress: job.site || `Demo Site ${i + 1}`,
        scope: "Demo scope",
        inclusions: "Materials and installation",
        exclusions: "Civil and electrical work",
        validUntil: new Date(Date.now() + 21 * 86400000),
        totalAmount: Number(job.lockedValue || 25000),
        status: "Sent",
      });
    }

    const hasMeasurement = await SiteMeasurement.exists({ jobId: job._id });
    if (!hasMeasurement) {
      await SiteMeasurement.create({
        jobId: job._id,
        measuredBy: "Default Worker",
        siteAddress: job.site || "Demo site",
        height: 1.2,
        width: 10,
        length: 15,
        materialType: "Glass",
        status: "Pending",
      });
    }
  }

  const invoices = await Invoice.find({ job: { $in: keptJobIds } }).sort({ createdAt: -1 });
  if (invoices.length < 2 && keptJobIds.length) {
    const admin = await Admin.findOne({});
    const paymentMode = await PaymentMode.findOne({});
    const toCreate = 2 - invoices.length;
    for (let i = 0; i < toCreate; i += 1) {
      const number = `INV-DEMO-LITE-${i + 1}`;
      const invoice = await Invoice.findOneAndUpdate(
        { number },
        {
          createdBy: admin?._id,
          number,
          year: new Date().getFullYear(),
          date: new Date(),
          expiredDate: new Date(Date.now() + 20 * 86400000),
          job: keptJobIds[i % keptJobIds.length],
          invoiceType: "Progress Payment",
          items: [{ itemName: "Demo milestone", quantity: 1, price: 5000, total: 5000 }],
          total: 5000,
          subTotal: 4545.45,
          taxTotal: 454.55,
          taxRate: 10,
          status: "Issued",
          amountPaid: 0,
          amountDue: 5000,
          currency: "AUD",
          paymentMode: paymentMode?._id || null,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      invoices.push(invoice);
    }
  }
}

async function run() {
  if (!process.env.DATABASE) {
    console.error("DATABASE URL not found in backend/.env");
    process.exit(1);
  }

  await mongoose.connect(process.env.DATABASE);
  await seedDefaultUsers();
  await seedDemoData({ fresh: true });
  await ensureCustomerPortalData();
  await mongoose.disconnect();
  console.log("✅ Lite demo data ready.");
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

