const mongoose = require("mongoose");

const authDeviceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    deviceId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    label: {
      type: String,
      default: "",
      trim: true,
    },
    platform: {
      type: String,
      default: "",
      trim: true,
    },
    isPrimary: {
      type: Boolean,
      default: false,
    },
    lastSeenAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

authDeviceSchema.index({ userId: 1, deviceId: 1 }, { unique: true });

module.exports =
  mongoose.models.AuthDevice || mongoose.model("AuthDevice", authDeviceSchema);
