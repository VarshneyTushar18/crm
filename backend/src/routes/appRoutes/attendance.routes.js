const express = require("express");
const router = express.Router();

const attendanceController = require("@/controllers/attendance.controller");
const workerAttendanceController = require("@/controllers/workerAttendance.controller");

router.get("/list", attendanceController.list);
router.get("/read/:id", attendanceController.read);
router.post("/create", attendanceController.create);
router.patch("/update/:id", attendanceController.update);
router.delete("/delete/:id", attendanceController.delete);

// Worker app attendance (check-in / check-out + live timer status)
router.get("/status", workerAttendanceController.status);
router.get("/history", workerAttendanceController.history);
router.get("/timesheet", workerAttendanceController.timesheet);
router.delete("/timesheet/:id/photos", workerAttendanceController.deletePhotos);
router.post("/check-in", workerAttendanceController.checkIn);
router.post("/check-out", workerAttendanceController.checkOut);

module.exports = router;