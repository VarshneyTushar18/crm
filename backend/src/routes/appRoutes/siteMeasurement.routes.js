const express = require("express");
const router = express.Router();

const controller = require("../../controllers/siteMeasurement.controller");

router.get("/list", controller.listMeasurements);
router.get("/read/:id", controller.readMeasurement);
router.post("/create", controller.createMeasurement);
router.patch("/update/:id", controller.updateMeasurement);
router.delete("/delete/:id", controller.deleteMeasurement);

module.exports = router;