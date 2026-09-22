const Leave = require("../models/appModels/Leave");
const Employee = require("../models/appModels/Employee");
const { notifyAdmin } = require("../services/notificationService");

const getActor = (req) => ({
  id: req.user?._id || req.admin?._id || null,
  name: req.user?.name || req.admin?.name || req.user?.email || "System",
  email: String(req.user?.email || "").trim().toLowerCase(),
  workerId: String(req.user?.workerId || "").trim(),
  role: String(req.user?.role || req.admin?.role || "admin").trim(),
});

const escapeRegex = (value) =>
  String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const isLeaveManager = (role) =>
  ["admin", "siteEngineer"].includes(String(role || "").trim());

const resolveEmployeeForWorker = async (actor) => {
  const or = [];
  if (actor.email) or.push({ email: actor.email });
  if (actor.workerId) {
    or.push({
      employeeId: new RegExp(`^${escapeRegex(actor.workerId)}$`, "i"),
    });
  }
  if (!or.length) return null;
  return Employee.findOne({ $or: or });
};

exports.list = async (req, res) => {
  try {
    const actor = getActor(req);
    const filter = { removed: false };

    if (actor.role === "worker") {
      const employee = await resolveEmployeeForWorker(actor);
      if (!employee) {
        return res.json({ success: true, result: [] });
      }
      filter.employeeId = employee._id;
    } else {
      if (req.query.employeeId) filter.employeeId = req.query.employeeId;
    }

    if (req.query.status) filter.status = req.query.status;

    const items = await Leave.find(filter)
      .populate("employeeId", "name employeeId email department")
      .sort({ createdAt: -1 });

    return res.json({ success: true, result: items });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.listMine = async (req, res) => {
  try {
    const actor = getActor(req);
    if (actor.role !== "worker") {
      return res.status(403).json({ success: false, message: "Workers only" });
    }

    const employee = await resolveEmployeeForWorker(actor);
    if (!employee) {
      return res.json({ success: true, result: [] });
    }

    const items = await Leave.find({ removed: false, employeeId: employee._id })
      .populate("employeeId", "name employeeId email department")
      .sort({ createdAt: -1 });

    return res.json({ success: true, result: items });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.apply = async (req, res) => {
  try {
    const actor = getActor(req);
    if (actor.role !== "worker") {
      return res.status(403).json({ success: false, message: "Workers only" });
    }

    const employee = await resolveEmployeeForWorker(actor);
    if (!employee) {
      return res.status(400).json({
        success: false,
        message:
          "No employee profile linked to your account. Contact HR to set up your employee record.",
      });
    }

    const { leaveType, startDate, endDate, days, reason } = req.body || {};
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "startDate and endDate are required",
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end < start) {
      return res.status(400).json({
        success: false,
        message: "End date must be on or after start date",
      });
    }

    const item = await Leave.create({
      employeeId: employee._id,
      employeeName: employee.name,
      leaveType: leaveType || "Annual",
      startDate: start,
      endDate: end,
      days: days || 1,
      reason: reason || "",
      status: "Pending",
    });

    try {
      const fromLabel = start.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
      const toLabel = end.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
      await notifyAdmin({
        type: "leave_request",
        title: "New leave request",
        body: `${employee.name || actor.name} requested ${leaveType || "Annual"} leave (${fromLabel} – ${toLabel}).`,
        link: "/admin/leave",
        metadata: { leaveId: item._id, employeeId: employee._id },
      });
    } catch {
      // leave saved; notification is best-effort
    }

    return res.status(201).json({ success: true, result: item });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const actor = getActor(req);
    if (actor.role === "worker") {
      return res.status(403).json({
        success: false,
        message: "Use leave apply from the worker portal",
      });
    }
    if (!isLeaveManager(actor.role)) {
      return res.status(403).json({ success: false, message: "Not allowed" });
    }

    const { employeeId, leaveType, startDate, endDate, days, reason } = req.body || {};
    if (!employeeId || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "employeeId, startDate, and endDate are required",
      });
    }

    const employee = await Employee.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }

    const item = await Leave.create({
      employeeId,
      employeeName: employee.name,
      leaveType: leaveType || "Annual",
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      days: days || 1,
      reason: reason || "",
      status: "Pending",
    });

    return res.status(201).json({ success: true, result: item });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const actor = getActor(req);
    if (!isLeaveManager(actor.role)) {
      return res.status(403).json({ success: false, message: "Not allowed" });
    }

    const item = await Leave.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!item) {
      return res.status(404).json({ success: false, message: "Leave not found" });
    }
    return res.json({ success: true, result: item });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

exports.approve = async (req, res) => {
  try {
    const actor = getActor(req);
    if (!isLeaveManager(actor.role)) {
      return res.status(403).json({ success: false, message: "Not allowed" });
    }

    const item = await Leave.findByIdAndUpdate(
      req.params.id,
      {
        status: "Approved",
        reviewedBy: actor.name,
        reviewedAt: new Date(),
      },
      { new: true }
    );
    if (!item) {
      return res.status(404).json({ success: false, message: "Leave not found" });
    }
    return res.json({ success: true, result: item, message: "Leave approved" });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

exports.reject = async (req, res) => {
  try {
    const actor = getActor(req);
    if (!isLeaveManager(actor.role)) {
      return res.status(403).json({ success: false, message: "Not allowed" });
    }

    const item = await Leave.findByIdAndUpdate(
      req.params.id,
      {
        status: "Rejected",
        reviewedBy: actor.name,
        reviewedAt: new Date(),
      },
      { new: true }
    );
    if (!item) {
      return res.status(404).json({ success: false, message: "Leave not found" });
    }
    return res.json({ success: true, result: item, message: "Leave rejected" });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

exports.delete = async (req, res) => {
  try {
    const actor = getActor(req);
    if (!isLeaveManager(actor.role)) {
      return res.status(403).json({ success: false, message: "Not allowed" });
    }

    const item = await Leave.findByIdAndUpdate(
      req.params.id,
      { removed: true },
      { new: true }
    );
    if (!item) {
      return res.status(404).json({ success: false, message: "Leave not found" });
    }
    return res.json({ success: true, message: "Leave deleted" });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
