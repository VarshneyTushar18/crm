const mongoose = require("mongoose");

const proofSchema = new mongoose.Schema(
  {
    fileUrl: { type: String, trim: true, default: "" },
    originalName: { type: String, trim: true, default: "" },
    kind: {
      type: String,
      enum: ["photo", "video", "document", "other"],
      default: "photo",
    },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const checklistItemSchema = new mongoose.Schema(
  {
    label: { type: String, trim: true, required: true },
    done: { type: Boolean, default: false },
  },
  { _id: false }
);

const locationPingSchema = new mongoose.Schema(
  {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    capturedAt: { type: Date, default: Date.now },
    note: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

const workerTaskSchema = new mongoose.Schema(
  {
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
      default: null,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    siteZone: {
      type: String,
      trim: true,
      default: "",
    },
    location: {
      type: String,
      trim: true,
      default: "",
    },
    priority: {
      type: Number,
      min: 1,
      max: 5,
      default: 3,
      index: true,
    },
    expectedDurationMinutes: {
      type: Number,
      default: 60,
      min: 0,
    },
    status: {
      type: String,
      enum: [
        "Assigned",
        "In Progress",
        "Submitted",
        "Completed",
        "Rejected",
        "Cancelled",
      ],
      default: "Assigned",
      index: true,
    },
    assigneeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    assigneeWorkerId: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },
    assigneeName: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },
    assignedById: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    assignedByName: {
      type: String,
      trim: true,
      default: "",
    },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    startLatitude: { type: Number, default: null },
    startLongitude: { type: Number, default: null },
    completeLatitude: { type: Number, default: null },
    completeLongitude: { type: Number, default: null },
    checklist: {
      type: [checklistItemSchema],
      default: [],
    },
    remarks: {
      type: String,
      trim: true,
      default: "",
    },
    proofs: {
      type: [proofSchema],
      default: [],
    },
    locationTrail: {
      type: [locationPingSchema],
      default: [],
    },
    idleFlagged: {
      type: Boolean,
      default: false,
    },
    reviewStatus: {
      type: String,
      enum: ["None", "Pending Review", "Approved", "Rejected"],
      default: "None",
      index: true,
    },
    reviewRemarks: {
      type: String,
      trim: true,
      default: "",
    },
    reviewedByName: {
      type: String,
      trim: true,
      default: "",
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

workerTaskSchema.index({ assigneeId: 1, status: 1, createdAt: -1 });
workerTaskSchema.index({ reviewStatus: 1, updatedAt: -1 });

module.exports =
  mongoose.models.WorkerTask || mongoose.model("WorkerTask", workerTaskSchema);
