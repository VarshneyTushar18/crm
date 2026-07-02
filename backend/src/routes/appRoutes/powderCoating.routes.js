const express = require("express");
const router = express.Router();
const controller = require("../../controllers/powderCoating.controller");

router.post("/complete/:jobId", controller.markComplete);

module.exports = router;
