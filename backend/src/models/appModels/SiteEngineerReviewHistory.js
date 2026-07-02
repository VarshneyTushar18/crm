const mongoose = require("mongoose");

const siteEngineerReviewHistorySchema = new mongoose.Schema(
  {
    reviewId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SiteEngineerReview",
      required: true,
      index: true,
    },
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
    },
    moduleStageKey: { type: String, trim: true, default: "" },
    reviewType: {
      type: String,
      enum: ["drawing", "module"],
      default: "drawing",
    },
    action: { type: String, trim: true, required: true },
    fromStatus: { type: String, trim: true, default: "" },
    toStatus: { type: String, trim: true, default: "" },
    comments: { type: String, trim: true, default: "" },
    actor: { type: String, trim: true, default: "" },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.SiteEngineerReviewHistory ||
  mongoose.model("SiteEngineerReviewHistory", siteEngineerReviewHistorySchema);
