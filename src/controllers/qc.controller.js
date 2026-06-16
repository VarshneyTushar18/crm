const mongoose = require("mongoose");

const Qc = require("../models/appModels/Qc");
const Job = require("../models/appModels/Job");

if (!Qc) throw new Error("Qc model not loaded");
if (!Job) throw new Error("Job model not loaded");

const syncJobQcStage = async (jobObjectId, isCompleted = false) => {
  if (!jobObjectId) return;

  const job = await Job.findById(jobObjectId);
  if (!job) return;

  if (!job.workflowEvents) job.workflowEvents = {};
  if (!job.workflowEvents.finishing) job.workflowEvents.finishing = {};

  if (isCompleted && !job.workflowEvents.finishing.isCompleted) {
    job.workflowEvents.finishing.isCompleted = true;
    job.workflowEvents.finishing.completedAt = new Date();
    job.workflowEvents.finishing.completedBy = "Quality Control Module";
  }

  job.markModified("workflowEvents");
  await job.save();
};

// GET /api/qc/list/:jobId
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

    const result = await Qc.find({ jobId }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      result,
      message: "Qc items fetched",
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      result: [],
      message: err.message,
    });
  }
};

// GET /api/qc/read/:id
exports.read = async (req, res) => {
  try {
    const result = await Qc.findById(req.params.id);

    if (!result) {
      return res.status(404).json({
        success: false,
        result: null,
        message: "Qc item not found",
      });
    }

    return res.status(200).json({
      success: true,
      result,
      message: "Qc item fetched",
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      result: null,
      message: err.message,
    });
  }
};

// POST /api/qc/create
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

    if (!payload.itemName) {
      return res.status(400).json({
        success: false,
        result: null,
        message: "itemName is required",
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

    const created = await Qc.create({
      jobId: payload.jobId,
      itemName: payload.itemName,
      inspectionType: payload.inspectionType || "",
      checkedBy: payload.checkedBy || "",
      checkedDate: payload.checkedDate || "",
      status: payload.status || "Pending",
      remarks: payload.remarks || "",
    });

    await syncJobQcStage(payload.jobId, payload.status === "Approved" || payload.status === "Completed");

    return res.status(201).json({
      success: true,
      result: created,
      message: "Qc item created",
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      result: null,
      message: err.message,
    });
  }
};

// PATCH /api/qc/update/:id
exports.update = async (req, res) => {
  try {
    const existing = await Qc.findById(req.params.id);

    if (!existing) {
      return res.status(404).json({
        success: false,
        result: null,
        message: "Qc item not found",
      });
    }

    const updated = await Qc.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    await syncJobQcStage(updated.jobId, req.body.status === "Approved" || updated.status === "Approved" || req.body.status === "Completed" || updated.status === "Completed");

    return res.status(200).json({
      success: true,
      result: updated,
      message: "Qc item updated",
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      result: null,
      message: err.message,
    });
  }
};

// DELETE /api/qc/delete/:id
exports.delete = async (req, res) => {
  try {
    const deleted = await Qc.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        result: null,
        message: "Qc item not found",
      });
    }

    return res.status(200).json({
      success: true,
      result: deleted,
      message: "Qc item deleted",
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      result: null,
      message: err.message,
    });
  }
};