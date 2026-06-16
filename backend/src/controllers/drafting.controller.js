const mongoose = require("mongoose");

const Drafting = mongoose.models.Drafting;
const Job = mongoose.models.Job;

if (!Drafting) throw new Error("Drafting model not loaded");
if (!Job) throw new Error("Job model not loaded");

// keep job in Drafting stage while records are being created/updated
const syncJobDraftingStage = async (jobObjectId, isIFCApproved = false) => {
  if (!jobObjectId) return;

  const job = await Job.findById(jobObjectId);
  if (!job) return;

  if (!job.workflowEvents) job.workflowEvents = {};
  if (!job.workflowEvents.drafting) job.workflowEvents.drafting = {};
  if (!job.workflowEvents.clientApproval) job.workflowEvents.clientApproval = {};

  if (isIFCApproved) {
    if (!job.workflowEvents.drafting.isCompleted) {
      job.workflowEvents.drafting.isCompleted = true;
      job.workflowEvents.drafting.completedAt = new Date();
      job.workflowEvents.drafting.completedBy = "Drafting Module (IFC)";
    }
    if (!job.workflowEvents.clientApproval.isCompleted) {
      job.workflowEvents.clientApproval.isCompleted = true;
      job.workflowEvents.clientApproval.approvalDate = new Date();
      job.workflowEvents.clientApproval.completedAt = new Date();
      job.workflowEvents.clientApproval.completedBy = "Drafting Module (IFC)";
    }
  } else {
    // Both pending
    job.workflowEvents.drafting.isCompleted = false;
    job.workflowEvents.clientApproval.isCompleted = false;
    
    if (!job.workflowEvents.drafting.startActual) {
      job.workflowEvents.drafting.startActual = new Date();
    }
  }

  job.markModified("workflowEvents");
  await job.save();
};

// GET /api/drafting/list/:jobId
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

    const result = await Drafting.find({ jobId }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      result,
      message: "Drafting records fetched",
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      result: [],
      message: err.message,
    });
  }
};

// GET /api/drafting/read/:id
exports.read = async (req, res) => {
  try {
    const result = await Drafting.findById(req.params.id);

    if (!result) {
      return res.status(404).json({
        success: false,
        result: null,
        message: "Drafting record not found",
      });
    }

    return res.status(200).json({
      success: true,
      result,
      message: "Drafting record fetched",
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      result: null,
      message: err.message,
    });
  }
};

// POST /api/drafting/create
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

    if (!payload.title || !payload.drawingType || !payload.revision) {
      return res.status(400).json({
        success: false,
        result: null,
        message: "title, drawingType and revision are required",
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

    const created = await Drafting.create({
      jobId: payload.jobId,
      title: payload.title,
      drawingType: payload.drawingType,
      revision: payload.revision,
      status: payload.status || "Draft",
      preparedBy: payload.preparedBy || "",
      checkedBy: payload.checkedBy || "",
      approvedBy: payload.approvedBy || "",
      remarks: payload.remarks || "",
      fileUrl: payload.fileUrl || "",
      isIFCApproved:
        payload.isIFCApproved === true ||
        payload.isIFCApproved === "true" ||
        payload.status === "IFC Approved",
    });

    await syncJobDraftingStage(payload.jobId, created.isIFCApproved || created.status === "IFC Approved");

    return res.status(201).json({
      success: true,
      result: created,
      message: "Drafting record created",
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      result: null,
      message: err.message,
    });
  }
};

// PATCH /api/drafting/update/:id
exports.update = async (req, res) => {
  try {
    const existing = await Drafting.findById(req.params.id);

    if (!existing) {
      return res.status(404).json({
        success: false,
        result: null,
        message: "Drafting record not found",
      });
    }

    const payload = { ...req.body };

    if (payload.status === "IFC Approved") {
      payload.isIFCApproved = true;
    }

    const updated = await Drafting.findByIdAndUpdate(req.params.id, payload, {
      new: true,
      runValidators: true,
    });

    await syncJobDraftingStage(updated.jobId, updated.isIFCApproved || updated.status === "IFC Approved");

    return res.status(200).json({
      success: true,
      result: updated,
      message: "Drafting record updated",
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      result: null,
      message: err.message,
    });
  }
};

// DELETE /api/drafting/delete/:id
exports.delete = async (req, res) => {
  try {
    const deleted = await Drafting.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        result: null,
        message: "Drafting record not found",
      });
    }

    return res.status(200).json({
      success: true,
      result: deleted,
      message: "Drafting record deleted",
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      result: null,
      message: err.message,
    });
  }
};