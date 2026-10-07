const mongoose = require("mongoose");

const companyDayOffSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: true,
      index: true,
    },
    /** YYYY-MM-DD in business timezone (IST) for easy lookups */
    dateKey: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      default: "Company off day",
    },
    message: {
      type: String,
      default: "",
      trim: true,
    },
    createdByName: { type: String, default: "", trim: true },
    createdById: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    emailsSent: { type: Number, default: 0 },
    notifiedCount: { type: Number, default: 0 },
    removed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.CompanyDayOff ||
  mongoose.model("CompanyDayOff", companyDayOffSchema);
