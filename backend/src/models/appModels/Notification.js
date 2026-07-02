const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      default: null,
      index: true,
    },
    role: {
      type: String,
      enum: ["admin", "worker", "customer", "siteengineer", "all"],
      default: "admin",
    },
    type: {
      type: String,
      enum: [
        "appointment_reminder",
        "workflow",
        "invoice_reminder",
        "eta",
        "general",
      ],
      default: "general",
    },
    title: { type: String, trim: true, required: true },
    body: { type: String, trim: true, default: "" },
    link: { type: String, trim: true, default: "" },
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
      default: null,
    },
    read: { type: Boolean, default: false },
    readAt: { type: Date, default: null },
    scheduledFor: { type: Date, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.Notification ||
  mongoose.model("Notification", notificationSchema);
