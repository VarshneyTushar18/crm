const ScheduleAssignment = require("../models/appModels/ScheduleAssignment");
const Job = require("../models/appModels/Job");
const { markModuleCompleteForReview } = require("../utils/moduleSiteEngineerGate");
const { notifyWorkflow, notifyEta } = require("../services/notificationService");
const {
  travelMinutesFromCoords,
  buildMapsUrl,
  calcEta,
  DEFAULT_TRAVEL_MINUTES,
} = require("../utils/travelEstimate");

const getActor = (req) =>
  req.user?.name || req.user?.email || req.admin?.name || "System";

const normalizeAssignmentPeople = (payload = {}) => {
  const next = { ...payload };

  let assignees = Array.isArray(next.assignees)
    ? next.assignees
        .map((item) => ({
          assigneeId: item?.assigneeId || null,
          assigneeName: String(item?.assigneeName || "").trim(),
        }))
        .filter((item) => item.assigneeId || item.assigneeName)
    : [];

  if (!assignees.length && next.assigneeId) {
    assignees.push({
      assigneeId: next.assigneeId,
      assigneeName: String(next.assigneeName || "").trim(),
    });
  }

  let teams = Array.isArray(next.teams)
    ? [...new Set(next.teams.map((t) => String(t || "").trim()).filter(Boolean))]
    : [];

  if (!teams.length && next.team) {
    teams = [String(next.team).trim()].filter(Boolean);
  }

  next.assignees = assignees;
  next.teams = teams;
  next.assigneeId = assignees[0]?.assigneeId || null;
  next.assigneeName =
    assignees.map((a) => a.assigneeName).filter(Boolean).join(", ") ||
    teams.join(", ") ||
    "";

  delete next.team;
  return next;
};

const calcHours = (start, end, travelMinutes = 0) => {
  if (!start || !end) return 0;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const hours = ms / (1000 * 60 * 60);
  return Math.max(0, Math.round((hours + travelMinutes / 60) * 10) / 10);
};

const syncJobSchedulingStage = async (jobId, actor) => {
  const assignments = await ScheduleAssignment.find({ jobId });
  const job = await Job.findById(jobId);
  if (!job) return null;

  if (!job.workflowEvents) job.workflowEvents = {};
  if (!job.workflowEvents.scheduling) {
    job.workflowEvents.scheduling = {
      stageStatus: "Pending",
      isCompleted: false,
      subtasks: [],
    };
  }

  const scheduling = job.workflowEvents.scheduling;
  const totalPlannedHours = assignments.reduce(
    (sum, a) => sum + Number(a.totalHours || 0),
    0
  );
  const roles = [...new Set(assignments.map((a) => a.role).filter(Boolean))];
  const teamNames = [
    ...new Set(
      assignments.flatMap((a) => [
        ...(Array.isArray(a.teams) ? a.teams : []),
        ...(a.assigneeName ? [a.assigneeName] : []),
      ])
    ),
  ];

  scheduling.totalPlannedHours = totalPlannedHours;
  scheduling.assignedRoles = roles;
  scheduling.assignedTeams = teamNames;

  if (assignments.length) {
    const starts = assignments.map((a) => new Date(a.startTime).getTime());
    const ends = assignments.map((a) => new Date(a.endTime).getTime());
    scheduling.scheduledStart = new Date(Math.min(...starts));
    scheduling.scheduledEnd = new Date(Math.max(...ends));
  }

  const allCompleted =
    assignments.length > 0 &&
    assignments.every((a) => a.status === "Completed" || a.status === "Cancelled");
  const anyActive = assignments.some(
    (a) => a.status === "In Progress" || a.status === "Scheduled"
  );

  if (allCompleted && assignments.some((a) => a.status === "Completed")) {
    await markModuleCompleteForReview(jobId, "scheduling", actor || "Scheduling Module");
  } else if (anyActive) {
    scheduling.stageStatus = "In Progress";
    scheduling.isCompleted = false;
  }

  job.markModified("workflowEvents");
  await job.save();

  if (scheduling.isCompleted) {
    await notifyWorkflow({
      job,
      stageKey: "scheduling",
      message: `Scheduling completed for job ${job.jobId}`,
      actor,
    });
  }

  return job;
};

const sameDay = (a, b) => {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
};

const enrichAssignmentPayload = async (payload, existing = null) => {
  const job = await Job.findById(payload.jobId || existing?.jobId);
  const location = payload.location ?? existing?.location ?? job?.site ?? "";
  const latitude = payload.latitude ?? existing?.latitude ?? null;
  const longitude = payload.longitude ?? existing?.longitude ?? null;

  payload.location = location;
  payload.latitude = latitude;
  payload.longitude = longitude;
  payload.mapsUrl = buildMapsUrl(location, latitude, longitude);

  const startTime = payload.startTime || existing?.startTime;
  const assigneeId =
    payload.assigneeId ??
    existing?.assigneeId ??
    (Array.isArray(payload.assignees) ? payload.assignees[0]?.assigneeId : null) ??
    (Array.isArray(existing?.assignees) ? existing.assignees[0]?.assigneeId : null) ??
    null;

  let travelMinutes = payload.travelTimeMinutes;
  if (travelMinutes === undefined || travelMinutes === null) {
    travelMinutes = existing?.travelTimeMinutes ?? null;
  }

  if ((travelMinutes === null || travelMinutes === undefined) && assigneeId && startTime) {
    const dayStart = new Date(startTime);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(startTime);
    dayEnd.setHours(23, 59, 59, 999);

    const previous = await ScheduleAssignment.findOne({
      assigneeId,
      startTime: { $gte: dayStart, $lt: new Date(startTime) },
      _id: existing?._id ? { $ne: existing._id } : { $exists: true },
    }).sort({ startTime: -1 });

    if (previous) {
      travelMinutes = travelMinutesFromCoords(
        { lat: previous.latitude, lng: previous.longitude },
        { lat: latitude, lng: longitude }
      );
      if (!previous.latitude && previous.location !== location) {
        travelMinutes = DEFAULT_TRAVEL_MINUTES;
      }
    } else {
      travelMinutes = 0;
    }
  }

  payload.travelTimeMinutes = Number(travelMinutes || 0);
  payload.estimatedArrival = calcEta(startTime, payload.travelTimeMinutes);

  return { payload, job };
};

const notifyScheduleEta = async (job, assignment) => {
  if (!job?.customerId || !assignment?.estimatedArrival) return;

  const etaLabel = new Date(assignment.estimatedArrival).toLocaleString();
  await notifyEta({
    customerId: job.customerId,
    job,
    title: "Team ETA update",
    body: `Your team is scheduled to arrive around ${etaLabel} for ${assignment.title}.`,
    etaTime: assignment.estimatedArrival,
    metadata: {
      assignmentId: assignment._id,
      location: assignment.location,
      mapsUrl: assignment.mapsUrl,
    },
  });
};

exports.listByJob = async (req, res) => {
  try {
    const items = await ScheduleAssignment.find({ jobId: req.params.jobId }).sort({
      startTime: 1,
    });
    return res.json({ success: true, result: items });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.calendar = async (req, res) => {
  try {
    const { from, to, role, assigneeId, jobId } = req.query;
    const filter = {};

    if (jobId) filter.jobId = jobId;
    if (role) filter.role = role;
    if (assigneeId) filter.$or = [
      { assigneeId },
      { "assignees.assigneeId": assigneeId },
    ];

    if (from || to) {
      filter.startTime = {};
      if (from) filter.startTime.$gte = new Date(from);
      if (to) filter.startTime.$lte = new Date(to);
    }

    const items = await ScheduleAssignment.find(filter).sort({ startTime: 1 });
    return res.json({ success: true, result: items });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const payload = normalizeAssignmentPeople({ ...req.body });
    const actor = getActor(req);

    if (!payload.jobId || !payload.title || !payload.startTime || !payload.endTime) {
      return res.status(400).json({
        success: false,
        message: "jobId, title, startTime, and endTime are required",
      });
    }

    payload.totalHours = calcHours(
      payload.startTime,
      payload.endTime,
      payload.travelTimeMinutes
    );
    payload.createdBy = actor;
    payload.updatedBy = actor;

    const { payload: enriched, job } = await enrichAssignmentPayload(payload);
    const created = await ScheduleAssignment.create(enriched);
    await syncJobSchedulingStage(enriched.jobId, actor);
    await notifyScheduleEta(job, created);

    return res.status(201).json({
      success: true,
      result: created,
      message: "Schedule assignment created",
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const existing = await ScheduleAssignment.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: "Assignment not found" });
    }

    const payload = normalizeAssignmentPeople({ ...req.body, updatedBy: getActor(req) });

    const { payload: enriched, job } = await enrichAssignmentPayload(payload, existing);

    if (enriched.startTime || enriched.endTime) {
      enriched.totalHours = calcHours(
        enriched.startTime || existing.startTime,
        enriched.endTime || existing.endTime,
        enriched.travelTimeMinutes ?? existing.travelTimeMinutes
      );
    }

    const updated = await ScheduleAssignment.findByIdAndUpdate(
      req.params.id,
      enriched,
      { new: true, runValidators: true }
    );

    await syncJobSchedulingStage(updated.jobId, getActor(req));
    await notifyScheduleEta(job, updated);

    return res.json({
      success: true,
      result: updated,
      message: "Schedule assignment updated",
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const deleted = await ScheduleAssignment.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Assignment not found" });
    }

    await syncJobSchedulingStage(deleted.jobId, getActor(req));

    return res.json({
      success: true,
      result: deleted,
      message: "Schedule assignment deleted",
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.uploadFiles = async (req, res) => {
  try {
    const assignment = await ScheduleAssignment.findById(req.params.id);
    if (!assignment) {
      return res.status(404).json({ success: false, message: "Assignment not found" });
    }

    const files = req.files || [];
    const uploaded = files.map((f) => ({
      fileUrl: `/uploads/scheduling/${f.filename}`,
      originalName: f.originalname || f.filename,
    }));

    assignment.attachments = [...(assignment.attachments || []), ...uploaded];
    assignment.updatedBy = getActor(req);
    await assignment.save();

    return res.json({
      success: true,
      result: assignment,
      message: `${uploaded.length} file(s) uploaded`,
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

exports.summary = async (req, res) => {
  try {
    const items = await ScheduleAssignment.find({ jobId: req.params.jobId });
    const totalHours = items.reduce((sum, a) => sum + Number(a.totalHours || 0), 0);
    const travelMinutes = items.reduce(
      (sum, a) => sum + Number(a.travelTimeMinutes || 0),
      0
    );

    return res.json({
      success: true,
      result: {
        count: items.length,
        totalHours,
        travelMinutes,
        byStatus: items.reduce((acc, item) => {
          acc[item.status] = (acc[item.status] || 0) + 1;
          return acc;
        }, {}),
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
