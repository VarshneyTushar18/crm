const mongoose = require("mongoose");

const fabricationProgressLogSchema = new mongoose.Schema(
  {
    fabricationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Fabrication",
      required: true,
      index: true,
    },
    drawingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Fabrication",
      required: true,
      index: true,
    },
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
      required: true,
      index: true,
    },
    oldPercentage: { type: Number, default: 0, min: 0, max: 100 },
    newPercentage: { type: Number, required: true, min: 0, max: 100 },
    remarks: { type: String, trim: true, default: "" },
    updatedBy: { type: String, trim: true, default: "" },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.FabricationProgressLog ||
  mongoose.model("FabricationProgressLog", fabricationProgressLogSchema);
