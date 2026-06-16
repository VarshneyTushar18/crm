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

const { seedDefaultUsers } = require("../setup/seedUsers");

async function run() {
  if (!process.env.DATABASE) {
    console.error("DATABASE URL not found in backend/.env");
    process.exit(1);
  }

  await mongoose.connect(process.env.DATABASE);
  await seedDefaultUsers();
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
