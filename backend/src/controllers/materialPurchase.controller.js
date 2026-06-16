const mongoose = require("mongoose");

const MaterialPurchase = mongoose.models.MaterialPurchase;
const Job = mongoose.models.Job;

if (!MaterialPurchase) throw new Error("MaterialPurchase model not loaded");
if (!Job) throw new Error("Job model not loaded");

const syncJobMaterialStage = async (jobObjectId, isCompleted = false) => {
  if (!jobObjectId) return;

  const job = await Job.findById(jobObjectId);
  if (!job) return;

  if (!job.workflowEvents) job.workflowEvents = {};
  if (!job.workflowEvents.materialPurchasing) job.workflowEvents.materialPurchasing = {};

  if (isCompleted && !job.workflowEvents.materialPurchasing.isCompleted) {
    job.workflowEvents.materialPurchasing.isCompleted = true;
    job.workflowEvents.materialPurchasing.completedAt = new Date();
    job.workflowEvents.materialPurchasing.completedBy = "Material Purchase Module";
  }

  job.markModified("workflowEvents");
  await job.save();
};

// GET /api/material-purchase/list/:jobId
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

    const result = await MaterialPurchase.find({ jobId }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      result,
      message: "Material items fetched",
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      result: [],
      message: err.message,
    });
  }
};

// GET /api/material-purchase/read/:id
exports.read = async (req, res) => {
  try {
    const result = await MaterialPurchase.findById(req.params.id);

    if (!result) {
      return res.status(404).json({
        success: false,
        result: null,
        message: "Material item not found",
      });
    }

    return res.status(200).json({
      success: true,
      result,
      message: "Material item fetched",
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      result: null,
      message: err.message,
    });
  }
};

// POST /api/material-purchase/create
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

    const created = await MaterialPurchase.create({
      jobId: payload.jobId,
      itemName: payload.itemName,
      category: payload.category || "",
      specification: payload.specification || "",
      unit: payload.unit || "Nos",
      requiredQty: Number(payload.requiredQty || 0),
      orderedQty: Number(payload.orderedQty || 0),
      receivedQty: Number(payload.receivedQty || 0),
      supplier: payload.supplier || "",
      expectedDelivery: payload.expectedDelivery || "",
      status: payload.status || "Pending",
      remarks: payload.remarks || "",
    });

    await syncJobMaterialStage(payload.jobId, payload.status === "Received" || payload.status === "Completed");

    return res.status(201).json({
      success: true,
      result: created,
      message: "Material item created",
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      result: null,
      message: err.message,
    });
  }
};

// PATCH /api/material-purchase/update/:id
exports.update = async (req, res) => {
  try {
    const existing = await MaterialPurchase.findById(req.params.id);

    if (!existing) {
      return res.status(404).json({
        success: false,
        result: null,
        message: "Material item not found",
      });
    }

    const payload = { ...req.body };

    if (payload.requiredQty !== undefined) {
      payload.requiredQty = Number(payload.requiredQty);
    }

    if (payload.orderedQty !== undefined) {
      payload.orderedQty = Number(payload.orderedQty);
    }

    if (payload.receivedQty !== undefined) {
      payload.receivedQty = Number(payload.receivedQty);
    }

    const updated = await MaterialPurchase.findByIdAndUpdate(
      req.params.id,
      payload,
      {
        new: true,
        runValidators: true,
      }
    );

    await syncJobMaterialStage(updated.jobId, payload.status === "Received" || updated.status === "Received" || payload.status === "Completed" || updated.status === "Completed");

    return res.status(200).json({
      success: true,
      result: updated,
      message: "Material item updated",
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      result: null,
      message: err.message,
    });
  }
};

// DELETE /api/material-purchase/delete/:id
exports.delete = async (req, res) => {
  try {
    const deleted = await MaterialPurchase.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        result: null,
        message: "Material item not found",
      });
    }

    return res.status(200).json({
      success: true,
      result: deleted,
      message: "Material item deleted",
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      result: null,
      message: err.message,
    });
  }
};