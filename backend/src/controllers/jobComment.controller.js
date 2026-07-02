const JobComment = require("../models/appModels/JobComment");
const Job = require("../models/appModels/Job");
const ScheduleAssignment = require("../models/appModels/ScheduleAssignment");
const { notifyJobComment } = require("../services/notificationService");

const getActor = (req) => ({
  id: req.user?._id || req.admin?._id || null,
  name: req.user?.name || req.admin?.name || req.user?.email || "User",
  role: req.user?.role || req.admin?.role || "admin",
});

const mapUploadedFiles = (files = []) =>
  files.map((file) => ({
    fileUrl: `/uploads/job-comments/${file.filename}`,
    originalName: file.originalname || file.filename,
  }));

exports.myAssignedJobs = async (req, res) => {
  try {
    const actor = getActor(req);
    const role = String(actor.role || "").toLowerCase();

    if (role !== "worker") {
      return res.status(403).json({ success: false, message: "Workers only" });
    }

    const name = String(actor.name || "").trim();
    const workerId = String(req.user?.workerId || "").trim();
    const nameRegex = name
      ? new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i")
      : null;
    const workerRegex = workerId
      ? new RegExp(workerId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")
      : null;

    const orFilters = [];
    if (nameRegex) {
      orFilters.push({ assigneeName: nameRegex });
      orFilters.push({ "assignees.assigneeName": nameRegex });
    }
    if (workerRegex) {
      orFilters.push({ assigneeName: workerRegex });
      orFilters.push({ "assignees.assigneeName": workerRegex });
    }

    if (!orFilters.length) {
      return res.json({ success: true, result: [] });
    }

    const assignments = await ScheduleAssignment.find({ $or: orFilters })
      .sort({ startTime: -1 })
      .lean();

    const jobMap = new Map();
    for (const assignment of assignments) {
      const key = String(assignment.jobId);
      if (!jobMap.has(key)) {
        jobMap.set(key, {
          _id: assignment.jobId,
          assignments: [],
        });
      }
      jobMap.get(key).assignments.push(assignment);
    }

    const jobIds = [...jobMap.keys()];
    const jobs = await Job.find({ _id: { $in: jobIds }, removed: false })
      .select("jobId customer site systemState")
      .lean();

    const result = jobs.map((job) => ({
      ...job,
      assignments: jobMap.get(String(job._id))?.assignments || [],
    }));

    return res.json({ success: true, result });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.listByJob = async (req, res) => {
  try {
    const job = await Job.findById(req.params.jobId);
    if (!job) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }

    const items = await JobComment.find({ jobId: req.params.jobId }).sort({ createdAt: 1 });
    return res.json({ success: true, result: items });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const { message, attachments } = req.body || {};
    const uploaded = mapUploadedFiles(req.files || []);
    const bodyAttachments = Array.isArray(attachments) ? attachments : [];
    const allAttachments = [...bodyAttachments, ...uploaded];

    if (!message || !String(message).trim()) {
      if (!allAttachments.length) {
        return res.status(400).json({ success: false, message: "Message or attachment is required" });
      }
    }

    const job = await Job.findById(req.params.jobId);
    if (!job) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }

    const actor = getActor(req);
    const created = await JobComment.create({
      jobId: job._id,
      authorId: actor.id,
      authorName: actor.name,
      authorRole: actor.role,
      message: String(message || "Shared an attachment").trim(),
      attachments: allAttachments,
    });

    try {
      await notifyJobComment({
        job,
        comment: created,
        actor,
      });
    } catch {
      // Comment saved even if notifications fail.
    }

    return res.status(201).json({ success: true, result: created });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};
