const mongoose = require("mongoose");

const authSessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    tokenHash: {
      type: String,
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ["admin", "worker", "customer", "siteEngineer"],
      required: true,
    },
    deviceId: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },
    deviceLabel: {
      type: String,
      default: "",
      trim: true,
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
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    isRevoked: {
      type: Boolean,
      default: false,
      index: true,
    },
    revokedAt: {
      type: Date,
      default: null,
    },
    revokedReason: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { timestamps: true }
);

authSessionSchema.index({ userId: 1, isRevoked: 1, expiresAt: 1 });

module.exports =
  mongoose.models.AuthSession || mongoose.model("AuthSession", authSessionSchema);
