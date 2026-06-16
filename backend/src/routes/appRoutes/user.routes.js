const express = require("express");
const router = express.Router();

const userController = require("../../controllers/user.controller");

// ✅ GET /api/user/me
router.get("/me", userController.getMe);

// ✅ PATCH /api/user/me
router.patch("/me", userController.updateMe);

// ✅ POST /api/user/me/password/request-otp
router.post("/me/password/request-otp", userController.requestPasswordOTP);

// ✅ PATCH /api/user/me/password
router.patch("/me/password", userController.updatePassword);

module.exports = router;