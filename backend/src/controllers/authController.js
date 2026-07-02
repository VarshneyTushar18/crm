const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const User = mongoose.models.User;

if (!User) {
  throw new Error("User model not loaded.");
}

// ================= HELPERS =================
const normalizeEmail = (email = "") => String(email || "").trim().toLowerCase();

const isUserInactive = (user) => {
  if (!user) return true;

  if (typeof user.isActive === "boolean" && user.isActive === false) return true;
  if (typeof user.enabled === "boolean" && user.enabled === false) return true;
  if (typeof user.removed === "boolean" && user.removed === true) return true;
  if (typeof user.status === "string" && user.status.toLowerCase() === "inactive") {
    return true;
  }

  return false;
};

const signToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      role: user.role,
      email: user.email || null,
      workerId: user.workerId || null,
      customer: user.customer || null,
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
};

// ================= AUTO CREATE DEFAULT ADMIN =================
exports.ensureDefaultAdmin = async () => {
  try {
    const exists = await User.findOne({
      role: "admin",
      email: "admin@crm.com",
    });

    if (!exists) {
      const hash = await bcrypt.hash("Admin@123", 10);

      const payload = {
        name: "System Admin",
        email: "admin@crm.com",
        password: hash,
        role: "admin",
      };

      if (User.schema?.paths?.isActive) payload.isActive = true;
      if (User.schema?.paths?.enabled) payload.enabled = true;
      if (User.schema?.paths?.removed) payload.removed = false;
      if (User.schema?.paths?.status) payload.status = "Active";

      await User.create(payload);

      console.log("✅ Default admin created:");
      console.log("Email: admin@crm.com");
      console.log("Password: Admin@123");
    }
  } catch (err) {
    console.log("Admin creation error:", err.message);
  }
};

// ================= LOGIN =================
exports.login = async (req, res) => {
  try {
    const { role, identifier, password } = req.body;
    const roleInput = String(role || "").trim().toLowerCase();
    let normalizedRole = roleInput === "employee" ? "worker" : roleInput;
    if (["site engineer", "siteengineer", "site_engineer"].includes(normalizedRole)) {
      normalizedRole = "siteEngineer";
    }
    const normalizedIdentifier = String(identifier || "").trim();

    if (!normalizedRole || !normalizedIdentifier || !password) {
      return res.status(400).json({
        success: false,
        message: "role, identifier, password required",
      });
    }

    if (!["admin", "worker", "customer", "siteEngineer"].includes(normalizedRole)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role",
      });
    }

    let query = {};

    if (normalizedRole === "worker") {
      query = {
        role: "worker",
        $or: [{ workerId: normalizedIdentifier }, { email: normalizeEmail(normalizedIdentifier) }],
      };
    } else {
      query = {
        role: normalizedRole,
        email: normalizeEmail(normalizedIdentifier),
      };
    }

    let userQuery = User.findOne(query);

    if (normalizedRole === "customer" && User.schema?.paths?.customer) {
      userQuery = userQuery.populate("customer");
    }

    const user = await userQuery;

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "User not found",
      });
    }

    if (isUserInactive(user)) {
      return res.status(403).json({
        success: false,
        message: "User account is inactive",
      });
    }

    const valid = await bcrypt.compare(password, user.password || "");

    if (!valid) {
      return res.status(400).json({
        success: false,
        message: "Invalid password",
      });
    }

    const token = signToken(user);

    return res.json({
      success: true,
      result: {
        token,
        role: user.role,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email || null,
          role: user.role,
          workerId: user.workerId || null,
          companyName: user.companyName || null,
          mobile: user.mobile || null,
          customer: user.customer || null,
        },
      },
      message: "Login successful",
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ================= CUSTOMER REGISTER =================
exports.customerRegister = async (req, res) => {
  try {
    const { name, companyName, email, password, mobile } = req.body;

    if (!name || !companyName || !email || !password || !mobile) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    const emailLower = normalizeEmail(email);

    const exists = await User.findOne({
      email: emailLower,
      role: "customer",
    });

    if (exists) {
      return res.status(409).json({
        success: false,
        message: "Customer already exists with this email",
      });
    }

    const hash = await bcrypt.hash(password, 10);

    const payload = {
      name,
      companyName,
      email: emailLower,
      mobile,
      password: hash,
      role: "customer",
    };

    if (User.schema?.paths?.isActive) payload.isActive = true;
    if (User.schema?.paths?.enabled) payload.enabled = true;
    if (User.schema?.paths?.removed) payload.removed = false;
    if (User.schema?.paths?.status) payload.status = "Active";
    if (User.schema?.paths?.emailVerified) payload.emailVerified = true;

    const user = await User.create(payload);

    return res.json({
      success: true,
      result: {
        _id: user._id,
        name: user.name,
        companyName: user.companyName || null,
        email: user.email,
        mobile: user.mobile || null,
        role: user.role,
      },
      message: "Customer registered successfully",
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ================= ADMIN CREATE WORKER =================
exports.createWorker = async (req, res) => {
  try {
    const { name, email, workerId, password } = req.body;

    if (!name || !email || !workerId || !password) {
      return res.status(400).json({
        success: false,
        message: "name, email, workerId and password are required",
      });
    }

    const emailLower = normalizeEmail(email);

    const exists = await User.findOne({
      $or: [{ email: emailLower }, { workerId: String(workerId).trim() }],
    });

    if (exists) {
      return res.status(400).json({
        success: false,
        message: "Worker already exists",
      });
    }

    const hash = await bcrypt.hash(password, 10);

    const payload = {
      name,
      email: emailLower,
      workerId: String(workerId).trim(),
      password: hash,
      role: "worker",
    };

    if (User.schema?.paths?.isActive) payload.isActive = true;
    if (User.schema?.paths?.enabled) payload.enabled = true;
    if (User.schema?.paths?.removed) payload.removed = false;
    if (User.schema?.paths?.status) payload.status = "Active";

    const worker = await User.create(payload);

    return res.json({
      success: true,
      result: worker,
      message: "Worker created successfully",
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ================= AUTO CREATE DEFAULT WORKER =================
exports.ensureDefaultWorker = async () => {
  try {
    const exists = await User.findOne({
      role: "worker",
      workerId: "W-1001",
    });

    if (!exists) {
      const hash = await bcrypt.hash("Worker@123", 10);

      const payload = {
        name: "Default Worker",
        email: "worker@crm.com",
        workerId: "W-1001",
        password: hash,
        role: "worker",
      };

      if (User.schema?.paths?.isActive) payload.isActive = true;
      if (User.schema?.paths?.enabled) payload.enabled = true;
      if (User.schema?.paths?.removed) payload.removed = false;
      if (User.schema?.paths?.status) payload.status = "Active";

      await User.create(payload);

      console.log("✅ Default worker created:");
      console.log("Worker ID: W-1001");
      console.log("Password: Worker@123");
    }
  } catch (err) {
    console.log("Worker creation error:", err.message);
  }
};

// ================= AUTO CREATE DEFAULT CUSTOMER =================
exports.ensureDefaultCustomer = async () => {
  try {
    const exists = await User.findOne({
      role: "customer",
      email: "customer@crm.com",
    });

    if (!exists) {
      const hash = await bcrypt.hash("Customer@123", 10);

      const payload = {
        name: "Default Customer",
        companyName: "Demo Customer Company",
        email: "customer@crm.com",
        mobile: "+910000000001",
        password: hash,
        role: "customer",
      };

      if (User.schema?.paths?.isActive) payload.isActive = true;
      if (User.schema?.paths?.enabled) payload.enabled = true;
      if (User.schema?.paths?.removed) payload.removed = false;
      if (User.schema?.paths?.status) payload.status = "Active";
      if (User.schema?.paths?.emailVerified) payload.emailVerified = true;

      await User.create(payload);

      console.log("✅ Default customer created:");
      console.log("Email: customer@crm.com");
      console.log("Password: Customer@123");
    }
  } catch (err) {
    console.log("Customer creation error:", err.message);
  }
};

const findUserByIdentifier = async ({ email, phone }) => {
  if (email) {
    const emailLower = normalizeEmail(email);
    return await User.findOne({ email: emailLower });
  }

  if (phone) {
    const normalizedPhone = String(phone || "").trim();
    return await User.findOne({
      $or: [{ mobile: normalizedPhone }, { phone: normalizedPhone }],
    });
  }

  return null;
};

const setResetToken = async (user, payload = {}) => {
  const { type = "link" } = payload;
  const code = type === "otp" ? Math.floor(100000 + Math.random() * 900000).toString() : crypto.randomBytes(32).toString("hex");
  const hash = crypto.createHash("sha256").update(code).digest("hex");

  user.resetPasswordTokenHash = hash;
  user.resetPasswordExpires = Date.now() + 15 * 60 * 1000;
  user.resetPasswordMethod = type === "otp" ? "otp" : "link";

  await user.save();

  return {
    method: user.resetPasswordMethod,
    resetCode: type === "otp" ? code : undefined,
    resetToken: type === "link" ? code : undefined,
  };
};

// ================= FORGOT PASSWORD =================
exports.forgotPassword = async (req, res) => {
  try {
    const { email, phone, type } = req.body;

    if (!email && !phone) {
      return res.status(400).json({
        success: false,
        message: "Email or phone is required",
      });
    }

    const user = await findUserByIdentifier({ email, phone });

    if (!user) {
      return res.json({
        success: true,
        message: "If the account exists, reset instructions have been sent.",
      });
    }

    const mode = String(type || (phone ? "otp" : "link")).toLowerCase();
    const result = await setResetToken(user, { type: mode });

    return res.json({
      success: true,
      result,
      message:
        mode === "otp"
          ? "Reset code generated. Use the code to set a new password."
          : "Reset token generated. Use the link or token to set a new password.",
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ================= RESET PASSWORD =================
exports.resetPassword = async (req, res) => {
  try {
    const { token, otp, email, phone, newPassword } = req.body;

    if (!newPassword) {
      return res.status(400).json({
        success: false,
        message: "New password is required",
      });
    }

    let user = null;
    let tokenHash = null;

    if (token) {
      tokenHash = crypto.createHash("sha256").update(token).digest("hex");
      user = await User.findOne({
        resetPasswordTokenHash: tokenHash,
        resetPasswordExpires: { $gt: Date.now() },
        resetPasswordMethod: "link",
      });
    } else if (otp && (email || phone)) {
      const identifier = email ? { email: normalizeEmail(email) } : { phone: String(phone).trim() };
      user = await User.findOne({
        ...identifier,
        resetPasswordExpires: { $gt: Date.now() },
        resetPasswordMethod: "otp",
      });
      if (user) {
        tokenHash = crypto.createHash("sha256").update(String(otp)).digest("hex");
        if (user.resetPasswordTokenHash !== tokenHash) {
          user = null;
        }
      }
    } else {
      return res.status(400).json({
        success: false,
        message: "Token or OTP plus email/phone is required",
      });
    }

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset code",
      });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.resetPasswordTokenHash = undefined;
    user.resetPasswordExpires = undefined;
    user.resetPasswordMethod = undefined;

    await user.save();

    return res.json({
      success: true,
      message: "Password updated",
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};