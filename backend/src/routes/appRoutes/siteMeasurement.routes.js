const express = require("express");
const router = express.Router();

const controller = require("../../controllers/siteMeasurement.controller");
const upload = require("../../middlewares/uploadSiteMeasurementFiles");

router.get("/list", controller.listMeasurements);
router.get("/list/:jobId", controller.listByJob);
router.get("/read/:id", controller.readMeasurement);
router.post("/create", controller.createMeasurement);
router.patch("/update/:id", controller.updateMeasurement);
router.post("/upload/:id", upload.array("files", 10), controller.uploadFiles);
router.delete("/delete/:id", controller.deleteMeasurement);

module.exports = router;