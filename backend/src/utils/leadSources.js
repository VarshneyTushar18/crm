const Settings = require("../models/appModels/Settings");

const SETTING_KEY = "lead_sources";

const DEFAULT_LEAD_SOURCES = [
  "Website",
  "Phone Call",
  "Social Media",
  "Google",
  "Manual Entry",
  "Referral",
  "Trade Show",
];

async function getLeadSources() {
  const row = await Settings.findOne({ settingKey: SETTING_KEY });
  const value = row?.settingValue;
  if (Array.isArray(value) && value.length) {
    return value.map((s) => String(s).trim()).filter(Boolean);
  }
  return [...DEFAULT_LEAD_SOURCES];
}

async function setLeadSources(sources = []) {
  const cleaned = [...new Set(sources.map((s) => String(s).trim()).filter(Boolean))];
  if (!cleaned.length) {
    throw new Error("At least one lead source is required");
  }

  await Settings.findOneAndUpdate(
    { settingKey: SETTING_KEY },
    { settingKey: SETTING_KEY, settingValue: cleaned },
    { upsert: true, new: true }
  );

  return cleaned;
}

async function ensureDefaultLeadSources() {
  const existing = await Settings.findOne({ settingKey: SETTING_KEY });
  if (!existing) {
    await setLeadSources(DEFAULT_LEAD_SOURCES);
  }
}

module.exports = {
  SETTING_KEY,
  DEFAULT_LEAD_SOURCES,
  getLeadSources,
  setLeadSources,
  ensureDefaultLeadSources,
};
