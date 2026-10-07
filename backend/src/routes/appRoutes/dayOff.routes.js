const express = require("express");
const router = express.Router();
const controller = require("../../controllers/dayOff.controller");

router.get("/active", controller.listActive);

module.exports = router;
