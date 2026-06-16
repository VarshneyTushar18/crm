const mongoose = require("mongoose");

const DRAFTING_STATUS = [
  "Draft",
  "Under Review",
  "Approved",
  "Rejected",
  "IFC Approved",
];

const DraftingSchema = new mongoose.Schema(
  {
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
      required: true,
      index: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    drawingType: {
      type: String,
      required: true,
      trim: true,
    },

    revision: {
      type: String,
      required: true,
      trim: true,
    },

    status: {
      type: String,
      enum: DRAFTING_STATUS,
      default: "Draft",
    },

    preparedBy: {
      type: String,
      default: "",
      trim: true,
    },

    checkedBy: {
      type: String,
      default: "",
      trim: true,
    },

    approvedBy: {
      type: String,
      default: "",
      trim: true,
    },

    remarks: {
      type: String,
      default: "",
      trim: true,
    },

    fileUrl: {
      type: String,
      default: "",
      trim: true,
    },

    isIFCApproved: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.Drafting || mongoose.model("Drafting", DraftingSchema);