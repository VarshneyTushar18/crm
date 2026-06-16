const mongoose = require("mongoose");

const KanbanTask = mongoose.models.KanbanTask;
const Job = mongoose.models.Job;

if (!KanbanTask) throw new Error("KanbanTask model not loaded");
if (!Job) throw new Error("Job model not loaded");

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

    const result = await KanbanTask.find({ jobId }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      result,
      message: "Kanban tasks fetched",
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      result: [],
      message: err.message,
    });
  }
};

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

    if (!payload.title) {
      return res.status(400).json({
        success: false,
        result: null,
        message: "title is required",
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

    const created = await KanbanTask.create({
      jobId: payload.jobId,
      title: payload.title,
      description: payload.description || "",
      plannedStart: payload.plannedStart || "",
      plannedEnd: payload.plannedEnd || "",
      priority: payload.priority || "Medium",
      assignedTeam: payload.assignedTeam || "",
      status: payload.status || "To Schedule",
    });

    return res.status(201).json({
      success: true,
      result: created,
      message: "Kanban task created",
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      result: null,
      message: err.message,
    });
  }
};

exports.update = async (req, res) => {
  try {
    const updated = await KanbanTask.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!updated) {
      return res.status(404).json({
        success: false,
        result: null,
        message: "Kanban task not found",
      });
    }

    return res.status(200).json({
      success: true,
      result: updated,
      message: "Kanban task updated",
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      result: null,
      message: err.message,
    });
  }
};

exports.delete = async (req, res) => {
  try {
    const deleted = await KanbanTask.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        result: null,
        message: "Kanban task not found",
      });
    }

    return res.status(200).json({
      success: true,
      result: deleted,
      message: "Kanban task deleted",
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      result: null,
      message: err.message,
    });
  }
};