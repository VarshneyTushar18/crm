const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const crypto = require("crypto");

const tokenHash = (token = "") =>
  crypto.createHash("sha256").update(String(token)).digest("hex");

// ✅ Accept Bearer JWT from frontend (Authorization: Bearer <token>)
exports.isValidAuthToken = async (req, res, next) => {
  try {
    const auth = req.headers.authorization || "";
    let token = null;

    // 1) From Authorization header
    if (auth.startsWith("Bearer ")) {
      token = auth.split(" ")[1];
    }

    // 2) Fallback from cookie (optional)
    if (!token && req.cookies?.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "No authentication token, authorization denied.",
      });
    }

    // 3) Verify token using same secret used in authController.js
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 4) Load User model
    const User = mongoose.models.User;
    if (!User) {
      return res.status(500).json({
        success: false,
        message: "User model not loaded",
      });
    }

    // 5) Find user from DB
    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User doesn't Exist, authorization denied.",
      });
    }

    const AuthSession = mongoose.models.AuthSession;
    if (AuthSession) {
      const activeSession = await AuthSession.findOne({
        userId: user._id,
        tokenHash: tokenHash(token),
        isRevoked: false,
        expiresAt: { $gt: new Date() },
      }).select("_id");
      if (!activeSession) {
        return res.status(401).json({
          success: false,
          message: "Session expired. Please login again.",
        });
      }
    }

    // Attach user
    req.user = user;

    return next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: "User doesn't Exist, authorization denied.",
    });
  }
};

exports.requireRoles = (...roles) => {
  const allow = new Set(roles.map((r) => String(r || "").trim()));
  return (req, res, next) => {
    const role = String(req.user?.role || "").trim();
    if (!allow.has(role)) {
      return res.status(403).json({
        success: false,
        message: "Access denied for this role",
      });
    }
    return next();
  };
};
