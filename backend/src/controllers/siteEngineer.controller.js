const mongoose = require("mongoose");
const SiteEngineerReview = require("../models/appModels/SiteEngineerReview");
const SiteEngineerReviewHistory = require("../models/appModels/SiteEngineerReviewHistory");
const Drafting = require("../models/appModels/Drafting");
const Job = require("../models/appModels/Job");
const { notifyWorkflow } = require("../services/notificationService");
const {
  ensureReviewForDrafting,
  syncJobSiteEngineerStage,
} = require("../utils/siteEngineerReview");
const {
  approveModuleReview,
  rejectModuleReview,
  markModuleCompleteForReview,
  requiresSiteEngineerCheck,
} = require("../utils/moduleSiteEngineerGate");
const { STAGE_LABELS } = require("../utils/workflowDefaults");

const getActor = (req) =>
  req.user?.name || req.user?.email || req.admin?.name || "System";

const isPrivileged = (req) => {
  const role = String(req.user?.role || "").toLowerCase();
  return ["admin", "siteengineer"].includes(role);
};

const logHistory = async (payload) => {
  const entry = {
    ...payload,
    timestamp: new Date(),
  };
  if (!entry.draftingId) {
    delete entry.draftingId;
  }
  await SiteEngineerReviewHistory.create(entry);
};

exports.listByJob = async (req, res) => {
  try {
    const items = await SiteEngineerReview.find({ jobId: req.params.jobId })
      .populate("draftingId", "title drawingRef fileUrl status")
      .sort({ updatedAt: -1 });
    return res.json({ success: true, result: items });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.history = async (req, res) => {
  try {
    const logs = await SiteEngineerReviewHistory.find({ jobId: req.params.jobId }).sort({
      timestamp: -1,
    });
    return res.json({ success: true, result: logs });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const OPEN_STATUSES = [
  "Pending",
  "Pending Review",
  "On Review",
  "Rejected",
  "On Hold",
];

const normalizeReviewStatus = (status) => {
  if (status === "Pending") return "Pending Review";
  if (status === "Revision Required") return "Rejected";
  return status || "Pending Review";
};

exports.summary = async (req, res) => {
  try {
    const reviews = await SiteEngineerReview.find({}).select("status");
    const counts = {
      "Pending Review": 0,
      "On Review": 0,
      Approved: 0,
      Rejected: 0,
      "On Hold": 0,
    };

    for (const review of reviews) {
      const key = normalizeReviewStatus(review.status);
      if (counts[key] !== undefined) {
        counts[key] += 1;
      }
    }

    const openCount = reviews.filter((r) =>
      OPEN_STATUSES.includes(r.status)
    ).length;

    return res.json({
      success: true,
      result: {
        counts,
        total: reviews.length,
        openCount,
        pendingReview: counts["Pending Review"],
        onReview: counts["On Review"],
        rejected: counts.Rejected,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

const ALLOWED_STATUSES = [
  "Pending Review",
  "On Review",
  "Approved",
  "Rejected",
  "On Hold",
];

exports.listAll = async (req, res) => {
  try {
    const { status, jobId } = req.query;
    const filter = {};

    if (jobId) filter.jobId = jobId;
    if (status && status !== "all") {
      if (status === "Pending Review") {
        filter.status = { $in: ["Pending", "Pending Review"] };
      } else {
        filter.status = status;
      }
    }

    const items = await SiteEngineerReview.find(filter)
      .populate("draftingId", "title drawingRef fileUrl")
      .populate("jobId", "jobId customer site")
      .sort({ updatedAt: -1 });

    return res.json({ success: true, result: items });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.pending = async (req, res) => {
  try {
    const items = await SiteEngineerReview.find({
      status: { $in: OPEN_STATUSES },
    })
      .populate("draftingId", "title drawingRef fileUrl")
      .populate("jobId", "jobId customer site")
      .sort({ updatedAt: -1 });
    return res.json({ success: true, result: items });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateStatus = async (req, res) => {
  try {
    if (!isPrivileged(req)) {
      return res.status(403).json({ success: false, message: "Admin approval required" });
    }

    const { status, comments } = req.body || {};
    if (!status || !ALLOWED_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }

    const review = await SiteEngineerReview.findById(req.params.id);
    if (!review) {
      return res.status(404).json({ success: false, message: "Review not found" });
    }

    const actor = getActor(req);
    const fromStatus = review.status;
    review.status = status;
    if (comments) review.comments = comments;
    if (["On Review", "Approved", "Rejected", "On Hold"].includes(status)) {
      review.reviewedBy = actor;
      review.reviewedAt = new Date();
    }
    await review.save();

    await logHistory({
      reviewId: review._id,
      jobId: review.jobId,
      draftingId: review.draftingId,
      moduleStageKey: review.moduleStageKey,
      reviewType: review.reviewType,
      action: "status_change",
      fromStatus,
      toStatus: status,
      comments: comments || "",
      actor,
    });

    await syncJobSiteEngineerStage(review.jobId, actor);

    return res.json({
      success: true,
      result: review,
      message: `Status updated to ${status}`,
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

exports.ensureReview = async (req, res) => {
  try {
    const { draftingId } = req.params;
    const drafting = await Drafting.findById(draftingId);
    if (!drafting) {
      return res.status(404).json({ success: false, message: "Drawing not found" });
    }

    const review = await ensureReviewForDrafting(drafting);

    return res.json({ success: true, result: review });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

exports.approve = async (req, res) => {
  try {
    if (!isPrivileged(req)) {
      return res.status(403).json({ success: false, message: "Admin approval required" });
    }

    const review = await SiteEngineerReview.findById(req.params.id);
    if (!review) {
      return res.status(404).json({ success: false, message: "Review not found" });
    }

    const actor = getActor(req);
    const fromStatus = review.status;

    if (review.reviewType === "module" && review.moduleStageKey) {
      await approveModuleReview(review, actor);

      await logHistory({
        reviewId: review._id,
        jobId: review.jobId,
        moduleStageKey: review.moduleStageKey,
        reviewType: "module",
        action: "approve",
        fromStatus,
        toStatus: "Approved",
        comments: req.body?.comments || "",
        actor,
      });

      return res.json({
        success: true,
        result: review,
        message: `${review.title || review.moduleStageKey} approved by site engineer`,
      });
    }

    review.status = "Approved";
    review.reviewedBy = actor;
    review.reviewedAt = new Date();
    review.comments = req.body?.comments || review.comments || "";
    await review.save();

    await logHistory({
      reviewId: review._id,
      jobId: review.jobId,
      draftingId: review.draftingId,
      action: "approve",
      fromStatus,
      toStatus: review.status,
      comments: review.comments,
      actor,
    });

    const { job, stage } = (await syncJobSiteEngineerStage(review.jobId, actor)) || {};

    if (stage?.isCompleted && job) {
      await notifyWorkflow({
        job,
        stageKey: "siteEngineerApproval",
        message: `Site engineer approval completed for job ${job.jobId}`,
        actor,
      });
    }

    return res.json({
      success: true,
      result: review,
      message: "Drawing approved by site engineer",
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

exports.reject = async (req, res) => {
  try {
    if (!isPrivileged(req)) {
      return res.status(403).json({ success: false, message: "Admin approval required" });
    }

    const { comments } = req.body || {};
    if (!comments) {
      return res.status(400).json({ success: false, message: "comments are required" });
    }

    const review = await SiteEngineerReview.findById(req.params.id);
    if (!review) {
      return res.status(404).json({ success: false, message: "Review not found" });
    }

    const actor = getActor(req);
    const fromStatus = review.status;

    if (review.reviewType === "module" && review.moduleStageKey) {
      await rejectModuleReview(review, actor, comments);

      await logHistory({
        reviewId: review._id,
        jobId: review.jobId,
        moduleStageKey: review.moduleStageKey,
        reviewType: "module",
        action: "reject",
        fromStatus,
        toStatus: "Rejected",
        comments,
        actor,
      });

      return res.json({
        success: true,
        result: review,
        message: "Module sent back for revision",
      });
    }

    review.status = "Rejected";
    review.reviewedBy = actor;
    review.reviewedAt = new Date();
    review.comments = comments;
    review.revisionNumber = Number(review.revisionNumber || 0) + 1;
    await review.save();

    await logHistory({
      reviewId: review._id,
      jobId: review.jobId,
      draftingId: review.draftingId,
      action: "reject",
      fromStatus,
      toStatus: review.status,
      comments,
      actor,
    });

    await syncJobSiteEngineerStage(review.jobId, actor);

    const job = await Job.findById(review.jobId);
    if (job?.workflowEvents?.siteEngineerApproval) {
      job.workflowEvents.siteEngineerApproval.lastRejectedAt = new Date();
      job.workflowEvents.siteEngineerApproval.isCompleted = false;
      job.workflowEvents.siteEngineerApproval.stageStatus = "In Progress";
      job.markModified("workflowEvents");
      await job.save();
    }

    return res.json({
      success: true,
      result: review,
      message: "Drawing rejected — revision required",
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

exports.sendForApproval = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { stageKey } = req.body || {};
    const actor = getActor(req);

    if (!stageKey || !requiresSiteEngineerCheck(stageKey)) {
      return res.status(400).json({
        success: false,
        message: "A valid workflow stage is required",
      });
    }

    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }

    const stage = job.workflowEvents?.[stageKey] || {};

    if (stage.siteEngineerStatus === "Approved" && stage.isCompleted) {
      return res.json({
        success: true,
        result: job,
        message: `${STAGE_LABELS[stageKey] || stageKey} is already approved by the site engineer`,
      });
    }

    if (stage.siteEngineerStatus === "Pending" && stage.moduleWorkComplete) {
      return res.json({
        success: true,
        result: job,
        message: `${STAGE_LABELS[stageKey] || stageKey} is already awaiting site engineer review`,
      });
    }

    const updated = await markModuleCompleteForReview(jobId, stageKey, actor);
    const refreshed = await Job.findById(jobId);

    return res.json({
      success: true,
      result: refreshed || updated || job,
      message: `${STAGE_LABELS[stageKey] || stageKey} sent to site engineer for approval`,
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};
