const mongoose = require("mongoose");

const NCR_STATUS = ["Open", "In Progress", "Closed"];
const REINSPECTION_STATUS = ["Not Required", "Pending", "Passed", "Failed"];

const NcrSchema = new mongoose.Schema(
  {
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
      required: true,
      index: true,
    },
    qcItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Qc",
      required: true,
      index: true,
    },
    ncrNumber: {
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
      default: "",
      trim: true,
    },
    rootCause: {
      type: String,
      default: "",
      trim: true,
    },
    correctiveAction: {
      type: String,
      default: "",
      trim: true,
    },
    assignedTo: {
      type: String,
      default: "",
      trim: true,
    },
    dueDate: {
      type: String,
      default: "",
      trim: true,
    },
    status: {
      type: String,
      enum: NCR_STATUS,
      default: "Open",
    },
    reinspectionRequired: {
      type: Boolean,
      default: true,
    },
    reinspectionStatus: {
      type: String,
      enum: REINSPECTION_STATUS,
      default: "Pending",
    },
    reinspectionAttempts: {
      type: Number,
      default: 0,
      min: 0,
    },
    reinspectionNotes: {
      type: String,
      default: "",
      trim: true,
    },
    reinspectionBy: {
      type: String,
      default: "",
      trim: true,
    },
    reinspectionDate: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Ncr || mongoose.model("Ncr", NcrSchema);
