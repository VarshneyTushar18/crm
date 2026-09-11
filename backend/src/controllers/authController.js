const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const User = mongoose.models.User;
const AuthDevice = mongoose.models.AuthDevice;
const AuthOtpLog = mongoose.models.AuthOtpLog;
const AuthSession = mongoose.models.AuthSession;

if (!User) {
  throw new Error("User model not loaded.");
}

// ================= HELPERS =================
const normalizeEmail = (email = "") => String(email || "").trim().toLowerCase();
const normalizeIdentifier = (value = "") => String(value || "").trim();
const toTokenHash = (token = "") =>
  crypto.createHash("sha256").update(String(token)).digest("hex");
const loginExpiryByRole = (role) => (role === "worker" ? "16h" : "7d");
const expiryToMs = (expiry = "7d") => {
  if (typeof expiry !== "string") return 7 * 24 * 60 * 60 * 1000;
  const m = expiry.match(/^(\d+)([smhd])$/i);
  if (!m) return 7 * 24 * 60 * 60 * 1000;
  const n = Number(m[1]);
  const unit = m[2].toLowerCase();
  if (unit === "s") return n * 1000;
  if (unit === "m") return n * 60 * 1000;
  if (unit === "h") return n * 60 * 60 * 1000;
  return n * 24 * 60 * 60 * 1000;
};
const makeOtp = () => Math.floor(100000 + Math.random() * 900000).toString();
const hashValue = (value = "") =>
  crypto.createHash("sha256").update(String(value)).digest("hex");
const getClientIp = (req) =>
  req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
  req.socket?.remoteAddress ||
  "";
const getUserAgent = (req) => String(req.headers["user-agent"] || "");
const canUseRole = (role) => ["admin", "worker", "customer", "siteEngineer"].includes(role);

const createOtpLog = async (payload = {}) => {
  if (!AuthOtpLog) return;
  try {
    await AuthOtpLog.create(payload);
  } catch {
    // avoid blocking auth on audit logging failures
  }
};

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

const signToken = (user, expiresIn) => {
  const ttl = expiresIn || loginExpiryByRole(user?.role);
  return jwt.sign(
    {
      id: user._id,
      role: user.role,
      email: user.email || null,
      workerId: user.workerId || null,
      customer: user.customer || null,
    },
    process.env.JWT_SECRET,
    { expiresIn: ttl }
  );
};

const makeAuthResponse = (user, token, expiresIn) => ({
  success: true,
  result: {
    token,
    expiresIn,
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
      boundDeviceId: user.boundDeviceId || "",
    },
  },
  message: "Login successful",
});

const findLoginUser = async ({ role, identifier }) => {
  const normalizedIdentifier = normalizeIdentifier(identifier);
  if (!canUseRole(role) || !normalizedIdentifier) return null;

  let query = {};
  if (role === "worker") {
    query = {
      role: "worker",
      $or: [
        { workerId: normalizedIdentifier },
        { email: normalizeEmail(normalizedIdentifier) },
        { mobile: normalizedIdentifier },
        { phone: normalizedIdentifier },
      ],
    };
  } else {
    query = {
      role,
      $or: [
        { email: normalizeEmail(normalizedIdentifier) },
        { mobile: normalizedIdentifier },
        { phone: normalizedIdentifier },
      ],
    };
  }

  let userQuery = User.findOne(query);
  if (role === "customer" && User.schema?.paths?.customer) {
    userQuery = userQuery.populate("customer");
  }
  return userQuery;
};

const upsertDevice = async (user, { deviceId, deviceLabel = "", req }) => {
  if (!AuthDevice || !deviceId) return;
  await AuthDevice.findOneAndUpdate(
    { userId: user._id, deviceId: String(deviceId).trim() },
    {
      $set: {
        label: String(deviceLabel || "").trim(),
        platform: getUserAgent(req),
        lastSeenAt: new Date(),
      },
      $setOnInsert: { isPrimary: !user.boundDeviceId },
    },
    { new: true, upsert: true }
  );
};

const assertWorkerDevice = async (user, { deviceId, deviceLabel, req, allowRebind = false }) => {
  if (user.role !== "worker") return { ok: true };
  const normalizedDeviceId = String(deviceId || "").trim();
  if (!normalizedDeviceId) {
    return {
      ok: false,
      status: 400,
      message: "deviceId is required for worker login",
    };
  }
  if (!user.boundDeviceId) {
    user.boundDeviceId = normalizedDeviceId;
    user.boundDeviceLabel = String(deviceLabel || "").trim();
    await user.save();
  } else if (user.boundDeviceId !== normalizedDeviceId) {
    // Password / verified OTP login can re-bind browser device for local/web testing.
    // Strict one-device lock remains for future mobile-only mode when allowRebind=false.
    if (!allowRebind) {
      return {
        ok: false,
        status: 403,
        message:
          "This account is bound to another device. Contact Admin/HR to re-register device.",
      };
    }
    user.boundDeviceId = normalizedDeviceId;
    user.boundDeviceLabel = String(deviceLabel || "").trim();
    await user.save();
  }
  await upsertDevice(user, { deviceId: normalizedDeviceId, deviceLabel, req });
  return { ok: true };
};

const MAX_ACTIVE_SESSIONS = 5;

const createSession = async (user, token, { req, deviceId = "", deviceLabel = "", expiresIn }) => {
  if (!AuthSession) return;
  const ttl = expiryToMs(expiresIn || loginExpiryByRole(user.role));
  const now = new Date();
  const normalizedDeviceId = String(deviceId || "").trim();

  // Same device re-login: replace only that device's session (not all devices)
  if (normalizedDeviceId) {
    await AuthSession.updateMany(
      { userId: user._id, deviceId: normalizedDeviceId, isRevoked: false },
      { isRevoked: true, revokedAt: now, revokedReason: "device_relogin" }
    );
  }

  await AuthSession.create({
    userId: user._id,
    tokenHash: toTokenHash(token),
    role: user.role,
    deviceId: normalizedDeviceId,
    deviceLabel: String(deviceLabel || "").trim(),
    ip: getClientIp(req),
    userAgent: getUserAgent(req),
    expiresAt: new Date(Date.now() + ttl),
  });

  // Allow up to 5 concurrent devices; revoke oldest when over limit
  const activeSessions = await AuthSession.find({
    userId: user._id,
    isRevoked: false,
    expiresAt: { $gt: now },
  })
    .sort({ createdAt: -1 })
    .select("_id")
    .lean();

  if (activeSessions.length > MAX_ACTIVE_SESSIONS) {
    const toRevoke = activeSessions.slice(MAX_ACTIVE_SESSIONS).map((s) => s._id);
    await AuthSession.updateMany(
      { _id: { $in: toRevoke } },
      { isRevoked: true, revokedAt: now, revokedReason: "max_devices" }
    );
  }
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
    const { role, identifier, password, deviceId, deviceLabel } = req.body;
    const roleInput = String(role || "").trim().toLowerCase();
    let normalizedRole = roleInput === "employee" ? "worker" : roleInput;
    if (["site engineer", "siteengineer", "site_engineer"].includes(normalizedRole)) {
      normalizedRole = "siteEngineer";
    }
    const normalizedIdentifier = normalizeIdentifier(identifier);

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

    const user = await findLoginUser({
      role: normalizedRole,
      identifier: normalizedIdentifier,
    });

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
      await createOtpLog({
        userId: user._id,
        identifier: normalizedIdentifier,
        role: normalizedRole,
        purpose: "login",
        status: "failed",
        ip: getClientIp(req),
        userAgent: getUserAgent(req),
        meta: { reason: "invalidPassword" },
      });
      return res.status(400).json({
        success: false,
        message: "Invalid password",
      });
    }

    const deviceCheck = await assertWorkerDevice(user, {
      deviceId,
      deviceLabel,
      req,
      allowRebind: true,
    });
    if (!deviceCheck.ok) {
      await createOtpLog({
        userId: user._id,
        identifier: normalizedIdentifier,
        role: normalizedRole,
        purpose: "login",
        status: "failed",
        ip: getClientIp(req),
        userAgent: getUserAgent(req),
        meta: { reason: "deviceMismatch", deviceId: String(deviceId || "") },
      });
      return res.status(deviceCheck.status || 403).json({
        success: false,
        message: deviceCheck.message,
      });
    }

    user.lastLoginAt = new Date();
    await user.save();

    const expiresIn = loginExpiryByRole(user.role);
    const token = signToken(user, expiresIn);
    await createSession(user, token, { req, deviceId, deviceLabel, expiresIn });

    await createOtpLog({
      userId: user._id,
      identifier: normalizedIdentifier,
      role: normalizedRole,
      purpose: "login",
      status: "verified",
      ip: getClientIp(req),
      userAgent: getUserAgent(req),
      meta: { method: "password" },
    });

    return res.json(makeAuthResponse(user, token, expiresIn));
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
    const { name, email, workerId, password, mobile, phone } = req.body;

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
      mobile: String(mobile || phone || "").trim(),
      phone: String(phone || mobile || "").trim(),
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
      const normalizedPhone = String(phone || "").trim();
      const identifier = email
        ? { email: normalizeEmail(email) }
        : { $or: [{ phone: normalizedPhone }, { mobile: normalizedPhone }] };
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

// ================= LOGIN OTP (PHASE 1) =================
exports.requestLoginOtp = async (req, res) => {
  try {
    const { role, identifier } = req.body || {};
    const roleInput = String(role || "").trim().toLowerCase();
    const normalizedRole =
      roleInput === "employee"
        ? "worker"
        : ["site engineer", "siteengineer", "site_engineer"].includes(roleInput)
          ? "siteEngineer"
          : roleInput;
    const normalizedIdentifier = normalizeIdentifier(identifier);

    if (!canUseRole(normalizedRole)) {
      return res.status(400).json({ success: false, message: "Invalid role" });
    }
    if (!normalizedIdentifier) {
      return res.status(400).json({ success: false, message: "identifier is required" });
    }

    const user = await findLoginUser({
      role: normalizedRole,
      identifier: normalizedIdentifier,
    });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    if (isUserInactive(user)) {
      return res.status(403).json({ success: false, message: "User account is inactive" });
    }

    const now = Date.now();
    if (user.loginOtpResendAt && new Date(user.loginOtpResendAt).getTime() > now) {
      const waitSeconds = Math.ceil(
        (new Date(user.loginOtpResendAt).getTime() - now) / 1000
      );
      await createOtpLog({
        userId: user._id,
        identifier: normalizedIdentifier,
        role: normalizedRole,
        purpose: "login",
        status: "resendBlocked",
        ip: getClientIp(req),
        userAgent: getUserAgent(req),
        meta: { waitSeconds },
      });
      return res.status(429).json({
        success: false,
        message: `Please wait ${waitSeconds}s before requesting a new OTP`,
      });
    }

    const otp = makeOtp();
    user.loginOtpHash = hashValue(otp);
    user.loginOtpExpires = new Date(now + 5 * 60 * 1000);
    user.loginOtpResendAt = new Date(now + 60 * 1000);
    await user.save();

    await createOtpLog({
      userId: user._id,
      identifier: normalizedIdentifier,
      role: normalizedRole,
      purpose: "login",
      status: "issued",
      ip: getClientIp(req),
      userAgent: getUserAgent(req),
      meta: { channel: user.mobile || user.phone ? "sms" : "app" },
    });

    return res.json({
      success: true,
      result: {
        otp,
        expiresInSeconds: 300,
        resendAfterSeconds: 60,
      },
      message: "Login OTP generated",
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.verifyLoginOtp = async (req, res) => {
  try {
    const { role, identifier, otp, deviceId, deviceLabel } = req.body || {};
    const roleInput = String(role || "").trim().toLowerCase();
    const normalizedRole =
      roleInput === "employee"
        ? "worker"
        : ["site engineer", "siteengineer", "site_engineer"].includes(roleInput)
          ? "siteEngineer"
          : roleInput;
    const normalizedIdentifier = normalizeIdentifier(identifier);
    const normalizedOtp = normalizeIdentifier(otp);

    if (!canUseRole(normalizedRole) || !normalizedIdentifier || !normalizedOtp) {
      return res.status(400).json({
        success: false,
        message: "role, identifier and otp are required",
      });
    }

    const user = await findLoginUser({
      role: normalizedRole,
      identifier: normalizedIdentifier,
    });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    if (isUserInactive(user)) {
      return res.status(403).json({ success: false, message: "User account is inactive" });
    }

    if (!user.loginOtpHash || !user.loginOtpExpires || user.loginOtpExpires < new Date()) {
      await createOtpLog({
        userId: user._id,
        identifier: normalizedIdentifier,
        role: normalizedRole,
        purpose: "login",
        status: "expired",
        ip: getClientIp(req),
        userAgent: getUserAgent(req),
      });
      return res.status(400).json({ success: false, message: "OTP expired. Request a new OTP." });
    }

    const valid = user.loginOtpHash === hashValue(normalizedOtp);
    if (!valid) {
      await createOtpLog({
        userId: user._id,
        identifier: normalizedIdentifier,
        role: normalizedRole,
        purpose: "login",
        status: "failed",
        ip: getClientIp(req),
        userAgent: getUserAgent(req),
        meta: { reason: "invalidOtp" },
      });
      return res.status(400).json({ success: false, message: "Invalid OTP" });
    }

    const deviceCheck = await assertWorkerDevice(user, {
      deviceId,
      deviceLabel,
      req,
      allowRebind: true,
    });
    if (!deviceCheck.ok) {
      return res.status(deviceCheck.status || 403).json({
        success: false,
        message: deviceCheck.message,
      });
    }

    user.loginOtpHash = null;
    user.loginOtpExpires = null;
    user.lastLoginAt = new Date();
    await user.save();

    const expiresIn = loginExpiryByRole(user.role);
    const token = signToken(user, expiresIn);
    await createSession(user, token, { req, deviceId, deviceLabel, expiresIn });

    await createOtpLog({
      userId: user._id,
      identifier: normalizedIdentifier,
      role: normalizedRole,
      purpose: "login",
      status: "verified",
      ip: getClientIp(req),
      userAgent: getUserAgent(req),
      meta: { method: "otp" },
    });

    return res.json(makeAuthResponse(user, token, expiresIn));
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.resendLoginOtp = async (req, res) => {
  req.body = { ...(req.body || {}), force: true };
  return exports.requestLoginOtp(req, res);
};

exports.me = async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ success: false, message: "Unauthorized" });
    return res.json({
      success: true,
      result: {
        _id: user._id,
        name: user.name,
        email: user.email || null,
        role: user.role,
        workerId: user.workerId || null,
        mobile: user.mobile || null,
        boundDeviceId: user.boundDeviceId || "",
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.logout = async (req, res) => {
  try {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.split(" ")[1] : "";
    if (token && AuthSession && req.user?._id) {
      await AuthSession.findOneAndUpdate(
        {
          userId: req.user._id,
          tokenHash: toTokenHash(token),
          isRevoked: false,
        },
        {
          isRevoked: true,
          revokedAt: new Date(),
          revokedReason: "logout",
        }
      );
    }
    return res.json({ success: true, message: "Logged out successfully" });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};