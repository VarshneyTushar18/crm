const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

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
