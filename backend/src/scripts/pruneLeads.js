require("module-alias/register");
const path = require("path");
const mongoose = require("mongoose");

const envPath = path.resolve(__dirname, "../../.env");
const envLocalPath = path.resolve(__dirname, "../../.env.local");
require("dotenv").config({ path: envPath, override: true });
require("dotenv").config({ path: envLocalPath, override: true });

require("../models/appModels/Lead");

const Lead = mongoose.models.Lead;

const KEEP_CLIENT_NAMES = new Set([
  "Tarun",
  "Rajesh",
  "Metro Retail Fitout",
  "City Tower Glass",
  "Skyline Offices",
  "Riverside Residence",
]);

const STATUS_RANK = {
  Converted: 5,
  Locked: 4,
  Quoted: 3,
  Contacted: 2,
  New: 1,
};

function leadScore(lead) {
  return STATUS_RANK[lead.status] || 0;
}

async function run() {
  if (!process.env.DATABASE) {
    console.error("DATABASE URL not found in backend/.env");
    process.exit(1);
  }

  await mongoose.connect(process.env.DATABASE);

  const allLeads = await Lead.find({}).sort({ createdAt: 1 });
  console.log(`Found ${allLeads.length} leads`);

  const grouped = new Map();
  for (const lead of allLeads) {
    const key = String(lead.clientName || "").trim().toLowerCase();
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(lead);
  }

  const keepIds = new Set();

  for (const [key, leads] of grouped.entries()) {
    const name = leads[0]?.clientName || key;
    if (!KEEP_CLIENT_NAMES.has(name)) continue;

    const best = [...leads].sort((a, b) => leadScore(b) - leadScore(a))[0];
    keepIds.add(String(best._id));
    console.log(`KEEP: ${name} (${best.status}) -> ${best._id}`);
  }

  const toDelete = allLeads.filter((lead) => !keepIds.has(String(lead._id)));

  if (!toDelete.length) {
    console.log("Nothing to delete.");
    await mongoose.disconnect();
    process.exit(0);
  }

  console.log("\nDeleting:");
  for (const lead of toDelete) {
    console.log(`- ${lead.clientName} | ${lead.status} | ${lead.email || "-"} | ${lead._id}`);
    await Lead.findByIdAndDelete(lead._id);
  }

  const remaining = await Lead.find({}).sort({ createdAt: -1 });
  console.log(`\nDone. ${remaining.length} leads remaining:`);
  for (const lead of remaining) {
    console.log(`  ${lead.clientName} | ${lead.status} | ${lead.category}`);
  }

  await mongoose.disconnect();
  process.exit(0);
}

run().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
