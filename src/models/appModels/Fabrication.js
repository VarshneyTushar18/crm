const mongoose = require("mongoose");

const fabricationChecklistSchema = new mongoose.Schema(
  {
    ifcVerified: { type: Boolean, default: false },
    materialAvailable: { type: Boolean, default: false },
    cuttingCompleted: { type: Boolean, default: false },
    weldingCompleted: { type: Boolean, default: false },
    finishingCompleted: { type: Boolean, default: false },
    dimensionChecked: { type: Boolean, default: false },
    surfaceChecked: { type: Boolean, default: false },
    readyForQc: { type: Boolean, default: false },
  },
  { _id: false }
);

const fabricationHoursSchema = new mongoose.Schema(
  {
    workerName: { type: String, trim: true },
    role: { type: String, trim: true },
    hours: { type: Number, default: 0 },
    workDate: { type: String, trim: true },
    notes: { type: String, trim: true },
  },
  { _id: false }
);

const fabricationSchema = new mongoose.Schema(
  {
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
      required: true,
      index: true,
    },
    itemName: {
      type: String,
      required: true,
      trim: true,
    },
    drawingRef: {
      type: String,
      trim: true,
      default: "",
    },
    workstation: {
      type: String,
      trim: true,
      default: "",
    },
    assignedTeam: {
      type: String,
      trim: true,
      default: "",
    },
    quantity: {
      type: Number,
      default: 1,
      min: 1,
    },
    targetDate: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["Pending", "In Progress", "Completed", "Hold", "Rework"],
      default: "Pending",
    },
    remarks: {
      type: String,
      trim: true,
      default: "",
    },
    checklist: {
      type: fabricationChecklistSchema,
      default: () => ({}),
    },
    hoursLog: {
      type: [fabricationHoursSchema],
      default: [],
    },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.Fabrication ||
  mongoose.model("Fabrication", fabricationSchema);