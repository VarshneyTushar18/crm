const mongoose = require("mongoose");

const hoursLogSchema = new mongoose.Schema(
  {
    workerName: { type: String, trim: true, default: "" },
    role: { type: String, trim: true, default: "Installer" },
    hours: { type: Number, default: 0 },
    workDate: { type: String, trim: true, default: "" },
    notes: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

const safetyChecklistSchema = new mongoose.Schema(
  {
    ppeVerified: { type: Boolean, default: false },
    siteBriefed: { type: Boolean, default: false },
    permitsChecked: { type: Boolean, default: false },
    equipmentInspected: { type: Boolean, default: false },
  },
  { _id: false }
);

const jobCardSchema = new mongoose.Schema(
  {
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
      required: true,
      index: true,
    },
    installationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Installation",
      default: null,
      index: true,
    },
    cardNumber: {
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
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    sequenceOrder: {
      type: Number,
      default: 0,
      min: 0,
    },
    locationArea: {
      type: String,
      trim: true,
      default: "",
    },
    assignedInstallers: {
      type: [String],
      default: [],
    },
    siteAccessNotes: {
      type: String,
      trim: true,
      default: "",
    },
    toolsRequired: {
      type: String,
      trim: true,
      default: "",
    },
    materialsRequired: {
      type: String,
      trim: true,
      default: "",
    },
    completionCriteria: {
      type: String,
      trim: true,
      default: "",
    },
    safetyChecklist: {
      type: safetyChecklistSchema,
      default: () => ({}),
    },
    plannedStart: {
      type: String,
      trim: true,
      default: "",
    },
    plannedEnd: {
      type: String,
      trim: true,
      default: "",
    },
    actualStart: {
      type: String,
      trim: true,
      default: "",
    },
    actualEnd: {
      type: String,
      trim: true,
      default: "",
    },
    expectedHours: {
      type: Number,
      default: 0,
    },
    actualHours: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["Pending", "Assigned", "In Progress", "Completed", "On Hold"],
      default: "Pending",
    },
    hoursLog: {
      type: [hoursLogSchema],
      default: [],
    },
    photoUrls: {
      type: [String],
      default: [],
    },
    snagIssue: {
      type: String,
      trim: true,
      default: "",
    },
    remarks: {
      type: String,
      trim: true,
      default: "",
    },
    createdBy: {
      type: String,
      trim: true,
      default: "",
    },
    completedBy: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.JobCard || mongoose.model("JobCard", jobCardSchema);
