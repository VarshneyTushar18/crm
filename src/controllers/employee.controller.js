const mongoose = require("mongoose");
const Employee = mongoose.model("Employee");

function formatDateToDDMMYYYY(date = new Date()) {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

async function generateEmployeeId() {
  const lastEmployee = await Employee.findOne({})
    .sort({ createdAt: -1, _id: -1 })
    .select("employeeId");

  if (!lastEmployee || !lastEmployee.employeeId) {
    return "EMP123";
  }

  const match = lastEmployee.employeeId.match(/^EMP(\d+)$/);
  if (!match) {
    return "EMP123";
  }

  const nextNumber = Number(match[1]) + 1;
  return `EMP${nextNumber}`;
}

const create = async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      designation,
      department,
      joiningDate,
      status,
      address,
    } = req.body;

    if (!name || !email || !phone || !designation || !department || !joiningDate) {
      return res.status(400).json({
        success: false,
        message:
          "name, email, phone, designation, department and joiningDate are required",
      });
    }

    const existingEmail = await Employee.findOne({
      email: String(email).toLowerCase().trim(),
    });

    if (existingEmail) {
      return res.status(400).json({
        success: false,
        message: "Employee with this email already exists",
      });
    }

    const employeeId = await generateEmployeeId();

    let resignationDate = "";
    if (status === "Inactive") {
      resignationDate = formatDateToDDMMYYYY(new Date());
    }

    const employee = await Employee.create({
      employeeId,
      name: String(name).trim(),
      email: String(email).toLowerCase().trim(),
      phone: String(phone).trim(),
      designation: String(designation).trim(),
      department: String(department).trim(),
      joiningDate: String(joiningDate).trim(),
      resignationDate,
      status: status === "Inactive" ? "Inactive" : "Active",
      address: address ? String(address).trim() : "",
    });

    return res.status(201).json({
      success: true,
      message: "Employee created successfully",
      result: employee,
    });
  } catch (error) {
    console.error("Employee create error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create employee",
      error: error.message,
    });
  }
};

const list = async (req, res) => {
  try {
    const employees = await Employee.find({})
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      message: "Employees fetched successfully",
      result: employees,
    });
  } catch (error) {
    console.error("Employee list error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch employees",
      error: error.message,
    });
  }
};

const read = async (req, res) => {
  try {
    const { id } = req.params;

    const employee = await Employee.findById(id);

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Employee fetched successfully",
      result: employee,
    });
  } catch (error) {
    console.error("Employee read error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch employee",
      error: error.message,
    });
  }
};

const update = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      email,
      phone,
      designation,
      department,
      joiningDate,
      status,
      address,
    } = req.body;

    const employee = await Employee.findById(id);

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    if (email && String(email).toLowerCase().trim() !== employee.email) {
      const existingEmail = await Employee.findOne({
        email: String(email).toLowerCase().trim(),
        _id: { $ne: id },
      });

      if (existingEmail) {
        return res.status(400).json({
          success: false,
          message: "Another employee with this email already exists",
        });
      }
    }

    employee.name = name ? String(name).trim() : employee.name;
    employee.email = email
      ? String(email).toLowerCase().trim()
      : employee.email;
    employee.phone = phone ? String(phone).trim() : employee.phone;
    employee.designation = designation
      ? String(designation).trim()
      : employee.designation;
    employee.department = department
      ? String(department).trim()
      : employee.department;
    employee.joiningDate = joiningDate
      ? String(joiningDate).trim()
      : employee.joiningDate;
    employee.address = address !== undefined ? String(address).trim() : employee.address;

    if (status === "Inactive") {
      employee.status = "Inactive";
      employee.resignationDate = formatDateToDDMMYYYY(new Date());
    } else if (status === "Active") {
      employee.status = "Active";
      employee.resignationDate = "";
    }

    await employee.save();

    return res.status(200).json({
      success: true,
      message: "Employee updated successfully",
      result: employee,
    });
  } catch (error) {
    console.error("Employee update error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update employee",
      error: error.message,
    });
  }
};

const remove = async (req, res) => {
  try {
    const { id } = req.params;

    const employee = await Employee.findByIdAndDelete(id);

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Employee deleted successfully",
      result: employee,
    });
  } catch (error) {
    console.error("Employee delete error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete employee",
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