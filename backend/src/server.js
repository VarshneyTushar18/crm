require('module-alias/register');
const mongoose = require('mongoose');
const { globSync } = require('glob');
const path = require('path');

// Make sure we are running node 7.6+
const [major, minor] = process.versions.node.split('.').map(parseFloat);
if (major < 20) {
  console.log('Please upgrade your node.js version at least 20 or greater. 👌\n ');
  process.exit();
}

// import environmental variables from our variables.env file
const envPath = path.resolve(__dirname, '../.env');
const envLocalPath = path.resolve(__dirname, '../.env.local');
require('dotenv').config({ path: envPath, override: true });
require('dotenv').config({ path: envLocalPath, override: true });

if (!process.env.DATABASE) {
  console.error('🔥 DATABASE URL not found in .env (backend/.env required).');
  process.exit(1);
}

mongoose.connect(process.env.DATABASE).catch(err => {
  console.warn('⚠️ Database connection failed. Running with mock data for development...');
});

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

mongoose.connection.on('error', (error) => {
  console.log(
    `1. 🔥 Common Error caused issue → : check your .env file first and add your mongodb url`
  );
  console.error(`2. 🚫 Error → : ${error.message}`);
});

// Statically load all models
require('./models/loadModels');

// Start our app!
const app = require('./app');
app.set('port', process.env.PORT || 8888);
const server = app.listen(app.get('port'), () => {
  console.log(`Express running → On PORT : ${server.address().port}`);
});
const { seedDefaultUsers } = require("./setup/seedUsers");
const { seedDemoData, ensureCustomerPortalData } = require("./setup/seedDemoData");
const { ensureDefaultPaymentModes } = require("./utils/ensurePaymentModes");

mongoose.connection.once("open", async () => {
  try {
    await seedDefaultUsers();
    await ensureDefaultPaymentModes();
    await seedDemoData();
    await ensureCustomerPortalData();
    const { ensureDefaultLeadSources } = require("./utils/leadSources");
    await ensureDefaultLeadSources();
  } catch (err) {
    console.error("⚠️ Seed failed:", err.message);
  }

  try {
    const { startLeadFollowUpReminderScheduler } = require("./services/leadFollowUpReminderService");
    startLeadFollowUpReminderScheduler();
  } catch (err) {
    console.error("⚠️ Lead follow-up reminder scheduler failed to start:", err.message);
  }
});
