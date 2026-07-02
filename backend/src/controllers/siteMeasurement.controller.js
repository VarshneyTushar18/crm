const mongoose = require("mongoose");

const SiteMeasurement = mongoose.models.SiteMeasurement;
const Job = mongoose.models.Job;
const Drafting = mongoose.models.Drafting;
const Quote = mongoose.models.Quote;
const { markModuleCompleteForReview } = require("../utils/moduleSiteEngineerGate");

const assertPhotosForComplete = (photoUrls, isCompleting) => {
  if (isCompleting && (!Array.isArray(photoUrls) || photoUrls.length === 0)) {
    throw new Error(
      "Upload at least one photo or document before completing site measurement"
    );
  }
};

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
    await markModuleCompleteForReview(
      jobObjectId,
      "siteMeasurement",
      "Site Measurement Module"
    );
  } else if (!isCompleted) {
    job.workflowEvents.siteMeasurement.stageStatus =
      job.workflowEvents.siteMeasurement.stageStatus || "In Progress";
  }

  job.markModified("workflowEvents");
  await job.save();
};

// GET /api/measurement/list/:jobId
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

    const result = await SiteMeasurement.find({ jobId })
      .populate("jobId", "jobId customer site stage status")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      result,
      message: "Site measurements fetched for job",
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      result: [],
      message: err.message,
    });
  }
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

    const photoUrls = Array.isArray(payload.photoUrls) ? payload.photoUrls : [];
    assertPhotosForComplete(
      photoUrls,
      payload.status === "Completed"
    );

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
      photoUrls,
      notes: payload.notes || "",
      measurementDate: payload.measurementDate
        ? new Date(payload.measurementDate)
        : new Date(),
      status: payload.status || "Pending",
      startTime: payload.startTime ? new Date(payload.startTime) : null,
      endTime: payload.endTime ? new Date(payload.endTime) : null,
      totalHours: Number(payload.totalHours || 0),
      checklist: Array.isArray(payload.checklist) ? payload.checklist : [],
      signatureUrl: payload.signatureUrl || "",
      signedAt: payload.signedAt ? new Date(payload.signedAt) : null,
      signedBy: payload.signedBy || "",
      isLocked: !!payload.isLocked,
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

    if (existing.isLocked) {
      return res.status(400).json({
        success: false,
        result: null,
        message: "Site measurement is locked after signature and cannot be edited",
      });
    }

    const payload = { ...req.body };

    if (payload.height !== undefined) payload.height = Number(payload.height);
    if (payload.width !== undefined) payload.width = Number(payload.width);
    if (payload.length !== undefined) payload.length = Number(payload.length);

    if (payload.measurementDate) {
      payload.measurementDate = new Date(payload.measurementDate);
    }
    if (payload.startTime) payload.startTime = new Date(payload.startTime);
    if (payload.endTime) payload.endTime = new Date(payload.endTime);
    if (payload.signedAt) payload.signedAt = new Date(payload.signedAt);

    if (payload.signatureUrl && payload.status === "Completed") {
      payload.isLocked = true;
      payload.signedAt = payload.signedAt || new Date();
    }

    if (payload.photoUrls && !Array.isArray(payload.photoUrls)) {
      payload.photoUrls = [];
    }

    const willComplete =
      payload.status === "Completed" || existing.status === "Completed";
    const mergedPhotos =
      payload.photoUrls !== undefined ? payload.photoUrls : existing.photoUrls || [];

    if (payload.status === "Completed") {
      assertPhotosForComplete(mergedPhotos, true);
    }

    const updated = await SiteMeasurement.findByIdAndUpdate(
      req.params.id,
      payload,
      {
        new: true,
        runValidators: true,
      }
    ).populate("jobId", "jobId customer site stage status");

    await syncJobStage(
      updated?.jobId?._id || existing.jobId,
      payload.status === "Completed" || updated.status === "Completed"
    );

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

exports.uploadFiles = async (req, res) => {
  try {
    const measurement = await SiteMeasurement.findById(req.params.id);
    if (!measurement) {
      return res.status(404).json({ success: false, message: "Site measurement not found" });
    }

    const files = req.files || [];
    const uploadedUrls = files.map((f) => `/uploads/site-measurement/${f.filename}`);

    measurement.photoUrls = [...(measurement.photoUrls || []), ...uploadedUrls];
    await measurement.save();

    return res.json({
      success: true,
      result: measurement,
      message: `${uploadedUrls.length} file(s) uploaded`,
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};