const mongoose = require("mongoose");

const authOtpLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    identifier: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    role: {
      type: String,
      enum: ["admin", "worker", "customer", "siteEngineer", "unknown"],
      default: "unknown",
    },
    channel: {
      type: String,
      enum: ["sms", "email", "app"],
      default: "app",
    },
    purpose: {
      type: String,
      enum: ["login", "resetPassword"],
      default: "login",
    },
    status: {
      type: String,
      enum: ["issued", "verified", "failed", "expired", "resendBlocked"],
      required: true,
    },
    ip: {
      type: String,
      default: "",
      trim: true,
    },
    userAgent: {
      type: String,
      default: "",
      trim: true,
    },
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.AuthOtpLog || mongoose.model("AuthOtpLog", authOtpLogSchema);
