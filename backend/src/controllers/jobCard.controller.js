const mongoose = require("mongoose");

const JobCard = require("../models/appModels/JobCard");
const Job = require("../models/appModels/Job");
const Installation = require("../models/appModels/Installation");
const ScheduleAssignment = require("../models/appModels/ScheduleAssignment");
const { sortInstallationItems } = require("../utils/installationSequence");
const { persistFiles } = require("../utils/persistUpload");

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const getActor = (req) => ({
  name: req.user?.name || req.admin?.name || req.user?.email || "System",
  role: String(req.user?.role || req.admin?.role || "admin").toLowerCase(),
  workerId: String(req.user?.workerId || "").trim(),
});

const buildCardNumber = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `JC-${y}${m}${d}-${rand}`;
};

const sumHours = (hoursLog = []) =>
  (Array.isArray(hoursLog) ? hoursLog : []).reduce(
    (sum, entry) => sum + Number(entry?.hours || 0),
    0
  );

const getWorkerJobIds = async (req) => {
  const actor = getActor(req);
  const name = String(actor.name || "").trim();
  const workerId = actor.workerId;

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
    orFilters.push({ teams: nameRegex });
  }
  if (workerRegex) {
    orFilters.push({ assigneeName: workerRegex });
    orFilters.push({ "assignees.assigneeName": workerRegex });
  }

  if (!orFilters.length) return [];

  const assignments = await ScheduleAssignment.find({ $or: orFilters }).lean();
  return [...new Set(assignments.map((item) => String(item.jobId)))];
};

const installerMatchesCard = (card, actor) => {
  const name = String(actor.name || "").trim();
  const installers = Array.isArray(card.assignedInstallers) ? card.assignedInstallers : [];
  if (!installers.length) return true;
  if (!name) return false;
  return installers.some(
    (installer) => String(installer).trim().toLowerCase() === name.toLowerCase()
  );
};

exports.listByJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    if (!isValidObjectId(jobId)) {
      return res.status(400).json({ success: false, message: "Invalid jobId" });
    }

    const result = await JobCard.find({ jobId })
      .sort({ sequenceOrder: 1, createdAt: 1 })
      .populate("installationId", "activityName status sequenceOrder");

    return res.status(200).json({
      success: true,
      result,
      message: "Job cards fetched",
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.listMyCards = async (req, res) => {
  try {
    const actor = getActor(req);
    if (actor.role !== "worker") {
      return res.status(403).json({ success: false, message: "Workers only" });
    }

    const jobIds = await getWorkerJobIds(req);
    if (!jobIds.length) {
      return res.json({ success: true, result: [] });
    }

    const { jobId } = req.query;
    const query = { jobId: { $in: jobIds } };
    if (jobId && isValidObjectId(jobId)) {
      query.jobId = jobId;
    }

    const cards = await JobCard.find(query)
      .sort({ sequenceOrder: 1, createdAt: 1 })
      .populate("installationId", "activityName status sequenceOrder");

    const result = cards.filter((card) => installerMatchesCard(card, actor));

    return res.json({ success: true, result });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const payload = req.body || {};
    const actor = getActor(req);

    if (!isValidObjectId(payload.jobId)) {
      return res.status(400).json({ success: false, message: "Valid jobId is required" });
    }
    if (!payload.title?.trim()) {
      return res.status(400).json({ success: false, message: "Title is required" });
    }

    const job = await Job.findById(payload.jobId);
    if (!job) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }

    const assignedInstallers = Array.isArray(payload.assignedInstallers)
      ? payload.assignedInstallers
      : [];

    const created = await JobCard.create({
      jobId: payload.jobId,
      installationId: payload.installationId || null,
      cardNumber: buildCardNumber(),
      title: payload.title.trim(),
      description: payload.description || "",
      sequenceOrder: Number(payload.sequenceOrder || 0),
      locationArea: payload.locationArea || "",
      assignedInstallers,
      siteAccessNotes: payload.siteAccessNotes || "",
      toolsRequired: payload.toolsRequired || "",
      materialsRequired: payload.materialsRequired || "",
      completionCriteria: payload.completionCriteria || "",
      safetyChecklist: payload.safetyChecklist || {},
      plannedStart: payload.plannedStart || "",
      plannedEnd: payload.plannedEnd || "",
      expectedHours: Number(payload.expectedHours || 0),
      actualHours: Number(payload.actualHours || 0),
      status:
        payload.status ||
        (assignedInstallers.length ? "Assigned" : "Pending"),
      remarks: payload.remarks || "",
      createdBy: actor.name,
    });

    return res.status(201).json({
      success: true,
      result: created,
      message: "Job card created",
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

exports.generateFromInstallation = async (req, res) => {
  try {
    const { jobId } = req.params;
    const actor = getActor(req);

    if (!isValidObjectId(jobId)) {
      return res.status(400).json({ success: false, message: "Invalid jobId" });
    }

    const activities = sortInstallationItems(await Installation.find({ jobId }));
    if (!activities.length) {
      return res.status(400).json({
        success: false,
        message: "Add installation activities before generating job cards",
      });
    }

    const existing = await JobCard.find({ jobId });
    const linkedIds = new Set(
      existing
        .filter((card) => card.installationId)
        .map((card) => String(card.installationId))
    );

    const created = [];
    for (const activity of activities) {
      if (linkedIds.has(String(activity._id))) continue;

      const card = await JobCard.create({
        jobId,
        installationId: activity._id,
        cardNumber: buildCardNumber(),
        title: activity.activityName,
        description: activity.remarks || "",
        sequenceOrder: Number(activity.sequenceOrder || 0),
        locationArea: activity.locationArea || "",
        assignedInstallers: Array.isArray(activity.assignedTeam)
          ? activity.assignedTeam
          : [],
        plannedStart: activity.plannedDate || "",
        plannedEnd: activity.completedDate || "",
        expectedHours: Number(activity.expectedHours || 0),
        actualHours: Number(activity.actualHours || 0),
        status:
          activity.status === "Completed"
            ? "Completed"
            : activity.assignedTeam?.length
              ? "Assigned"
              : "Pending",
        snagIssue: activity.snagIssue || "",
        remarks: activity.remarks || "",
        createdBy: actor.name,
      });
      created.push(card);
    }

    return res.status(201).json({
      success: true,
      result: created,
      message: created.length
        ? `${created.length} job card(s) generated`
        : "All installation activities already have job cards",
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const existing = await JobCard.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: "Job card not found" });
    }

    const payload = { ...req.body };
    if (payload.assignedInstallers && !Array.isArray(payload.assignedInstallers)) {
      return res.status(400).json({
        success: false,
        message: "assignedInstallers must be an array",
      });
    }
    if (payload.hoursLog && !Array.isArray(payload.hoursLog)) {
      return res.status(400).json({
        success: false,
        message: "hoursLog must be an array",
      });
    }

    const updated = await JobCard.findByIdAndUpdate(req.params.id, payload, {
      new: true,
      runValidators: true,
    });

    return res.status(200).json({
      success: true,
      result: updated,
      message: "Job card updated",
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

exports.execute = async (req, res) => {
  try {
    const actor = getActor(req);
    if (actor.role !== "worker") {
      return res.status(403).json({ success: false, message: "Workers only" });
    }

    const card = await JobCard.findById(req.params.id);
    if (!card) {
      return res.status(404).json({ success: false, message: "Job card not found" });
    }

    const workerJobIds = await getWorkerJobIds(req);
    if (!workerJobIds.includes(String(card.jobId))) {
      return res.status(403).json({ success: false, message: "Not assigned to this job" });
    }
    if (!installerMatchesCard(card, actor)) {
      return res.status(403).json({ success: false, message: "Not assigned to this job card" });
    }

    const {
      status,
      actualStart,
      actualEnd,
      actualHours,
      hoursEntry,
      safetyChecklist,
      snagIssue,
      remarks,
    } = req.body || {};

    if (status !== undefined) card.status = status;
    if (actualStart !== undefined) card.actualStart = actualStart;
    if (actualEnd !== undefined) card.actualEnd = actualEnd;
    if (safetyChecklist !== undefined) {
      card.safetyChecklist = { ...(card.safetyChecklist || {}), ...safetyChecklist };
    }
    if (snagIssue !== undefined) card.snagIssue = snagIssue;
    if (remarks !== undefined) card.remarks = remarks;

    if (hoursEntry && typeof hoursEntry === "object") {
      const log = Array.isArray(card.hoursLog) ? card.hoursLog : [];
      log.push({
        workerName: hoursEntry.workerName || actor.name,
        role: hoursEntry.role || "Installer",
        hours: Number(hoursEntry.hours || 0),
        workDate: hoursEntry.workDate || "",
        notes: hoursEntry.notes || "",
      });
      card.hoursLog = log;
      card.actualHours = sumHours(card.hoursLog);
    } else if (actualHours !== undefined) {
      card.actualHours = Number(actualHours || 0);
    }

    if (card.status === "Completed") {
      card.completedBy = actor.name;
      if (!card.actualEnd) card.actualEnd = new Date().toISOString().slice(0, 10);
    }

    await card.save();

    return res.status(200).json({
      success: true,
      result: card,
      message: "Job card execution updated",
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

exports.uploadFiles = async (req, res) => {
  try {
    const card = await JobCard.findById(req.params.id);
    if (!card) {
      return res.status(404).json({ success: false, message: "Job card not found" });
    }

    const files = req.files || [];
    const persisted = await persistFiles(files, "job-cards");
    const uploadedUrls = persisted.map((f) => f.url);
    card.photoUrls = [...(card.photoUrls || []), ...uploadedUrls];
    await card.save();

    return res.status(200).json({
      success: true,
      result: card,
      message: `${uploadedUrls.length} file(s) uploaded`,
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const deleted = await JobCard.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Job card not found" });
    }

    return res.status(200).json({
      success: true,
      result: deleted,
      message: "Job card deleted",
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
