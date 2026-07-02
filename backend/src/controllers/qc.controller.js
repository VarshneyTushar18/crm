const mongoose = require("mongoose");

const Qc = require("../models/appModels/Qc");
const Job = require("../models/appModels/Job");
const { markModuleCompleteForReview } = require("../utils/moduleSiteEngineerGate");
const { notifyCustomer } = require("../services/notificationService");

if (!Qc) throw new Error("Qc model not loaded");
if (!Job) throw new Error("Job model not loaded");

const QC_STAGE_MAP = {
  "Fabrication QC": "fabricationQc",
  fabricationQc: "fabricationQc",
  "Powder Coating QC": "powderCoatingQc",
  powderCoatingQc: "powderCoatingQc",
};

const resolveStageKey = (item) => {
  if (item.workflowStageKey) return item.workflowStageKey;
  return QC_STAGE_MAP[item.inspectionType] || "finishing";
};

const maybeCompleteQcStage = async (jobId, stageKey) => {
  const items = await Qc.find({ jobId });
  const stageItems = items.filter((item) => resolveStageKey(item) === stageKey);
  if (!stageItems.length) return;

  const allPass = stageItems.every((item) => item.status === "Pass");
  if (!allPass) return;

  const job = await Job.findById(jobId);
  if (!job?.workflowEvents?.[stageKey]) return;
  if (job.workflowEvents[stageKey].isCompleted) return;

  await markModuleCompleteForReview(jobId, stageKey, "Quality Control Module");

  const refreshed = await Job.findById(jobId);
  if (refreshed?.customerId) {
    const labels = {
      fabricationQc: "Fabrication quality check",
      powderCoatingQc: "Powder coating quality check",
      finishing: "Quality check",
    };
    await notifyCustomer({
      customerId: refreshed.customerId,
      job: refreshed,
      title: `${labels[stageKey] || "QC"} passed`,
      body: `${labels[stageKey] || "Quality check"} passed for project ${refreshed.jobId}.`,
    });
  }
};

const syncJobQcStage = async (jobObjectId) => {
  if (!jobObjectId) return;
  await maybeCompleteQcStage(jobObjectId, "fabricationQc");
  await maybeCompleteQcStage(jobObjectId, "powderCoatingQc");
  await maybeCompleteQcStage(jobObjectId, "finishing");
};

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

    const workflowStageKey =
      payload.workflowStageKey ||
      QC_STAGE_MAP[payload.inspectionType] ||
      "";

    const created = await Qc.create({
      jobId: payload.jobId,
      itemName: payload.itemName,
      inspectionType: payload.inspectionType || "",
      workflowStageKey,
      checkedBy: payload.checkedBy || "",
      checkedDate: payload.checkedDate || "",
      status: payload.status || "Pending",
      remarks: payload.remarks || "",
    });

    if (created.status === "Pass") {
      await syncJobQcStage(payload.jobId);
    }

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

    if (updated.status === "Pass") {
      await syncJobQcStage(updated.jobId);
    }

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
