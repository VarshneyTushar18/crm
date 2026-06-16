const express = require("express");
const router = express.Router();

const checkinController = require("../../controllers/mobile/checkinController");

router.post("/checkin", checkinController.workerCheckIn);
router.post("/checkout", checkinController.workerCheckOut);

router.get("/checkins", checkinController.getAllCheckins);
router.get("/checkins/worker/:workerId", checkinController.getWorkerCheckins);

module.exports = router;