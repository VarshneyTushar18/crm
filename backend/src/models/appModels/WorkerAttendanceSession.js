const mongoose = require("mongoose");

const workerAttendanceSessionSchema = new mongoose.Schema(
  {
    workerId: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },
    workerEmail: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
      index: true,
    },
    workerName: {
      type: String,
      default: "",
      trim: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    jobId: {
      type: String,
      default: "",
      trim: true,
    },
    checkInTime: {
      type: Date,
      required: true,
      default: Date.now,
    },
    checkOutTime: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ["checked_in", "checked_out"],
      default: "checked_in",
      index: true,
    },
    checkInLatitude: { type: Number, default: null },
    checkInLongitude: { type: Number, default: null },
    checkOutLatitude: { type: Number, default: null },
    checkOutLongitude: { type: Number, default: null },
    totalMinutes: {
      type: Number,
      default: 0,
    },
    // Liveness / anti-fraud audit (client-verified prompts; face-match cloud later)
    livenessPassed: { type: Boolean, default: false },
    livenessSteps: {
      type: [String],
      default: [],
    },
    livenessScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    faceMatchStatus: {
      type: String,
      enum: ["skipped", "pending", "passed", "failed"],
      default: "skipped",
    },
    faceMatchScore: {
      type: Number,
      default: null,
    },
    deviceId: {
      type: String,
      default: "",
      trim: true,
    },
    userAgent: {
      type: String,
      default: "",
      trim: true,
    },
    checkInIp: {
      type: String,
      default: "",
      trim: true,
    },
    checkOutIp: {
      type: String,
      default: "",
      trim: true,
    },
    checkInPhotoUrl: {
      type: String,
      default: "",
      trim: true,
    },
    checkOutPhotoUrl: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { timestamps: true }
);

workerAttendanceSessionSchema.index({ userId: 1, status: 1, checkInTime: -1 });
workerAttendanceSessionSchema.index({ workerId: 1, status: 1, checkInTime: -1 });

module.exports =
  mongoose.models.WorkerAttendanceSession ||
  mongoose.model("WorkerAttendanceSession", workerAttendanceSessionSchema);
