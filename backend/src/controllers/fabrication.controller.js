const Fabrication = require("../models/appModels/Fabrication");
const FabricationProgressLog = require("../models/appModels/FabricationProgressLog");
const Job = require("../models/appModels/Job");
const { markModuleCompleteForReview } = require("../utils/moduleSiteEngineerGate");

const getActor = (req) =>
  req.user?.name || req.user?.email || req.admin?.name || "System";

const canUpdateProgress = (req) =>
  ["admin", "worker"].includes(String(req.user?.role || "").toLowerCase());

const canOverrideStatus = (req) =>
  ["admin"].includes(String(req.user?.role || "").toLowerCase());

const calcOverallProgress = (items = []) => {
  if (!items.length) return 0;
  const total = items.reduce((sum, item) => {
    const pct = Number(item.progressPercentage || 0);
    if (pct > 0) return sum + pct;
    if (item.status === "Completed") return sum + 100;
    return sum;
  }, 0);
  return Math.round(total / items.length);
};

const deriveStatusFromProgress = (progress) => {
  const pct = Number(progress || 0);
  if (pct >= 100) return "Completed";
  if (pct > 0) return "In Progress";
  return "Pending";
};

const syncFabricationStageProgress = async (jobId, overallProgress) => {
  if (!jobId) return;
  const job = await Job.findById(jobId);
  if (!job) return;

  if (!job.workflowEvents) job.workflowEvents = {};
  if (!job.workflowEvents.fabrication) job.workflowEvents.fabrication = {};

  const fab = job.workflowEvents.fabrication;
  if (!fab.isCompleted) {
    fab.progressPercent = overallProgress;
    if (overallProgress > 0 && overallProgress < 100) {
      fab.stageStatus = "In Progress";
    }
  }

  job.markModified("workflowEvents");
  await job.save();
};

const syncJobFabricationTimeline = async (jobId, overallProgress, updatedBy) => {
  await syncFabricationStageProgress(jobId, overallProgress);
  if (!jobId || overallProgress < 100) return null;

  const allItems = await Fabrication.find({ jobId });
  const hasPhotos = allItems.some(
    (item) => Array.isArray(item.photoUrls) && item.photoUrls.length > 0
  );
  if (!hasPhotos) {
    const err = new Error(
      "Upload at least one fabrication photo before completing the module"
    );
    err.statusCode = 400;
    throw err;
  }

  const job = await Job.findById(jobId);
  if (!job) return null;

  if (!job.workflowEvents) job.workflowEvents = {};
  if (!job.workflowEvents.fabrication) job.workflowEvents.fabrication = {};

  const fabricationEvent = job.workflowEvents.fabrication;

  if (!fabricationEvent.isCompleted) {
    await markModuleCompleteForReview(
      jobId,
      "fabrication",
      updatedBy || "Fabrication Module (Auto)"
    );
  }

  return job;
};

const buildListPayload = (items) => {
  const overallProgress = calcOverallProgress(items);
  return {
    items,
    overallProgress,
    totalDrawings: items.length,
    completedDrawings: items.filter((i) => Number(i.progressPercentage) >= 100).length,
  };
};

exports.create = async (req, res) => {
  try {
    const {
      jobId,
      itemName,
      drawingRef,
      workstation,
      assignedTeam,
      quantity,
      targetDate,
      status,
      remarks,
      checklist,
      hoursLog,
      progressPercentage,
    } = req.body;

    if (!jobId || !itemName) {
      return res.status(400).json({
        success: false,
        message: "jobId and itemName are required",
      });
    }

    const pct = Math.min(100, Math.max(0, Number(progressPercentage || 0)));

    const doc = await Fabrication.create({
      jobId,
      itemName,
      drawingRef: drawingRef || "",
      workstation: workstation || "",
      assignedTeam: assignedTeam || "",
      quantity: Number(quantity || 1),
      targetDate: targetDate || "",
      status: status || deriveStatusFromProgress(pct),
      remarks: remarks || "",
      progressPercentage: pct,
      progressUpdatedBy: pct > 0 ? getActor(req) : "",
      progressUpdatedAt: pct > 0 ? new Date() : null,
      checklist: checklist || {},
      hoursLog: Array.isArray(hoursLog) ? hoursLog : [],
    });

    if (pct > 0) {
      await FabricationProgressLog.create({
        fabricationId: doc._id,
        drawingId: doc._id,
        jobId,
        oldPercentage: 0,
        newPercentage: pct,
        remarks: remarks || "Initial progress",
        updatedBy: getActor(req),
        timestamp: new Date(),
      });
    }

    const allItems = await Fabrication.find({ jobId });
    const overallProgress = calcOverallProgress(allItems);
    await syncJobFabricationTimeline(jobId, overallProgress, getActor(req));

    return res.status(201).json({
      success: true,
      result: doc,
      overallProgress,
      message: "Fabrication item created successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create fabrication item",
    });
  }
};

exports.listByJob = async (req, res) => {
  try {
    const { jobId } = req.params;

    const items = await Fabrication.find({ jobId }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      result: buildListPayload(items),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch fabrication items",
    });
  }
};

exports.updateProgress = async (req, res) => {
  try {
    if (!canUpdateProgress(req)) {
      return res.status(403).json({
        success: false,
        message: "Only workers and admins can update fabrication progress",
      });
    }

    const { id } = req.params;
    const { progressPercentage, remarks } = req.body;

    if (progressPercentage === undefined || progressPercentage === null) {
      return res.status(400).json({
        success: false,
        message: "progressPercentage is required",
      });
    }

    const item = await Fabrication.findById(id);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Fabrication item not found",
      });
    }

    const oldPercentage = Number(item.progressPercentage || 0);
    const newPercentage = Math.min(100, Math.max(0, Number(progressPercentage)));
    const actor = getActor(req);
    const now = new Date();

    if (
      newPercentage >= 100 &&
      (!Array.isArray(item.photoUrls) || item.photoUrls.length === 0)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Upload at least one photo before marking this fabrication item 100% complete",
      });
    }

    item.progressPercentage = newPercentage;
    item.progressUpdatedBy = actor;
    item.progressUpdatedAt = now;
    item.status = deriveStatusFromProgress(newPercentage);

    if (remarks !== undefined) {
      item.remarks = remarks;
    }

    await item.save();

    await FabricationProgressLog.create({
      fabricationId: item._id,
      drawingId: item._id,
      jobId: item.jobId,
      oldPercentage,
      newPercentage,
      remarks: remarks || "",
      updatedBy: actor,
      timestamp: now,
    });

    const allItems = await Fabrication.find({ jobId: item.jobId });
    const overallProgress = calcOverallProgress(allItems);
    const job = await syncJobFabricationTimeline(item.jobId, overallProgress, actor);

    return res.status(200).json({
      success: true,
      result: item,
      overallProgress,
      timelineUpdated: overallProgress >= 100 && !!job,
      message: "Fabrication progress updated successfully",
    });
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({
      success: false,
      message: error.message || "Failed to update fabrication progress",
    });
  }
};

exports.getHistory = async (req, res) => {
  try {
    const { jobId } = req.params;

    const logs = await FabricationProgressLog.find({ jobId })
      .sort({ timestamp: -1 })
      .populate("fabricationId", "itemName drawingRef");

    return res.status(200).json({
      success: true,
      result: logs,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch fabrication history",
    });
  }
};

exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const payload = { ...req.body };

    const existing = await Fabrication.findById(id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Fabrication item not found",
      });
    }

    if (payload.status && payload.status !== existing.status) {
      if (!canOverrideStatus(req)) {
        return res.status(403).json({
          success: false,
          message: "Only admin can manually override fabrication status",
        });
      }
    }

    if (payload.quantity !== undefined) {
      payload.quantity = Number(payload.quantity || 1);
    }

    if (payload.hoursLog && !Array.isArray(payload.hoursLog)) {
      return res.status(400).json({
        success: false,
        message: "hoursLog must be an array",
      });
    }

    if (payload.progressPercentage !== undefined) {
      if (!canUpdateProgress(req)) {
        return res.status(403).json({
          success: false,
          message: "Only workers and admins can update fabrication progress",
        });
      }

      const oldPercentage = Number(existing.progressPercentage || 0);
      const newPercentage = Math.min(
        100,
        Math.max(0, Number(payload.progressPercentage))
      );
      payload.progressPercentage = newPercentage;
      payload.progressUpdatedBy = getActor(req);
      payload.progressUpdatedAt = new Date();
      payload.status = payload.status || deriveStatusFromProgress(newPercentage);

      if (newPercentage !== oldPercentage) {
        await FabricationProgressLog.create({
          fabricationId: existing._id,
          drawingId: existing._id,
          jobId: existing.jobId,
          oldPercentage,
          newPercentage,
          remarks: payload.remarks || existing.remarks || "",
          updatedBy: getActor(req),
          timestamp: new Date(),
        });
      }
    }

    const updated = await Fabrication.findByIdAndUpdate(id, payload, {
      new: true,
      runValidators: true,
    });

    const allItems = await Fabrication.find({ jobId: updated.jobId });
    const overallProgress = calcOverallProgress(allItems);
    await syncJobFabricationTimeline(updated.jobId, overallProgress, getActor(req));

    return res.status(200).json({
      success: true,
      result: updated,
      overallProgress,
      message: "Fabrication item updated successfully",
    });
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({
      success: false,
      message: error.message || "Failed to update fabrication item",
    });
  }
};

exports.uploadFiles = async (req, res) => {
  try {
    const item = await Fabrication.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, message: "Fabrication item not found" });
    }

    const files = req.files || [];
    const uploadedUrls = files.map((f) => `/uploads/fabrication/${f.filename}`);

    item.photoUrls = [...(item.photoUrls || []), ...uploadedUrls];
    await item.save();

    return res.status(200).json({
      success: true,
      result: item,
      message: `${uploadedUrls.length} file(s) uploaded`,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message || "Upload failed",
    });
  }
};

exports.remove = async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await Fabrication.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Fabrication item not found",
      });
    }

    return res.status(200).json({
      success: true,
      result: deleted,
      message: "Fabrication item deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to delete fabrication item",
    });
  }
};
