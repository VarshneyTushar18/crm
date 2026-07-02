const Job = require("../models/appModels/Job");
const Lead = require("../models/appModels/Lead");
const Customer = require("../models/appModels/Customer");
const SiteEngineerReview = require("../models/appModels/SiteEngineerReview");
const { linkJobToQuote } = require("../utils/linkJobQuote");
const { syncJobSiteEngineerStage } = require("../utils/siteEngineerReview");
const {
  markModuleCompleteForReview,
  requiresSiteEngineerCheck,
} = require("../utils/moduleSiteEngineerGate");
const {
  calcJobCompletionPercent,
  syncStageFromSubtasks,
  normalizeStageStatus,
  getAllWorkflowStageKeys,
  buildDefaultWorkflowEvents,
  getWorkflowStageKeys,
  ensureV3WorkflowEvents,
  getTimelineWorkflowVersion,
  migrateJobWorkflowToV3,
} = require("../utils/workflowDefaults");
const { validateStageCompletion } = require("../utils/workflowGates");
const { processMilestoneBilling } = require("../utils/milestoneBilling");
const { notifyCustomer } = require("../services/notificationService");

const MANUAL_PROGRESS_VALUES = [20, 40, 60, 80, 100];

const generateJobId = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `J-${y}${m}${day}-${rand}`;
};

const attachJobMetrics = (jobDoc) => {
  const job = jobDoc?.toObject ? jobDoc.toObject() : { ...jobDoc };
  const wfVersion = getTimelineWorkflowVersion(job);
  job.workflowEvents = ensureV3WorkflowEvents(job.workflowEvents || {});
  job.workflowVersion = wfVersion;
  const autoPercent = calcJobCompletionPercent(job.workflowEvents, wfVersion);
  job.autoCompletionPercent = autoPercent;
  job.completionPercent = autoPercent;
  return job;
};

// GET /api/job/list
exports.listJobs = async (req, res) => {
  try {
    const jobs = await Job.find({}).sort({ createdAt: -1 });
    const result = jobs.map((j) => attachJobMetrics(j));

    return res.status(200).json({
      success: true,
      result,
      message: "Jobs fetched",
    });
  } catch (e) {
    return res.status(500).json({
      success: false,
      result: null,
      message: e.message,
    });
  }
};

// GET /api/job/read/:id
exports.readJob = async (req, res) => {
  try {
    let job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({
        success: false,
        result: null,
        message: "Job not found",
      });
    }

    const hasSiteEngineerReviews = await SiteEngineerReview.exists({ jobId: job._id });
    if (
      hasSiteEngineerReviews &&
      !job.workflowEvents?.siteEngineerApproval?.approvedBy
    ) {
      await syncJobSiteEngineerStage(job._id);
      job = await Job.findById(req.params.id);
    }

    if (Number(job.workflowVersion || 1) < 3) {
      await migrateJobWorkflowToV3(job);
      job = await Job.findById(req.params.id);
    }

    return res.status(200).json({
      success: true,
      result: attachJobMetrics(job),
      message: "Job fetched",
    });
  } catch (e) {
    return res.status(500).json({
      success: false,
      result: null,
      message: e.message,
    });
  }
};

// POST /api/job/create
exports.createJob = async (req, res) => {
  try {
    const { customerId } = req.body || {};

    if (!customerId) {
      return res.status(400).json({
        success: false,
        result: null,
        message: "customerId is required",
      });
    }

    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({
        success: false,
        result: null,
        message: "Customer not found",
      });
    }

    const wfVersion =
      req.body.workflowVersion !== undefined ? Number(req.body.workflowVersion) : 3;

    const payload = {
      ...req.body,
      jobId: req.body.jobId || generateJobId(),
      stage: req.body.stage || "Backlog",
      status: req.body.status || "Backlog",
      customerId: customer._id,
      customer: customer.name || customer.companyName || req.body.customer || "",
      workflowVersion: wfVersion,
      workflowEvents: req.body.workflowEvents || buildDefaultWorkflowEvents(wfVersion),
    };

    const created = await Job.create(payload);

    await linkJobToQuote({
      job: created,
      quoteId: payload.quoteId,
      leadId: payload.leadId || created.leadId,
    });

    const refreshed = await Job.findById(created._id);

    return res.status(201).json({
      success: true,
      result: refreshed || created,
      message: "Job created",
    });
  } catch (e) {
    return res.status(400).json({
      success: false,
      result: null,
      message: e.message,
    });
  }
};

// DELETE /api/job/delete/:id
exports.deleteJob = async (req, res) => {
  try {
    const deleted = await Job.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        result: null,
        message: "Job not found",
      });
    }

    return res.status(200).json({
      success: true,
      result: deleted,
      message: "Job deleted",
    });
  } catch (e) {
    return res.status(500).json({
      success: false,
      result: null,
      message: e.message,
    });
  }
};

// PATCH /api/job/update/:id
exports.updateJob = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({
        success: false,
        result: null,
        message: "Job not found",
      });
    }

    const payload = { ...req.body };
    const prevManualProgress = job.manualProgressPercent;

    if (payload.manualProgressPercent !== undefined) {
      const raw = payload.manualProgressPercent;
      if (raw === null || raw === "" || raw === "auto") {
        payload.manualProgressPercent = null;
      } else {
        const val = Number(raw);
        if (!MANUAL_PROGRESS_VALUES.includes(val)) {
          return res.status(400).json({
            success: false,
            message: "Manual progress must be 20, 40, 60, 80, or 100 (or clear to auto)",
          });
        }
        payload.manualProgressPercent = val;
      }
    }

    if (payload.customerId) {
      const customer = await Customer.findById(payload.customerId);
      if (!customer) {
        return res.status(404).json({
          success: false,
          result: null,
          message: "Customer not found",
        });
      }
      payload.customer = customer.name || customer.companyName || payload.customer || "";
    }

    if (payload.workflowEvents) {
      const stageKeys = getWorkflowStageKeys(job);
      for (const key of stageKeys) {
        const incoming = payload.workflowEvents[key];
        if (!incoming) continue;
        const willComplete =
          incoming.isCompleted === true || incoming.stageStatus === "Complete";
        if (willComplete) {
          const gate = validateStageCompletion(job, key);
          if (!gate.ok) {
            return res.status(400).json({ success: false, message: gate.message });
          }
        }
      }
    }

    // Update the job with new data
    Object.assign(job, payload);

    // Save to trigger pre-save hooks for systemState calculation
    const updated = await job.save();

    await processMilestoneBilling(
      updated,
      req.admin?.name || req.user?.name || "System"
    );

    const refreshed = await Job.findById(updated._id);

    if (
      payload.manualProgressPercent !== undefined &&
      refreshed?.customerId &&
      refreshed.manualProgressPercent !== prevManualProgress
    ) {
      const pct = refreshed.manualProgressPercent;
      await notifyCustomer({
        customerId: refreshed.customerId,
        job: refreshed,
        title: "Project progress updated",
        body:
          pct != null
            ? `Your project ${refreshed.jobId} is now at ${pct}% completion.`
            : `Progress for project ${refreshed.jobId} is now calculated from workflow stages.`,
        metadata: { manualProgressPercent: pct },
      });
    }

    return res.status(200).json({
      success: true,
      result: attachJobMetrics(refreshed || updated),
      message: "Job updated",
    });
  } catch (e) {
    return res.status(400).json({
      success: false,
      result: null,
      message: e.message,
    });
  }
};

// PATCH /api/job/stage/:id/:stageName
exports.updateJobStage = async (req, res) => {
  try {
    const { id, stageName } = req.params;
    const allowedStages = getAllWorkflowStageKeys();

    if (!allowedStages.includes(stageName)) {
      return res.status(400).json({ success: false, message: "Invalid stage name" });
    }

    const job = await Job.findById(id);
    if (!job) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }

    // Initialize if empty to be safe
    if (!job.workflowEvents) job.workflowEvents = {};
    if (!job.workflowEvents[stageName]) job.workflowEvents[stageName] = {};

    const updateData = { ...req.body };

    const willComplete =
      updateData.isCompleted === true ||
      updateData.stageStatus === "Complete" ||
      (Array.isArray(updateData.subtasks) &&
        updateData.subtasks.length > 0 &&
        updateData.subtasks.every((t) => t.isCompleted));

    if (willComplete) {
      const gate = validateStageCompletion(job, stageName);
      if (!gate.ok) {
        return res.status(400).json({ success: false, message: gate.message });
      }

      if (requiresSiteEngineerCheck(stageName)) {
        const actor =
          req.admin?.name || req.user?.name || updateData.completedBy || "System Admin";
        await markModuleCompleteForReview(id, stageName, `${actor} (Manual)`);
        const refreshed = await Job.findById(id);
        return res.status(200).json({
          success: true,
          result: attachJobMetrics(refreshed || job),
          message: `${stageName} submitted for site engineer review`,
        });
      }
    }

    if (updateData.isCompleted === true) {
      updateData.stageStatus = "Complete";
      if (!updateData.completedAt) updateData.completedAt = new Date();
      updateData.completedBy =
        req.admin?.name || req.user?.name || updateData.completedBy || "System Admin";
    } else if (updateData.isCompleted === false) {
      updateData.stageStatus = updateData.stageStatus || "In Progress";
    }

    job.workflowEvents[stageName] = {
      ...job.workflowEvents[stageName],
      ...updateData,
    };

    if (Array.isArray(updateData.subtasks)) {
      job.workflowEvents[stageName] = syncStageFromSubtasks(
        job.workflowEvents[stageName]
      );
    }

    job.workflowEvents[stageName] = normalizeStageStatus(
      job.workflowEvents[stageName]
    );

    if (
      job.workflowEvents[stageName].stageStatus === "Complete" &&
      !job.workflowEvents[stageName].isCompleted
    ) {
      return res.status(400).json({
        success: false,
        message: "Stage can only be Complete when work is marked finished",
      });
    }

    job.markModified("workflowEvents");
    await job.save();

    await processMilestoneBilling(
      job,
      req.admin?.name || req.user?.name || "System"
    );

    const refreshed = await Job.findById(job._id);

    return res.status(200).json({
      success: true,
      result: attachJobMetrics(refreshed || job),
      message: `Stage ${stageName} updated successfully`,
    });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
};

const moment = require("moment");

// GET /api/job/summary
exports.summaryJobs = async (req, res) => {
  try {
    const { type, startDate, endDate } = req.query;
    let start = moment().startOf('month');
    let end = moment().endOf('month');

    if (type === 'today') {
      start = moment().startOf('day');
      end = moment().endOf('day');
    } else if (type === 'thisWeek') {
      start = moment().startOf('week');
      end = moment().endOf('week');
    } else if (type === 'thisMonth') {
      start = moment().startOf('month');
      end = moment().endOf('month');
    } else if (type === 'custom' && startDate && endDate) {
      start = moment(startDate).startOf('day');
      end = moment(endDate).endOf('day');
    }

    const dateMatch = {
      removed: false,
      createdAt: {
        $gte: start.toDate(),
        $lte: end.toDate(),
      },
    };

    const activeJobsCount = await Job.countDocuments({
      ...dateMatch,
      systemState: "Active",
    });

    const stages = getAllWorkflowStageKeys();

    // Refined stage count: first non-completed stage
    const allJobs = await Job.find(dateMatch);
    const refinedStageCounts = {};
    stages.forEach(s => refinedStageCounts[s] = 0);
    refinedStageCounts["Completed"] = 0;

    allJobs.forEach(job => {
      let currentStage = "Completed";
      for (const stage of stages) {
        if (!job.workflowEvents?.[stage]?.isCompleted) {
          currentStage = stage;
          break;
        }
      }
      refinedStageCounts[currentStage]++;
    });

    return res.status(200).json({
      success: true,
      result: {
        activeJobsCount,
        stageCounts: refinedStageCounts,
      },
      message: "Job summary fetched",
    });
  } catch (e) {
    return res.status(500).json({
      success: false,
      result: null,
      message: e.message,
    });
  }
};