const mongoose = require("mongoose");

const siteEngineerReviewSchema = new mongoose.Schema(
  {
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
      required: true,
      index: true,
    },
    draftingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Drafting",
      default: null,
      index: true,
    },
    moduleStageKey: { type: String, trim: true, default: "", index: true },
    reviewType: {
      type: String,
      enum: ["drawing", "module"],
      default: "drawing",
    },
    title: { type: String, trim: true, default: "" },
    drawingRef: { type: String, trim: true, default: "" },
    status: {
      type: String,
      enum: [
        "Pending",
        "Pending Review",
        "On Review",
        "Approved",
        "Rejected",
        "Revision Required",
        "On Hold",
      ],
      default: "Pending Review",
    },
    reviewedBy: { type: String, trim: true, default: "" },
    reviewedAt: { type: Date, default: null },
    comments: { type: String, trim: true, default: "" },
    revisionNumber: { type: Number, default: 0 },
    attachmentUrl: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.SiteEngineerReview ||
  mongoose.model("SiteEngineerReview", siteEngineerReviewSchema);
