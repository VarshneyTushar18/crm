const router = require("express").Router();
const authController = require("../../controllers/authController");

router.post("/login", authController.login);
router.post("/customer/register", authController.customerRegister);
router.post("/worker/create", authController.createWorker);
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password", authController.resetPassword);

module.exports = router;