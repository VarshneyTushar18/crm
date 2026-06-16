const mongoose = require("mongoose");

const SiteMeasurement = mongoose.models.SiteMeasurement;
const Job = mongoose.models.Job;

if (!SiteMeasurement) throw new Error("SiteMeasurement model not loaded");
if (!Job) throw new Error("Job model not loaded");

// sync related job timeline stage/status after create/update
const syncJobStage = async (jobObjectId, isCompleted = false) => {
  if (!jobObjectId) return;

  const job = await Job.findById(jobObjectId);
  if (!job) return;

  if (!job.workflowEvents) job.workflowEvents = {};
  if (!job.workflowEvents.siteMeasurement) job.workflowEvents.siteMeasurement = {};

  if (isCompleted && !job.workflowEvents.siteMeasurement.isCompleted) {
    job.workflowEvents.siteMeasurement.isCompleted = true;
    job.workflowEvents.siteMeasurement.completedAt = new Date();
    job.workflowEvents.siteMeasurement.completedBy = "Site Measurement Module";
    job.stage = "planning"; // Move to Planning
  }

  job.markModified("workflowEvents");
  await job.save();
};

// GET /api/measurement/list
exports.listMeasurements = async (req, res) => {
  try {
    const result = await SiteMeasurement.find({})
      .populate("jobId", "jobId customer site stage status")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      result,
      message: "Site measurements fetched",
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      result: null,
      message: err.message,
    });
  }
};

// GET /api/measurement/read/:id
exports.readMeasurement = async (req, res) => {
  try {
    const result = await SiteMeasurement.findById(req.params.id).populate(
      "jobId",
      "jobId customer site stage status"
    );

    if (!result) {
      return res.status(404).json({
        success: false,
        result: null,
        message: "Site measurement not found",
      });
    }

    return res.status(200).json({
      success: true,
      result,
      message: "Site measurement fetched",
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      result: null,
      message: err.message,
    });
  }
};

// POST /api/measurement/create
exports.createMeasurement = async (req, res) => {
  try {
    const payload = req.body;

    if (!payload.jobId) {
      return res.status(400).json({
        success: false,
        result: null,
        message: "jobId is required",
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

    // optional: one measurement record per job
    const existing = await SiteMeasurement.findOne({ jobId: payload.jobId });
    if (existing) {
      return res.status(400).json({
        success: false,
        result: null,
        message: "Measurement already exists for this job. Please update it.",
      });
    }

    const created = await SiteMeasurement.create({
      jobId: payload.jobId,
      measuredBy: payload.measuredBy || "",
      siteAddress: payload.siteAddress || job.site || "",
      height: Number(payload.height || 0),
      width: Number(payload.width || 0),
      length: Number(payload.length || 0),
      materialType: payload.materialType || "",
      fixingSurfaces: payload.fixingSurfaces || "",
      accessDetails: payload.accessDetails || "",
      parkingDetails: payload.parkingDetails || "",
      powerAvailable: !!payload.powerAvailable,
      powerLocation: payload.powerLocation || "",
      waterAvailable: !!payload.waterAvailable,
      waterLocation: payload.waterLocation || "",
      liftAccess: payload.liftAccess || "",
      washroomAccess: payload.washroomAccess || "",
      publicRisk: payload.publicRisk || "",
      whsHazards: payload.whsHazards || "",
      gpsLocation: payload.gpsLocation || "",
      photoUrls: Array.isArray(payload.photoUrls) ? payload.photoUrls : [],
      notes: payload.notes || "",
      measurementDate: payload.measurementDate
        ? new Date(payload.measurementDate)
        : new Date(),
      status: payload.status || "Completed",
    });

    await syncJobStage(payload.jobId, payload.status === "Completed");

    return res.status(201).json({
      success: true,
      result: created,
      message: "Site measurement created",
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      result: null,
      message: err.message,
    });
  }
};

// PATCH /api/measurement/update/:id
exports.updateMeasurement = async (req, res) => {
  try {
    const existing = await SiteMeasurement.findById(req.params.id);

    if (!existing) {
      return res.status(404).json({
        success: false,
        result: null,
        message: "Site measurement not found",
      });
    }

    const payload = { ...req.body };

    if (payload.height !== undefined) payload.height = Number(payload.height);
    if (payload.width !== undefined) payload.width = Number(payload.width);
    if (payload.length !== undefined) payload.length = Number(payload.length);

    if (payload.measurementDate) {
      payload.measurementDate = new Date(payload.measurementDate);
    }

    if (payload.photoUrls && !Array.isArray(payload.photoUrls)) {
      payload.photoUrls = [];
    }

    const updated = await SiteMeasurement.findByIdAndUpdate(
      req.params.id,
      payload,
      {
        new: true,
        runValidators: true,
      }
    ).populate("jobId", "jobId customer site stage status");

    await syncJobStage(updated?.jobId?._id || existing.jobId, payload.status === "Completed" || updated.status === "Completed");

    return res.status(200).json({
      success: true,
      result: updated,
      message: "Site measurement updated",
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      result: null,
      message: err.message,
    });
  }
};

// DELETE /api/measurement/delete/:id
exports.deleteMeasurement = async (req, res) => {
  try {
    const deleted = await SiteMeasurement.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        result: null,
        message: "Site measurement not found",
      });
    }

    return res.status(200).json({
      success: true,
      result: deleted,
      message: "Site measurement deleted",
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      result: null,
      message: err.message,
    });
  }
};