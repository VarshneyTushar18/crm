const express = require("express");
const router = express.Router();

const controller = require("../../controllers/productivity.controller");

router.get("/summary", controller.summary);
router.get("/my", controller.mySummary);

module.exports = router;
