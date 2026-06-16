const mongoose = require("mongoose");
const Attendance = mongoose.model("Attendance");
const Employee = mongoose.model("Employee");

function getStatusFromHours(hours) {
  if (Number(hours) >= 8) return "Full Day";
  if (Number(hours) > 0) return "Half Day";
  return "Absent";
}

function parseTimeToMinutes(timeStr) {
  if (!timeStr || typeof timeStr !== "string") return null;

  const parts = timeStr.split(":");
  if (parts.length !== 2) return null;

  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);

  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  return hours * 60 + minutes;
}

function calculateHours(checkin, checkout) {
  const checkinMinutes = parseTimeToMinutes(checkin);
  const checkoutMinutes = parseTimeToMinutes(checkout);

  if (checkinMinutes === null || checkoutMinutes === null) return null;
  if (checkoutMinutes < checkinMinutes) return null;

  return Number(((checkoutMinutes - checkinMinutes) / 60).toFixed(2));
}

const create = async (req, res) => {
  try {
    const {
      workerName,
      workerEmail,
      employeeId,
      designation,
      department,
      date,
      checkin,
      checkout,
      hours,
      status,
      source,
    } = req.body;

    if (
      !workerName ||
      !workerEmail ||
      !employeeId ||
      !designation ||
      !department ||
      !date ||
      !checkin ||
      !checkout
    ) {
      return res.status(400).json({
        success: false,
        message:
          "workerName, workerEmail, employeeId, designation, department, date, checkin and checkout are required",
      });
    }

    const employee = await Employee.findOne({
      email: String(workerEmail).toLowerCase().trim(),
    });

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    if (employee.status !== "Active") {
      return res.status(400).json({
        success: false,
        message: "Inactive employee attendance cannot be added",
      });
    }

    const calculatedHours =
      hours !== undefined && hours !== null
        ? Number(hours)
        : calculateHours(checkin, checkout);

    if (calculatedHours === null || Number.isNaN(calculatedHours)) {
      return res.status(400).json({
        success: false,
        message: "Invalid check-in/check-out time",
      });
    }

    const finalStatus = status || getStatusFromHours(calculatedHours);

    const existingAttendance = await Attendance.findOne({
      workerEmail: String(workerEmail).toLowerCase().trim(),
      date: String(date).trim(),
    });

    if (existingAttendance) {
      return res.status(400).json({
        success: false,
        message: "Attendance already exists for this employee on this date",
      });
    }

    const attendance = await Attendance.create({
      workerName: String(workerName).trim(),
      workerEmail: String(workerEmail).toLowerCase().trim(),
      employeeId: String(employeeId).trim(),
      designation: String(designation).trim(),
      department: String(department).trim(),
      date: String(date).trim(),
      checkin: String(checkin).trim(),
      checkout: String(checkout).trim(),
      hours: calculatedHours,
      status: finalStatus,
      source: source || "Manual",
    });

    return res.status(201).json({
      success: true,
      message: "Attendance added successfully",
      result: attendance,
    });
  } catch (error) {
    console.error("Attendance create error:", error);

    if (error && error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Attendance already exists for this employee on this date",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to add attendance",
      error: error.message,
    });
  }
};

const list = async (req, res) => {
  try {
    const attendance = await Attendance.find({})
      .sort({ createdAt: -1, _id: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      message: "Attendance fetched successfully",
      result: attendance,
    });
  } catch (error) {
    console.error("Attendance list error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch attendance",
      error: error.message,
    });
  }
};

const read = async (req, res) => {
  try {
    const { id } = req.params;

    const attendance = await Attendance.findById(id);

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: "Attendance record not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Attendance fetched successfully",
      result: attendance,
    });
  } catch (error) {
    console.error("Attendance read error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch attendance record",
      error: error.message,
    });
  }
};

const update = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      workerName,
      workerEmail,
      employeeId,
      designation,
      department,
      date,
      checkin,
      checkout,
      hours,
      status,
      source,
    } = req.body;

    const attendance = await Attendance.findById(id);

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: "Attendance record not found",
      });
    }

    const finalWorkerEmail = workerEmail
      ? String(workerEmail).toLowerCase().trim()
      : attendance.workerEmail;

    const employee = await Employee.findOne({
      email: finalWorkerEmail,
    });

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    if (employee.status !== "Active") {
      return res.status(400).json({
        success: false,
        message: "Inactive employee attendance cannot be updated",
      });
    }

    const finalCheckin = checkin ? String(checkin).trim() : attendance.checkin;
    const finalCheckout = checkout
      ? String(checkout).trim()
      : attendance.checkout;

    const calculatedHours =
      hours !== undefined && hours !== null
        ? Number(hours)
        : calculateHours(finalCheckin, finalCheckout);

    if (calculatedHours === null || Number.isNaN(calculatedHours)) {
      return res.status(400).json({
        success: false,
        message: "Invalid check-in/check-out time",
      });
    }

    const finalDate = date ? String(date).trim() : attendance.date;
    const finalStatus = status || getStatusFromHours(calculatedHours);

    const duplicate = await Attendance.findOne({
      _id: { $ne: id },
      workerEmail: finalWorkerEmail,
      date: finalDate,
    });

    if (duplicate) {
      return res.status(400).json({
        success: false,
        message: "Attendance already exists for this employee on this date",
      });
    }

    attendance.workerName = workerName
      ? String(workerName).trim()
      : attendance.workerName;
    attendance.workerEmail = finalWorkerEmail;
    attendance.employeeId = employeeId
      ? String(employeeId).trim()
      : attendance.employeeId;
    attendance.designation = designation
      ? String(designation).trim()
      : attendance.designation;
    attendance.department = department
      ? String(department).trim()
      : attendance.department;
    attendance.date = finalDate;
    attendance.checkin = finalCheckin;
    attendance.checkout = finalCheckout;
    attendance.hours = calculatedHours;
    attendance.status = finalStatus;
    attendance.source = source || attendance.source || "Manual";

    await attendance.save();

    return res.status(200).json({
      success: true,
      message: "Attendance updated successfully",
      result: attendance,
    });
  } catch (error) {
    console.error("Attendance update error:", error);

    if (error && error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Attendance already exists for this employee on this date",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to update attendance",
      error: error.message,
    });
  }
};

const remove = async (req, res) => {
  try {
    const { id } = req.params;

    const attendance = await Attendance.findByIdAndDelete(id);

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: "Attendance record not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Attendance deleted successfully",
      result: attendance,
    });
  } catch (error) {
    console.error("Attendance delete error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete attendance",
      error: error.message,
    });
  }
};

module.exports = {
  create,
  list,
  read,
  update,
  delete: remove,
};