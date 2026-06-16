const mongoose = require("mongoose");

const Planning = mongoose.models.Planning;
const Job = mongoose.models.Job;

if (!Planning) throw new Error("Planning model not loaded");
if (!Job) throw new Error("Job model not loaded");

const isPlanningStatusCompleted = (status) => {
  if (!status) return false;
  const normalized = String(status).trim().toLowerCase();
  return ["completed", "done"].includes(normalized);
};

// helper: when planning starts, move related job to Client Approval (Planning analog)
const syncJobPlanningStage = async (jobObjectId, isCompleted = false) => {
  if (!jobObjectId) return;

  const job = await Job.findById(jobObjectId);
  if (!job) return;

  if (!job.workflowEvents) job.workflowEvents = {};
  if (!job.workflowEvents.planning) job.workflowEvents.planning = {};

  if (isCompleted && !job.workflowEvents.planning.isCompleted) {
    job.workflowEvents.planning.isCompleted = true;
    job.workflowEvents.planning.approvalDate = new Date();
    job.workflowEvents.planning.completedAt = new Date();
    job.workflowEvents.planning.completedBy = "Planning Module";
  }

  job.markModified("workflowEvents");
  await job.save();
};

// GET /api/planning/list/:jobId
exports.listByJob = async (req, res) => {
  try {
    const { jobId } = req.params;

    if (!jobId) {
      return res.status(400).json({
        success: false,
        result: [],
        message: "jobId is required",
      });
    }

    const result = await Planning.find({ jobId }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      result,
      message: "Planning tasks fetched",
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      result: [],
      message: err.message,
    });
  }
};

// GET /api/planning/read/:id
exports.read = async (req, res) => {
  try {
    const result = await Planning.findById(req.params.id);

    if (!result) {
      return res.status(404).json({
        success: false,
        result: null,
        message: "Planning task not found",
      });
    }

    return res.status(200).json({
      success: true,
      result,
      message: "Planning task fetched",
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      result: null,
      message: err.message,
    });
  }
};

// POST /api/planning/create
exports.create = async (req, res) => {
  try {
    const payload = req.body;

    if (!payload.jobId) {
      return res.status(400).json({
        success: false,
        result: null,
        message: "jobId is required",
      });
    }

    if (!payload.task || !payload.start || !payload.end) {
      return res.status(400).json({
        success: false,
        result: null,
        message: "task, start and end are required",
      });
    }

    const job = await Job.findById(payload.jobId);
    if (!job) {
      return res.status(404).json({
        success: false,
        result: null,
        message: "Job not found",
      });
    }

    const created = await Planning.create({
      jobId: payload.jobId,
      task: payload.task,
      start: payload.start,
      end: payload.end,
      workers: Number(payload.workers || 1),
      hours: Number(payload.hours || 1),
      status: payload.status || "Pending",
    });

    // planning started => move job to Planning Lock
    await syncJobPlanningStage(payload.jobId, isPlanningStatusCompleted(payload.status));

    return res.status(201).json({
      success: true,
      result: created,
      message: "Planning task created",
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      result: null,
      message: err.message,
    });
  }
};

// PATCH /api/planning/update/:id
exports.update = async (req, res) => {
  try {
    const existing = await Planning.findById(req.params.id);

    if (!existing) {
      return res.status(404).json({
        success: false,
        result: null,
        message: "Planning task not found",
      });
    }

    const payload = { ...req.body };

    if (payload.workers !== undefined) {
      payload.workers = Number(payload.workers);
    }

    if (payload.hours !== undefined) {
      payload.hours = Number(payload.hours);
    }

    const updated = await Planning.findByIdAndUpdate(req.params.id, payload, {
      new: true,
      runValidators: true,
    });

    const completeStatus = isPlanningStatusCompleted(payload.status || updated.status);
    await syncJobPlanningStage(updated.jobId, completeStatus);

    return res.status(200).json({
      success: true,
      result: updated,
      message: "Planning task updated",
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      result: null,
      message: err.message,
    });
  }
};

// DELETE /api/planning/delete/:id
exports.delete = async (req, res) => {
  try {
    const deleted = await Planning.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        result: null,
        message: "Planning task not found",
      });
    }

    return res.status(200).json({
      success: true,
      result: deleted,
      message: "Planning task deleted",
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      result: null,
      message: err.message,
    });
  }
};