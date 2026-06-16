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
require("../models/appModels/Taxes");
require("../models/appModels/PaymentMode");
require("../models/coreModels/Admin");

const { seedDefaultUsers } = require("../setup/seedUsers");
const { seedDemoData, ensureCustomerPortalData } = require("../setup/seedDemoData");

async function run() {
  if (!process.env.DATABASE) {
    console.error("DATABASE URL not found in backend/.env");
    process.exit(1);
  }

  const fresh = process.argv.includes("--fresh");

  await mongoose.connect(process.env.DATABASE);
  await seedDefaultUsers();
  await seedDemoData({ fresh });
  await ensureCustomerPortalData();
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
