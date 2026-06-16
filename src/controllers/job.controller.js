const Job = require("../models/appModels/Job");
const Lead = require("../models/appModels/Lead");

const generateJobId = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `J-${y}${m}${day}-${rand}`;
};

// GET /api/job/list
exports.listJobs = async (req, res) => {
  try {
    const jobs = await Job.find({}).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      result: jobs,
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
    const job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({
        success: false,
        result: null,
        message: "Job not found",
      });
    }

    return res.status(200).json({
      success: true,
      result: job,
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
    const payload = {
      ...req.body,
      jobId: req.body.jobId || generateJobId(),
      stage: req.body.stage || "Backlog",
      status: req.body.status || "Backlog",
    };

    const created = await Job.create(payload);

    return res.status(201).json({
      success: true,
      result: created,
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

    // Update the job with new data
    Object.assign(job, req.body);

    // Save to trigger pre-save hooks for systemState calculation
    const updated = await job.save();

    return res.status(200).json({
      success: true,
      result: updated,
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
    const allowedStages = [
      "siteMeasurement",
      "planning",
      "drafting",
      "clientApproval",
      "materialPurchasing",
      "fabrication",
      "finishing",
      "installation",
      "jobCompletion",
    ];

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

    // Merge data
    const updateData = req.body;
    job.workflowEvents[stageName] = { ...job.workflowEvents[stageName], ...updateData };

    // Auto timestamp if marked completed
    if (updateData.isCompleted && !job.workflowEvents[stageName].completedAt) {
      job.workflowEvents[stageName].completedAt = new Date();
      job.workflowEvents[stageName].completedBy = req.admin?.name || req.user?.name || updateData.completedBy || "System Admin";
    }

    job.markModified("workflowEvents");
    await job.save();

    return res.status(200).json({
      success: true,
      result: job,
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

    const stages = [
      "siteMeasurement",
      "planning",
      "drafting",
      "clientApproval",
      "materialPurchasing",
      "fabrication",
      "finishing",
      "installation",
      "jobCompletion",
    ];

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