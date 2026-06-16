const express = require("express");
const router = express.Router();

const attendanceController = require("@/controllers/attendance.controller");

router.get("/list", attendanceController.list);
router.get("/read/:id", attendanceController.read);
router.post("/create", attendanceController.create);
router.patch("/update/:id", attendanceController.update);
router.delete("/delete/:id", attendanceController.delete);

module.exports = router;