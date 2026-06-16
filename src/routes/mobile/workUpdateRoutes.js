const express = require("express");
const router = express.Router();

const workUpdateController = require("../../controllers/mobile/workUpdateController");

router.post("/work-update", workUpdateController.createWorkUpdate);
router.get("/work-update/:jobId", workUpdateController.getWorkUpdatesByJob);

module.exports = router;