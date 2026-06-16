const mongoose = require("mongoose");

const QC_STATUS = ["Pending", "Pass", "Fail", "Rework"];

const QCSchema = new mongoose.Schema(
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

    inspectionType: {
      type: String,
      default: "",
      trim: true,
    },

    checkedBy: {
      type: String,
      default: "",
      trim: true,
    },

    checkedDate: {
      type: String,
      default: "",
      trim: true,
    },

    status: {
      type: String,
      enum: QC_STATUS,
      default: "Pending",
    },

    remarks: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Qc || mongoose.model("Qc", QCSchema);