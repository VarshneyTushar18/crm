const Leave = require("../models/appModels/Leave");
const Employee = require("../models/appModels/Employee");

const getActor = (req) =>
  req.user?.name || req.admin?.name || req.user?.email || "System";

exports.list = async (req, res) => {
  try {
    const filter = { removed: false };
    if (req.query.employeeId) filter.employeeId = req.query.employeeId;
    if (req.query.status) filter.status = req.query.status;

    const items = await Leave.find(filter)
      .populate("employeeId", "name employeeId email department")
      .sort({ createdAt: -1 });

    return res.json({ success: true, result: items });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.create = async (req, res) => {
  try {
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
    const item = await Leave.findByIdAndUpdate(
      req.params.id,
      {
        status: "Approved",
        reviewedBy: getActor(req),
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
    const item = await Leave.findByIdAndUpdate(
      req.params.id,
      {
        status: "Rejected",
        reviewedBy: getActor(req),
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
