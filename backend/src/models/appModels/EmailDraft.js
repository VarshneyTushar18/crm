const mongoose = require("mongoose");

const recipientSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, trim: true, lowercase: true },
    name: { type: String, default: "", trim: true },
    workerId: { type: String, default: "", trim: true },
  },
  { _id: false }
);

const emailDraftSchema = new mongoose.Schema(
  {
    scope: {
      type: String,
      enum: ["single", "all"],
      default: "single",
    },
    to: { type: String, default: "", trim: true, lowercase: true },
    recipientName: { type: String, default: "", trim: true },
    workerId: { type: String, default: "", trim: true },
    recipients: { type: [recipientSchema], default: [] },
    subject: { type: String, required: true, trim: true },
    body: { type: String, required: true, trim: true },
    title: { type: String, default: "", trim: true },
    notifyInApp: { type: Boolean, default: true },
    status: {
      type: String,
      enum: ["pending", "sent", "cancelled", "failed"],
      default: "pending",
      index: true,
    },
    createdById: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    createdByName: { type: String, default: "", trim: true },
    expiresAt: { type: Date, required: true, index: true },
    sentAt: { type: Date, default: null },
    emailsSent: { type: Number, default: 0 },
    emailFailed: { type: Number, default: 0 },
    notifiedCount: { type: Number, default: 0 },
    lastError: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.EmailDraft || mongoose.model("EmailDraft", emailDraftSchema);
