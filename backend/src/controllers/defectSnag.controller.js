const mongoose = require("mongoose");
const DefectSnag = require("../models/appModels/DefectSnag");
const Job = require("../models/appModels/Job");
const { persistFiles } = require("../utils/persistUpload");

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const OPEN_STATUSES = ["Open", "In Progress"];

const syncJobHasDefects = async (jobId) => {
  if (!jobId || !isValidObjectId(jobId)) return;
  const openCount = await DefectSnag.countDocuments({
    jobId,
    status: { $in: OPEN_STATUSES },
  });
  await Job.findByIdAndUpdate(jobId, {
    $set: { "conditions.hasDefects": openCount > 0 },
  });
};

const countOpenForJob = async (jobId) =>
  DefectSnag.countDocuments({
    jobId,
    status: { $in: OPEN_STATUSES },
  });

/**
 * Upsert a Defect/Snag linked to an installation activity when status is Snag
 * or snagIssue text is present.
 */
const syncFromInstallationActivity = async (activity) => {
  if (!activity?._id || !activity.jobId) return null;

  const snagText = String(activity.snagIssue || "").trim();
  const isSnagStatus = activity.status === "Snag";
  if (!isSnagStatus && !snagText) return null;

  const owner = Array.isArray(activity.assignedTeam)
    ? activity.assignedTeam.filter(Boolean).join(", ")
    : "";
  const title =
    snagText ||
    `Defect / Snag — ${activity.activityName || "Installation activity"}`;

  const payload = {
    jobId: activity.jobId,
    installationActivityId: activity._id,
    type: "Snag",
    title,
    description: snagText,
    locationArea: activity.locationArea || "",
    owner,
    photoUrls: Array.isArray(activity.photoUrls) ? activity.photoUrls : [],
    source: "installation",
  };

  let existing = await DefectSnag.findOne({
    installationActivityId: activity._id,
    status: { $in: OPEN_STATUSES },
  }).sort({ createdAt: -1 });

  if (existing) {
    existing.title = payload.title;
    existing.description = payload.description;
    existing.locationArea = payload.locationArea;
    if (payload.owner) existing.owner = payload.owner;
    if (payload.photoUrls.length) {
      const merged = Array.from(
        new Set([...(existing.photoUrls || []), ...payload.photoUrls])
      );
      existing.photoUrls = merged;
    }
    await existing.save();
  } else {
    existing = await DefectSnag.create({
      ...payload,
      status: "Open",
      dueDate: "",
    });
  }

  await syncJobHasDefects(activity.jobId);
  return existing;
};

exports.syncFromInstallationActivity = syncFromInstallationActivity;
exports.countOpenForJob = countOpenForJob;
exports.syncJobHasDefects = syncJobHasDefects;

exports.listByJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    if (!jobId || !isValidObjectId(jobId)) {
      return res.status(400).json({
        success: false,
        result: [],
        message: "Valid jobId is required",
      });
    }

    const status = req.query.status;
    const filter = { jobId };
    if (status === "open") {
      filter.status = { $in: OPEN_STATUSES };
    } else if (status === "closed") {
      filter.status = "Closed";
    } else if (status && ["Open", "In Progress", "Closed"].includes(status)) {
      filter.status = status;
    }

    const result = await DefectSnag.find(filter).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      result,
      message: "Defects & snags fetched",
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      result: [],
      message: err.message,
    });
  }
};

exports.openCount = async (req, res) => {
  try {
    const { jobId } = req.params;
    if (!jobId || !isValidObjectId(jobId)) {
      return res.status(400).json({
        success: false,
        result: { count: 0 },
        message: "Valid jobId is required",
      });
    }

    const count = await countOpenForJob(jobId);
    return res.status(200).json({
      success: true,
      result: { count, hasOpen: count > 0 },
      message: "Open defect/snag count fetched",
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      result: { count: 0, hasOpen: false },
      message: err.message,
    });
  }
};

exports.create = async (req, res) => {
  try {
    const payload = req.body || {};

    if (!payload.jobId || !isValidObjectId(payload.jobId)) {
      return res.status(400).json({
        success: false,
        result: null,
        message: "Valid jobId is required",
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

    const title = String(payload.title || "").trim();
    if (!title) {
      return res.status(400).json({
        success: false,
        result: null,
        message: "Title is required",
      });
    }

    const created = await DefectSnag.create({
      jobId: payload.jobId,
      installationActivityId: payload.installationActivityId || null,
      type: payload.type === "Defect" ? "Defect" : "Snag",
      title,
      description: payload.description || "",
      locationArea: payload.locationArea || "",
      owner: payload.owner || "",
      dueDate: payload.dueDate || "",
      status: ["Open", "In Progress"].includes(payload.status)
        ? payload.status
        : "Open",
      photoUrls: Array.isArray(payload.photoUrls) ? payload.photoUrls : [],
      source: payload.source === "installation" ? "installation" : "manual",
    });

    await syncJobHasDefects(payload.jobId);

    return res.status(201).json({
      success: true,
      result: created,
      message: "Defect / snag created",
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
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        result: null,
        message: "Invalid id",
      });
    }

    const existing = await DefectSnag.findById(id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        result: null,
        message: "Defect / snag not found",
      });
    }

    if (existing.status === "Closed") {
      return res.status(400).json({
        success: false,
        result: existing,
        message: "Closed items cannot be edited — reopen is not supported here",
      });
    }

    const body = req.body || {};
    if (body.type === "Defect" || body.type === "Snag") existing.type = body.type;
    if (body.title !== undefined) existing.title = String(body.title || "").trim();
    if (body.description !== undefined) existing.description = body.description || "";
    if (body.locationArea !== undefined) existing.locationArea = body.locationArea || "";
    if (body.owner !== undefined) existing.owner = body.owner || "";
    if (body.dueDate !== undefined) existing.dueDate = body.dueDate || "";
    if (body.status === "Open" || body.status === "In Progress") {
      existing.status = body.status;
    }
    if (Array.isArray(body.photoUrls)) existing.photoUrls = body.photoUrls;

    if (!existing.title) {
      return res.status(400).json({
        success: false,
        result: null,
        message: "Title is required",
      });
    }

    await existing.save();
    await syncJobHasDefects(existing.jobId);

    return res.status(200).json({
      success: true,
      result: existing,
      message: "Defect / snag updated",
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      result: null,
      message: err.message,
    });
  }
};

exports.close = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        result: null,
        message: "Invalid id",
      });
    }

    const existing = await DefectSnag.findById(id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        result: null,
        message: "Defect / snag not found",
      });
    }

    if (existing.status === "Closed") {
      return res.status(200).json({
        success: true,
        result: existing,
        message: "Already closed",
      });
    }

    const body = req.body || {};
    const closeOutNotes = String(body.closeOutNotes || "").trim();
    if (!closeOutNotes) {
      return res.status(400).json({
        success: false,
        result: null,
        message: "Close-out notes are required",
      });
    }

    existing.status = "Closed";
    existing.closedBy = body.closedBy || "";
    existing.closedAt = new Date();
    existing.closeOutNotes = closeOutNotes;
    if (Array.isArray(body.closeOutPhotoUrls) && body.closeOutPhotoUrls.length) {
      existing.closeOutPhotoUrls = [
        ...(existing.closeOutPhotoUrls || []),
        ...body.closeOutPhotoUrls,
      ];
    }

    await existing.save();
    await syncJobHasDefects(existing.jobId);

    return res.status(200).json({
      success: true,
      result: existing,
      message: "Defect / snag cleared",
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      result: null,
      message: err.message,
    });
  }
};

exports.uploadPhotos = async (req, res) => {
  try {
    const { id } = req.params;
    const which = req.query.which === "closeout" ? "closeout" : "evidence";

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        result: null,
        message: "Invalid id",
      });
    }

    const item = await DefectSnag.findById(id);
    if (!item) {
      return res.status(404).json({
        success: false,
        result: null,
        message: "Defect / snag not found",
      });
    }

    const files = req.files || [];
    if (!files.length) {
      return res.status(400).json({
        success: false,
        result: item,
        message: "No files uploaded",
      });
    }

    const persisted = await persistFiles(files, "defect-snag");
    const uploadedUrls = persisted.map((f) => f.url);

    if (which === "closeout") {
      item.closeOutPhotoUrls = [...(item.closeOutPhotoUrls || []), ...uploadedUrls];
    } else {
      item.photoUrls = [...(item.photoUrls || []), ...uploadedUrls];
    }
    await item.save();

    return res.status(200).json({
      success: true,
      result: item,
      message: `${uploadedUrls.length} file(s) uploaded`,
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      result: null,
      message: err.message || "Upload failed",
    });
  }
};
