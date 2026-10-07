const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");
const Employee = mongoose.model("Employee");
const User = mongoose.model("User");

const appointmentLetterDirectory = path.resolve(
  __dirname,
  "../public/download/employee"
);

const brandLogoPath = path.resolve(
  __dirname,
  "../../../frontend/src/style/images/bright-balustrading-logo.png"
);

async function loadCompanyLetterhead() {
  const company = {
    name: "",
    address: "",
    phone: "",
    email: "",
    website: "",
  };

  try {
    const { loadSettings } = require("@/middlewares/settings");
    const settings = await loadSettings();
    company.name = String(settings.company_name || "").trim();
    company.address = settings.company_address || "";
    company.phone = settings.company_phone || "";
    company.email = settings.company_email || "";
    company.website = settings.company_website || "";
  } catch {
    // Keep the default letterhead when settings are unavailable.
  }

  return company;
}

const generateAppointmentLetter = async (employee) => {
  await fs.promises.mkdir(appointmentLetterDirectory, { recursive: true });

  const fileName = `employee-${employee._id}.pdf`;
  const targetLocation = path.join(appointmentLetterDirectory, fileName);
  const company = await loadCompanyLetterhead();
  const employeeName = employee.name || "-";
  const jobTitle = employee.designation || "-";
  const employeeAddress = employee.address || "-";
  const joiningDate = employee.joiningDate || "-";
  const workLocation = company.address || "the assigned work location";
  const letterDate = formatDateToDDMMYYYY(new Date()).replace(/-/g, "/");
  const companyDisplayName = company.name || "the Company";

  await new Promise((resolve, reject) => {
    const document = new PDFDocument({ size: "A4", margin: 58 });
    const output = fs.createWriteStream(targetLocation);

    output.on("error", reject);
    output.on("finish", resolve);
    document.on("error", reject);

    document.pipe(output);
    document.fillColor("#000000").strokeColor("#000000");

    const borderInset = 28;
    document
      .lineWidth(1)
      .rect(
        borderInset,
        borderInset,
        document.page.width - borderInset * 2,
        document.page.height - borderInset * 2
      )
      .stroke();

    const contentTop = borderInset + 16;
    const contentLeft = document.page.margins.left;
    const contentWidth =
      document.page.width - document.page.margins.left - document.page.margins.right;

    if (fs.existsSync(brandLogoPath)) {
      const logoWidth = 160;
      const logoHeight = 44;
      
      document.image(brandLogoPath, contentLeft, contentTop, {
        fit: [logoWidth, logoHeight],
      });
      document.y = contentTop + logoHeight + 32;
    } else {
      document.y = contentTop;
    }

    document.x = contentLeft;
    document
      .font("Helvetica-Bold")
      .fontSize(16)
      .text("Appointment Letter", contentLeft, document.y, {
        width: contentWidth,
        align: "center",
      });
    document.moveDown(1.4);

    document.font("Helvetica").fontSize(11);
    if (company.address) document.text(company.address);
    if (company.phone) document.text(`${company.phone} |`);

    const contactLine = [company.email, company.website].filter(Boolean).join(" | ");
    if (contactLine) {
      document.moveDown(0.6);
      document.text(contactLine);
    }

    document.moveDown(1);
    document.text(`Date: ${letterDate}`);
    document.moveDown(1);
    document.text("To,");
    document.text(employeeName);
    document.text(employeeAddress);
    document.moveDown(1);
    document.text(`Subject: Appointment as ${jobTitle}`);
    document.moveDown(1);
    document.text(`Dear ${employeeName},`);
    document.moveDown(0.8);
    document.text(
      `We are pleased to appoint you as a ${jobTitle} at ${companyDisplayName}, effective ${joiningDate}, permanently. You will report to your reporting manager.`
    );
    document.moveDown(0.8);
    document.text(
      `Your initial place of work will be ${workLocation}, although transfers may occur as needed to meet business requirements. Working hours will follow company policy (e.g. 9:30 AM to 6:30 PM, Monday to Friday).`
    );
    document.moveDown(0.6);
    document.text(
      "•  Your annual gross salary will be as agreed, subject to applicable taxes (details in the annexure).",
      { indent: 12 }
    );
    document.moveDown(0.25);
    document.text(
      "•  You will be on a 6-month probation period, after which performance will be reviewed.",
      { indent: 12 }
    );
    document.moveDown(0.25);
    document.text(
      "•  You are entitled to paid leave and other benefits as outlined in company policy.",
      { indent: 12 }
    );
    document.moveDown(0.8);
    document.text(
      "This appointment may be terminated by either party with written notice as per company policy, or payment instead of salary."
    );
    document.moveDown(0.8);
    document.text(
      "Kindly sign and return a copy of this letter as confirmation of your acceptance. We welcome you aboard and wish you success in your new role."
    );
    document.moveDown(1);
    document.text("Warm regards,");
    document.moveDown(1.4);
    document.text("Authorised Signatory");
    document.end();
  });

  return { fileName, targetLocation };
};

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

const DEFAULT_WORKER_PASSWORD = "Worker@123";

async function ensureWorkerLoginForEmployee(employee, newPassword) {
  const normalizedEmail = String(employee.email || "").toLowerCase().trim();
  const normalizedEmployeeId = String(employee.employeeId || "").trim();
  const password = String(newPassword || DEFAULT_WORKER_PASSWORD).trim();

  if (password.length < 6) {
    throw new Error("Password must be at least 6 characters");
  }

  const passwordHash = await bcrypt.hash(password, 10);

  let user = await User.findOne({
    role: "worker",
    $or: [{ email: normalizedEmail }, { workerId: normalizedEmployeeId }],
  });

  if (!user) {
    const emailTaken = await User.findOne({ email: normalizedEmail });
    if (emailTaken) {
      throw new Error(
        "This email is already used by another account. Use a different employee email."
      );
    }

    const workerIdTaken = await User.findOne({ workerId: normalizedEmployeeId });
    if (workerIdTaken) {
      throw new Error(
        "This employee ID is already used as a worker login ID by another user."
      );
    }

    user = await User.create({
      name: employee.name,
      email: normalizedEmail,
      workerId: normalizedEmployeeId,
      password: passwordHash,
      role: "worker",
      isActive: employee.status !== "Inactive",
    });

    return { user, created: true };
  }

  user.password = passwordHash;
  user.name = employee.name || user.name;
  user.email = normalizedEmail;
  if (normalizedEmployeeId) user.workerId = normalizedEmployeeId;
  user.isActive = employee.status !== "Inactive";
  await user.save();

  return { user, created: false };
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
      password,
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

    await generateAppointmentLetter(employee);

    let loginInfo = null;
    try {
      const { user, created } = await ensureWorkerLoginForEmployee(
        employee,
        password
      );
      loginInfo = {
        workerId: user.workerId,
        email: user.email,
        created,
        defaultPasswordUsed: !password,
      };
    } catch (loginError) {
      await Employee.findByIdAndDelete(employee._id);
      return res.status(400).json({
        success: false,
        message: `Employee not saved: ${loginError.message}`,
      });
    }

    return res.status(201).json({
      success: true,
      message: loginInfo?.created
        ? `Employee and worker login created. Login with ${loginInfo.workerId} or ${loginInfo.email}.`
        : "Employee created successfully",
      result: employee,
      login: loginInfo,
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

    await generateAppointmentLetter(employee);

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

const resetPassword = async (req, res) => {
  try {
    if (req.user?.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admin can reset employee passwords",
      });
    }

    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || String(newPassword).trim().length < 6) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 6 characters",
      });
    }

    const employee = await Employee.findById(id).lean();
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    const normalizedEmail = String(employee.email || "").toLowerCase().trim();
    const normalizedEmployeeId = String(employee.employeeId || "").trim();

    const { user, created } = await ensureWorkerLoginForEmployee(
      employee,
      newPassword
    );

    return res.status(200).json({
      success: true,
      message: created
        ? `Worker login created for ${employee.name}. Login with ${normalizedEmployeeId} or ${normalizedEmail}.`
        : `Password reset successful for ${employee.name || "employee"}`,
      result: {
        workerId: user.workerId,
        email: user.email,
        createdLogin: created,
      },
    });
  } catch (error) {
    console.error("Employee reset password error:", error);
    return res.status(error.message?.includes("already used") ? 400 : 500).json({
      success: false,
      message: error.message || "Failed to reset password",
    });
  }
};

const downloadAppointmentLetter = async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    const { targetLocation } = await generateAppointmentLetter(employee);
    return res.download(
      targetLocation,
      `Appointment-Letter-${employee.employeeId || employee._id}.pdf`
    );
  } catch (error) {
    console.error("Appointment letter error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to generate appointment letter",
      error: error.message,
    });
  }
};

const downloadMyAppointmentLetter = async (req, res) => {
  try {
    if (req.user?.role !== "worker") {
      return res.status(403).json({
        success: false,
        message: "Workers only",
      });
    }

    const workerId = String(req.user?.workerId || "").trim();
    const email = String(req.user?.email || "").trim().toLowerCase();
    const match = [];

    if (workerId) match.push({ employeeId: workerId });
    if (email) match.push({ email });

    const employee = match.length ? await Employee.findOne({ $or: match }) : null;
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee profile not found",
      });
    }

    const { targetLocation } = await generateAppointmentLetter(employee);
    return res.download(
      targetLocation,
      `Appointment-Letter-${employee.employeeId || employee._id}.pdf`
    );
  } catch (error) {
    console.error("My appointment letter error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to generate appointment letter",
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
  resetPassword,
  downloadAppointmentLetter,
  downloadMyAppointmentLetter,
};