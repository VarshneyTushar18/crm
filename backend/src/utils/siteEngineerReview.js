const SiteEngineerReview = require("../models/appModels/SiteEngineerReview");
const Job = require("../models/appModels/Job");

const syncJobSiteEngineerStage = async (jobId, actor) => {
  const reviews = await SiteEngineerReview.find({ jobId }).sort({ reviewedAt: -1 });
  const job = await Job.findById(jobId);
  if (!job) return null;

  if (!job.workflowEvents) job.workflowEvents = {};
  if (!job.workflowEvents.siteEngineerApproval) {
    job.workflowEvents.siteEngineerApproval = {
      stageStatus: "Pending",
      isCompleted: false,
      subtasks: [],
      revisionCount: 0,
    };
  }

  const stage = job.workflowEvents.siteEngineerApproval;
  const pending = reviews.filter((r) =>
    ["Pending", "Pending Review", "On Review", "Revision Required", "Rejected", "On Hold"].includes(
      r.status
    )
  );
  const approved = reviews.filter((r) => r.status === "Approved");
  const latestApproved = approved.find((r) => r.reviewedAt) || approved[0] || null;

  stage.revisionCount = reviews.filter((r) =>
    ["Rejected", "Revision Required"].includes(r.status)
  ).length;

  if (latestApproved) {
    const reviewer = latestApproved.reviewedBy || actor || "Site Engineer";
    stage.approvedBy = reviewer;
    stage.approvalDate = latestApproved.reviewedAt || stage.approvalDate || new Date();
  }

  if (reviews.length && pending.length === 0 && approved.length === reviews.length) {
    stage.isCompleted = true;
    stage.stageStatus = "Complete";
    stage.completedAt = stage.completedAt || latestApproved?.reviewedAt || new Date();
    stage.completedBy = latestApproved?.reviewedBy || actor || "Site Engineer";
  } else if (reviews.length) {
    stage.stageStatus = approved.length > 0 ? "In Progress" : "Pending";
    stage.isCompleted = false;
  }

  job.markModified("workflowEvents");
  await job.save();

  return { job, stage };
};

const ensureReviewForDrafting = async (drafting) => {
  if (!drafting?._id || !drafting?.jobId) return null;

  let review = await SiteEngineerReview.findOne({ draftingId: drafting._id });
  if (review) return review;

  review = await SiteEngineerReview.create({
    jobId: drafting.jobId,
    draftingId: drafting._id,
    reviewType: "drawing",
    drawingRef:
      drafting.drawingRef ||
      [drafting.title, drafting.revision].filter(Boolean).join(" — ") ||
      drafting.title ||
      "",
    status: "Pending Review",
  });

  const job = await Job.findById(drafting.jobId);
  if (job) {
    if (!job.workflowEvents) job.workflowEvents = {};
    if (!job.workflowEvents.siteEngineerApproval) {
      job.workflowEvents.siteEngineerApproval = {
        stageStatus: "In Progress",
        isCompleted: false,
        subtasks: [],
        revisionCount: 0,
      };
    } else if (!job.workflowEvents.siteEngineerApproval.isCompleted) {
      job.workflowEvents.siteEngineerApproval.stageStatus = "In Progress";
    }
    job.markModified("workflowEvents");
    await job.save();
  }

  return review;
};

module.exports = { ensureReviewForDrafting, syncJobSiteEngineerStage };
