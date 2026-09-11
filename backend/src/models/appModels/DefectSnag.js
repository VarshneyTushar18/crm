const mongoose = require("mongoose");

const DEFECT_SNAG_TYPES = ["Defect", "Snag"];
const DEFECT_SNAG_STATUS = ["Open", "In Progress", "Closed"];

const DefectSnagSchema = new mongoose.Schema(
  {
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
      required: true,
      index: true,
    },
    installationActivityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Installation",
      default: null,
      index: true,
    },
    type: {
      type: String,
      enum: DEFECT_SNAG_TYPES,
      default: "Snag",
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
    locationArea: {
      type: String,
      default: "",
      trim: true,
    },
    owner: {
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
      enum: DEFECT_SNAG_STATUS,
      default: "Open",
      index: true,
    },
    photoUrls: {
      type: [String],
      default: [],
    },
    closedBy: {
      type: String,
      default: "",
      trim: true,
    },
    closedAt: {
      type: Date,
      default: null,
    },
    closeOutNotes: {
      type: String,
      default: "",
      trim: true,
    },
    closeOutPhotoUrls: {
      type: [String],
      default: [],
    },
    source: {
      type: String,
      enum: ["installation", "manual"],
      default: "manual",
    },
  },
  { timestamps: true }
);

DefectSnagSchema.index({ jobId: 1, status: 1 });

module.exports =
  mongoose.models.DefectSnag || mongoose.model("DefectSnag", DefectSnagSchema);
module.exports.DEFECT_SNAG_TYPES = DEFECT_SNAG_TYPES;
module.exports.DEFECT_SNAG_STATUS = DEFECT_SNAG_STATUS;
