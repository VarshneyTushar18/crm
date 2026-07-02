const SiteEngineerReview = require("../models/appModels/SiteEngineerReview");
const Job = require("../models/appModels/Job");
const { STAGE_LABELS } = require("./workflowDefaults");
const { syncJobSiteEngineerStage } = require("./siteEngineerReview");
const { notifyCustomer, notifySiteEngineer } = require("../services/notificationService");

const MODULES_REQUIRING_SITE_ENGINEER = [
  "siteMeasurement",
  "planning",
  "scheduling",
  "drafting",
  "materialPurchasing",
  "fabrication",
  "fabricationQc",
  "powderCoating",
  "powderCoatingQc",
  "finishing",
  "installation",
  "jobCompletion",
];

const requiresSiteEngineerCheck = (stageKey) =>
  MODULES_REQUIRING_SITE_ENGINEER.includes(stageKey);

const ensureModuleReview = async (jobId, stageKey) => {
  const title = STAGE_LABELS[stageKey] || stageKey;

  let review = await SiteEngineerReview.findOne({
    jobId,
    moduleStageKey: stageKey,
    reviewType: "module",
  });

  if (review) {
    if (review.status !== "Approved") {
      review.status = "Pending Review";
      review.title = title;
      review.drawingRef = title;
      await review.save();
    }
    return review;
  }

  return SiteEngineerReview.create({
    jobId,
    moduleStageKey: stageKey,
    reviewType: "module",
    title,
    drawingRef: title,
    status: "Pending Review",
  });
};

const markModuleCompleteForReview = async (jobId, stageKey, completedBy) => {
  if (!requiresSiteEngineerCheck(stageKey)) return null;

  const job = await Job.findById(jobId);
  if (!job) return null;

  if (!job.workflowEvents) job.workflowEvents = {};
  if (!job.workflowEvents[stageKey]) job.workflowEvents[stageKey] = {};

  const stage = job.workflowEvents[stageKey];

  if (stage.siteEngineerStatus === "Approved" && stage.isCompleted) {
    return job;
  }

  if (stage.siteEngineerStatus === "Pending" && stage.moduleWorkComplete) {
    return job;
  }

  stage.moduleWorkComplete = true;
  stage.completedAt = new Date();
  stage.completedBy = completedBy || stage.completedBy || "Module";
  stage.siteEngineerStatus = "Pending";
  stage.stageStatus = "Awaiting Site Engineer";
  stage.isCompleted = false;

  await ensureModuleReview(jobId, stageKey);

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

  await notifySiteEngineer({
    job,
    stageKey,
    actor: completedBy || "Module",
  });

  return job;
};

const approveModuleReview = async (review, actor) => {
  if (!review?.moduleStageKey) return null;

  const job = await Job.findById(review.jobId);
  if (!job) return null;

  const stageKey = review.moduleStageKey;
  if (!job.workflowEvents) job.workflowEvents = {};
  if (!job.workflowEvents[stageKey]) job.workflowEvents[stageKey] = {};

  const stage = job.workflowEvents[stageKey];
  stage.isCompleted = true;
  stage.stageStatus = "Complete";
  stage.siteEngineerStatus = "Approved";
  stage.siteEngineerCheckedBy = actor;
  stage.siteEngineerCheckedAt = new Date();

  review.status = "Approved";
  review.reviewedBy = actor;
  review.reviewedAt = new Date();
  await review.save();

  job.markModified("workflowEvents");
  await job.save();

  await syncJobSiteEngineerStage(review.jobId, actor);

  if (job.customerId) {
    const stageLabel = STAGE_LABELS[stageKey] || stageKey;
    await notifyCustomer({
      customerId: job.customerId,
      job,
      title: `${stageLabel} approved`,
      body: `Site engineer has approved ${stageLabel} for project ${job.jobId}.`,
      metadata: { stageKey, action: "se_approved" },
    });

    if (stageKey === "jobCompletion") {
      await notifyCustomer({
        customerId: job.customerId,
        job,
        title: "Project completed",
        body: `Your project ${job.jobId} has been completed and approved by the site engineer.`,
        type: "workflow",
        metadata: { stageKey, action: "job_completed" },
      });
    }
  }

  return job;
};

const rejectModuleReview = async (review, actor, comments) => {
  if (!review?.moduleStageKey) return null;

  const job = await Job.findById(review.jobId);
  if (!job) return null;

  const stageKey = review.moduleStageKey;
  if (!job.workflowEvents) job.workflowEvents = {};
  if (!job.workflowEvents[stageKey]) job.workflowEvents[stageKey] = {};

  const stage = job.workflowEvents[stageKey];
  stage.siteEngineerStatus = "Rejected";
  stage.stageStatus = "In Progress";
  stage.isCompleted = false;
  stage.moduleWorkComplete = false;
  stage.siteEngineerCheckedBy = actor;
  stage.siteEngineerCheckedAt = new Date();
  stage.siteEngineerComments = comments || "";

  review.status = "Rejected";
  review.reviewedBy = actor;
  review.reviewedAt = new Date();
  review.comments = comments || "";
  review.revisionNumber = Number(review.revisionNumber || 0) + 1;
  await review.save();

  job.markModified("workflowEvents");
  await job.save();

  await syncJobSiteEngineerStage(review.jobId, actor);
  return job;
};

module.exports = {
  MODULES_REQUIRING_SITE_ENGINEER,
  requiresSiteEngineerCheck,
  ensureModuleReview,
  markModuleCompleteForReview,
  approveModuleReview,
  rejectModuleReview,
};
