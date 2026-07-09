const router = require("express").Router();
const authController = require("../../controllers/authController");
const adminAuth = require("../../controllers/coreControllers/adminAuth");

router.post("/login", authController.login);
router.post("/login/request-otp", authController.requestLoginOtp);
router.post("/login/verify-otp", authController.verifyLoginOtp);
router.post("/login/resend-otp", authController.resendLoginOtp);
router.post("/customer/register", authController.customerRegister);
router.post("/worker/create", authController.createWorker);
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password", authController.resetPassword);
router.get("/me", adminAuth.isValidAuthToken, authController.me);
router.post("/logout", adminAuth.isValidAuthToken, authController.logout);

module.exports = router;