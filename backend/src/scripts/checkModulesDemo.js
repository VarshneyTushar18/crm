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
require("../models/appModels/Lead");
require("../models/appModels/Job");
require("../models/appModels/Quote");
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

const Job = mongoose.models.Job;
const Invoice = mongoose.models.Invoice;

function byJobIds(ids) {
  return { jobId: { $in: ids } };
}

async function run() {
  if (!process.env.DATABASE) {
    console.error("DATABASE URL not found in backend/.env");
    process.exit(1);
  }

  await mongoose.connect(process.env.DATABASE);

  let allGood = true;
  console.log("Module Health Check");
  console.log("-------------------");

  const demoJobs = await Job.find({ jobId: /^DEMO-/ }).select("_id leadId");
  const demoJobIds = demoJobs.map((j) => j._id);
  const demoLeadIds = demoJobs.map((j) => j.leadId).filter(Boolean);
  const demoInvoices = await Invoice.find({ job: { $in: demoJobIds } }).select("_id");
  const demoInvoiceIds = demoInvoices.map((i) => i._id);

  const checks = [
    { model: "Employee", filter: {}, min: 1 },
    { model: "Customer", filter: { email: /@demo\.com$|@riverside\.demo$|customer@crm\.com$/i }, min: 1 },
    { model: "Lead", filter: { _id: { $in: demoLeadIds } }, min: 1 },
    { model: "Job", filter: { _id: { $in: demoJobIds } }, min: 1 },
    { model: "Quote", filter: { jobId: { $in: demoJobIds } }, min: 1 },
    { model: "SiteMeasurement", filter: { jobId: { $in: demoJobIds } }, min: 1 },
    { model: "Planning", filter: byJobIds(demoJobIds), min: 1 },
    { model: "Drafting", filter: byJobIds(demoJobIds), min: 1 },
    { model: "KanbanTask", filter: byJobIds(demoJobIds), min: 1 },
    { model: "MaterialPurchase", filter: byJobIds(demoJobIds), min: 1 },
    { model: "Fabrication", filter: byJobIds(demoJobIds), min: 1 },
    { model: "Qc", filter: byJobIds(demoJobIds), min: 1 },
    { model: "Installation", filter: byJobIds(demoJobIds), min: 1 },
    { model: "Invoice", filter: { _id: { $in: demoInvoiceIds } }, min: 1 },
    { model: "Payment", filter: { invoice: { $in: demoInvoiceIds } }, min: 1 },
    { model: "Attendance", filter: { workerEmail: /@crm\.com$/i }, min: 1 },
    { model: "Contact", filter: { projectId: { $in: demoJobIds } }, min: 1 },
    { model: "Notification", filter: {}, min: 1 },
  ];

  for (const check of checks) {
    const modelName = check.model;
    const model = mongoose.models[modelName];
    if (!model) {
      allGood = false;
      console.log(`❌ ${modelName}: model not loaded`);
      continue;
    }

    const count = await model.countDocuments(check.filter || {});
    const sample = await model.findOne(check.filter || {}).select("_id createdAt");
    const ok = count >= (check.min || 1);
    if (!ok) allGood = false;
    console.log(
      `${ok ? "✅" : "⚠️"} ${modelName}: count=${count} (expected >=${check.min || 1})${
        sample ? "" : " (no sample)"
      }`
    );
  }

  await mongoose.disconnect();
  if (!allGood) process.exit(2);
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

