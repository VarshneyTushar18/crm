const mongoose = require("mongoose");
const WorkerTask = require("../models/appModels/WorkerTask");
const Job = require("../models/appModels/Job");
const User = require("../models/appModels/User");
const Employee = require("../models/appModels/Employee");
const { persistFiles } = require("../utils/persistUpload");

const getActor = (req) => ({
  id: req.user?._id || req.admin?._id || null,
  name: req.user?.name || req.admin?.name || req.user?.email || "User",
  email: String(req.user?.email || "").trim().toLowerCase(),
  role: String(req.user?.role || req.admin?.role || "admin").trim(),
  workerId: String(req.user?.workerId || "").trim(),
});

const isSupervisor = (role) =>
  ["admin", "siteEngineer"].includes(String(role || "").trim());

const parseNumberOrNull = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const escapeRegex = (value) =>
  String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Resolve assignee to worker User + Employee so tasks sync to My Tasks.
 * Accepts assigneeId (User), assigneeWorkerId (employeeId / workerId), assigneeName, or email.
 */
const resolveAssignee = async ({
  assigneeId,
  assigneeWorkerId,
  assigneeName,
  assigneeEmail,
} = {}) => {
  const id = String(assigneeId || "").trim();
  const workerKey = String(assigneeWorkerId || "").trim();
  const name = String(assigneeName || "").trim();
  const email = String(assigneeEmail || "").trim().toLowerCase();

  let user = null;

  if (id && mongoose.Types.ObjectId.isValid(id)) {
    user = await User.findOne({ _id: id, role: "worker" });
  }

  if (!user && workerKey) {
    user = await User.findOne({
      role: "worker",
      workerId: new RegExp(`^${escapeRegex(workerKey)}$`, "i"),
    });
  }

  if (!user && email) {
    user = await User.findOne({ role: "worker", email });
  }

  let employee = null;
  if (workerKey) {
    employee = await Employee.findOne({
      employeeId: new RegExp(`^${escapeRegex(workerKey)}$`, "i"),
    });
  }
  if (!employee && email) {
    employee = await Employee.findOne({ email });
  }
  if (!employee && user?.workerId) {
    employee = await Employee.findOne({
      employeeId: new RegExp(`^${escapeRegex(user.workerId)}$`, "i"),
    });
  }
  if (!employee && user?.email) {
    employee = await Employee.findOne({
      email: String(user.email).toLowerCase().trim(),
    });
  }

  // Prefer login user linked by employee email if only employee matched
  if (!user && employee?.email) {
    user = await User.findOne({
      role: "worker",
      email: String(employee.email).toLowerCase().trim(),
    });
  }
  if (!user && employee?.employeeId) {
    user = await User.findOne({
      role: "worker",
      workerId: new RegExp(`^${escapeRegex(employee.employeeId)}$`, "i"),
    });
  }

  // Last resort: unique name match among workers
  if (!user && name) {
    const matches = await User.find({
      role: "worker",
      name: new RegExp(`^${escapeRegex(name)}$`, "i"),
    }).limit(2);
    if (matches.length === 1) user = matches[0];
  }

  const resolvedWorkerId =
    String(user?.workerId || "").trim() ||
    String(employee?.employeeId || "").trim() ||
    workerKey;

  const resolvedName =
    String(user?.name || "").trim() ||
    String(employee?.name || "").trim() ||
    name;

  return {
    assigneeId: user?._id || (id && mongoose.Types.ObjectId.isValid(id) ? id : null),
    assigneeWorkerId: resolvedWorkerId,
    assigneeName: resolvedName,
    resolvedUser: user,
  };
};

const ensureAssigneeMatch = (task, actor) => {
  if (actor.role !== "worker") return true;
  if (task.assigneeId && String(task.assigneeId) === String(actor.id)) return true;
  if (
    task.assigneeWorkerId &&
    actor.workerId &&
    String(task.assigneeWorkerId).toLowerCase() === String(actor.workerId).toLowerCase()
  ) {
    return true;
  }
  if (
    task.assigneeName &&
    actor.name &&
    String(task.assigneeName).toLowerCase() === String(actor.name).toLowerCase()
  ) {
    return true;
  }
  return false;
};

exports.listMine = async (req, res) => {
  try {
    const actor = getActor(req);
    if (actor.role !== "worker") {
      return res.status(403).json({ success: false, message: "Workers only" });
    }

    const or = [];
    if (actor.id) or.push({ assigneeId: actor.id });
    if (actor.workerId) {
      or.push({
        assigneeWorkerId: new RegExp(`^${escapeRegex(actor.workerId)}$`, "i"),
      });
    }
    if (actor.email) {
      or.push({
        assigneeWorkerId: new RegExp(`^${escapeRegex(actor.email)}$`, "i"),
      });
    }
    if (actor.name) {
      or.push({
        assigneeName: new RegExp(`^${escapeRegex(actor.name)}$`, "i"),
      });
    }

    // Bridge EMP… employeeId (admin assign) ↔ W-… worker login id
    const employeeOr = [];
    if (actor.email) employeeOr.push({ email: actor.email });
    if (actor.workerId) {
      employeeOr.push({
        employeeId: new RegExp(`^${escapeRegex(actor.workerId)}$`, "i"),
      });
    }
    if (employeeOr.length) {
      const employee = await Employee.findOne({ $or: employeeOr }).select("employeeId name");
      if (employee?.employeeId) {
        or.push({
          assigneeWorkerId: new RegExp(`^${escapeRegex(employee.employeeId)}$`, "i"),
        });
      }
      if (employee?.name && (!actor.name || employee.name !== actor.name)) {
        or.push({
          assigneeName: new RegExp(`^${escapeRegex(employee.name)}$`, "i"),
        });
      }
    }

    if (!or.length) {
      return res.json({ success: true, result: [] });
    }

    const status = String(req.query.status || "").trim();
    const filter = { $or: or };
    if (status) filter.status = status;

    const items = await WorkerTask.find(filter)
      .populate("jobId", "jobId customer site stage status")
      .sort({ priority: 1, createdAt: -1 });

    return res.json({ success: true, result: items });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.list = async (req, res) => {
  try {
    const actor = getActor(req);
    if (!isSupervisor(actor.role)) {
      return res.status(403).json({ success: false, message: "Supervisors only" });
    }

    const filter = {};
    if (req.query.jobId) filter.jobId = req.query.jobId;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.reviewStatus) filter.reviewStatus = req.query.reviewStatus;
    if (req.query.assigneeWorkerId) {
      filter.assigneeWorkerId = String(req.query.assigneeWorkerId).trim();
    }

    const items = await WorkerTask.find(filter)
      .populate("jobId", "jobId customer site stage status")
      .sort({ priority: 1, updatedAt: -1 });

    return res.json({ success: true, result: items });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.reviewQueue = async (req, res) => {
  try {
    const actor = getActor(req);
    if (!isSupervisor(actor.role)) {
      return res.status(403).json({ success: false, message: "Supervisors only" });
    }

    const items = await WorkerTask.find({
      reviewStatus: "Pending Review",
    })
      .populate("jobId", "jobId customer site stage status")
      .sort({ updatedAt: -1 });

    return res.json({ success: true, result: items });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const actor = getActor(req);
    if (!isSupervisor(actor.role)) {
      return res.status(403).json({ success: false, message: "Supervisors only" });
    }

    const {
      jobId,
      title,
      description,
      siteZone,
      location,
      priority,
      expectedDurationMinutes,
      assigneeId,
      assigneeWorkerId,
      assigneeName,
      assigneeEmail,
      checklist,
    } = req.body || {};

    if (!String(title || "").trim()) {
      return res.status(400).json({ success: false, message: "title is required" });
    }

    if (
      !String(assigneeId || "").trim() &&
      !String(assigneeWorkerId || "").trim() &&
      !String(assigneeName || "").trim() &&
      !String(assigneeEmail || "").trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Select an assignee so the worker can see this task in My Tasks",
      });
    }

    if (jobId) {
      if (!mongoose.Types.ObjectId.isValid(jobId)) {
        return res.status(400).json({ success: false, message: "Invalid jobId" });
      }
      const job = await Job.findById(jobId).select("_id");
      if (!job) {
        return res.status(404).json({ success: false, message: "Job not found" });
      }
    }

    const resolved = await resolveAssignee({
      assigneeId,
      assigneeWorkerId,
      assigneeName,
      assigneeEmail,
    });

    if (!resolved.assigneeId && !resolved.assigneeWorkerId) {
      return res.status(400).json({
        success: false,
        message:
          "Could not match assignee to a worker login. Pick an employee with a worker account (employee ID / login).",
      });
    }

    const checklistItems = Array.isArray(checklist)
      ? checklist
          .map((item) => ({
            label: String(item?.label || item || "").trim(),
            done: Boolean(item?.done),
          }))
          .filter((item) => item.label)
      : [];

    const created = await WorkerTask.create({
      jobId: jobId || null,
      title: String(title).trim(),
      description: String(description || "").trim(),
      siteZone: String(siteZone || "").trim(),
      location: String(location || "").trim(),
      priority: Math.min(5, Math.max(1, Number(priority || 3))),
      expectedDurationMinutes: Math.max(0, Number(expectedDurationMinutes || 60)),
      assigneeId: resolved.assigneeId || null,
      assigneeWorkerId: resolved.assigneeWorkerId,
      assigneeName: resolved.assigneeName,
      assignedById: actor.id,
      assignedByName: actor.name,
      checklist: checklistItems,
      status: "Assigned",
      reviewStatus: "None",
    });

    return res.status(201).json({
      success: true,
      result: created,
      message: "Task assigned",
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

exports.start = async (req, res) => {
  try {
    const actor = getActor(req);
    const task = await WorkerTask.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ success: false, message: "Task not found" });
    }

    if (actor.role === "worker" && !ensureAssigneeMatch(task, actor)) {
      return res.status(403).json({ success: false, message: "Not assigned to this task" });
    }

    if (!["Assigned", "Rejected"].includes(task.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot start task from status ${task.status}`,
      });
    }

    task.status = "In Progress";
    task.startedAt = new Date();
    task.startLatitude = parseNumberOrNull(req.body?.latitude);
    task.startLongitude = parseNumberOrNull(req.body?.longitude);
    task.reviewStatus = "None";
    task.reviewRemarks = "";
    await task.save();

    return res.json({
      success: true,
      result: task,
      message: "Task started",
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

exports.complete = async (req, res) => {
  try {
    const actor = getActor(req);
    const task = await WorkerTask.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ success: false, message: "Task not found" });
    }

    if (actor.role === "worker" && !ensureAssigneeMatch(task, actor)) {
      return res.status(403).json({ success: false, message: "Not assigned to this task" });
    }

    if (!["In Progress", "Assigned", "Rejected"].includes(task.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot complete task from status ${task.status}`,
      });
    }

    if (Array.isArray(req.body?.checklist)) {
      task.checklist = req.body.checklist
        .map((item) => ({
          label: String(item?.label || "").trim(),
          done: Boolean(item?.done),
        }))
        .filter((item) => item.label);
    }

    task.remarks = String(req.body?.remarks || task.remarks || "").trim();
    task.completeLatitude = parseNumberOrNull(req.body?.latitude);
    task.completeLongitude = parseNumberOrNull(req.body?.longitude);
    task.completedAt = new Date();
    task.status = "Submitted";
    task.reviewStatus = "Pending Review";

    if (task.startedAt && task.completedAt) {
      const gapMs = task.completedAt.getTime() - new Date(task.startedAt).getTime();
      const expectedMs = Number(task.expectedDurationMinutes || 0) * 60 * 1000;
      if (expectedMs > 0 && gapMs > expectedMs * 1.5) {
        task.idleFlagged = true;
      }
    }

    await task.save();

    return res.json({
      success: true,
      result: task,
      message: "Task submitted for review",
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

exports.uploadProof = async (req, res) => {
  try {
    const actor = getActor(req);
    const task = await WorkerTask.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ success: false, message: "Task not found" });
    }

    if (actor.role === "worker" && !ensureAssigneeMatch(task, actor)) {
      return res.status(403).json({ success: false, message: "Not assigned to this task" });
    }

    const files = req.files || [];
    if (!files.length) {
      return res.status(400).json({ success: false, message: "No files uploaded" });
    }

    const persisted = await persistFiles(files, "worker-tasks");
    const proofs = persisted.map((file) => ({
      fileUrl: file.url,
      originalName: file.originalName,
      kind: String(file.originalName || "").match(/\.(mp4|mov|webm)$/i)
        ? "video"
        : String(file.originalName || "").match(/\.(pdf|doc|docx)$/i)
          ? "document"
          : "photo",
      uploadedAt: new Date(),
    }));

    task.proofs = [...(task.proofs || []), ...proofs];
    await task.save();

    return res.json({
      success: true,
      result: task,
      message: `${proofs.length} proof file(s) uploaded`,
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

exports.addLocationPing = async (req, res) => {
  try {
    const actor = getActor(req);
    const task = await WorkerTask.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ success: false, message: "Task not found" });
    }

    if (actor.role === "worker" && !ensureAssigneeMatch(task, actor)) {
      return res.status(403).json({ success: false, message: "Not assigned to this task" });
    }

    const latitude = parseNumberOrNull(req.body?.latitude);
    const longitude = parseNumberOrNull(req.body?.longitude);
    if (latitude === null || longitude === null) {
      return res.status(400).json({
        success: false,
        message: "latitude and longitude are required",
      });
    }

    task.locationTrail = [
      ...(task.locationTrail || []),
      {
        latitude,
        longitude,
        capturedAt: new Date(),
        note: String(req.body?.note || "").trim(),
      },
    ];
    await task.save();

    return res.json({
      success: true,
      result: task,
      message: "Location ping saved",
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

exports.review = async (req, res) => {
  try {
    const actor = getActor(req);
    if (!isSupervisor(actor.role)) {
      return res.status(403).json({ success: false, message: "Supervisors only" });
    }

    const task = await WorkerTask.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ success: false, message: "Task not found" });
    }

    const decision = String(req.body?.decision || "").trim().toLowerCase();
    const remarks = String(req.body?.remarks || "").trim();

    if (!["approve", "reject"].includes(decision)) {
      return res.status(400).json({
        success: false,
        message: "decision must be approve or reject",
      });
    }

    if (decision === "reject" && !remarks) {
      return res.status(400).json({
        success: false,
        message: "remarks are required when rejecting a task",
      });
    }

    if (decision === "approve") {
      task.status = "Completed";
      task.reviewStatus = "Approved";
    } else {
      task.status = "Rejected";
      task.reviewStatus = "Rejected";
    }

    task.reviewRemarks = remarks;
    task.reviewedByName = actor.name;
    task.reviewedAt = new Date();
    await task.save();

    return res.json({
      success: true,
      result: task,
      message: decision === "approve" ? "Task approved" : "Task rejected",
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const actor = getActor(req);
    if (!isSupervisor(actor.role)) {
      return res.status(403).json({ success: false, message: "Supervisors only" });
    }

    const deleted = await WorkerTask.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Task not found" });
    }

    return res.json({
      success: true,
      result: deleted,
      message: "Task deleted",
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
