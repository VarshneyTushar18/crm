const mongoose = require("mongoose");

const SettingsSchema = new mongoose.Schema(
  {
    settingKey: { type: String, required: true, unique: true, trim: true },
    settingValue: { type: mongoose.Schema.Types.Mixed, default: "" },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.Settings || mongoose.model("Settings", SettingsSchema);