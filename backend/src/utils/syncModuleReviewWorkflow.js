const SiteEngineerReview = require("../models/appModels/SiteEngineerReview");

/** Backfill workflow stage SE status from approved module reviews (fixes stale Pending). */
const syncApprovedModuleReviewsToWorkflow = async (jobDoc) => {
  if (!jobDoc?._id) return jobDoc;

  const reviews = await SiteEngineerReview.find({
    jobId: jobDoc._id,
    reviewType: "module",
    status: "Approved",
    moduleStageKey: { $ne: null },
  });

  if (!reviews.length) return jobDoc;

  let changed = false;
  if (!jobDoc.workflowEvents) jobDoc.workflowEvents = {};

  for (const review of reviews) {
    const key = review.moduleStageKey;
    if (!key) continue;
    if (!jobDoc.workflowEvents[key]) {
      jobDoc.workflowEvents[key] = {};
    }
    const stage = jobDoc.workflowEvents[key];
    if (stage.siteEngineerStatus !== "Approved") {
      stage.siteEngineerStatus = "Approved";
      stage.siteEngineerCheckedBy = review.reviewedBy || stage.siteEngineerCheckedBy;
      stage.siteEngineerCheckedAt = review.reviewedAt || stage.siteEngineerCheckedAt || new Date();
      changed = true;
    }
  }

  if (changed) {
    jobDoc.markModified("workflowEvents");
    await jobDoc.save();
  }

  return jobDoc;
};

module.exports = {
  syncApprovedModuleReviewsToWorkflow,
};
