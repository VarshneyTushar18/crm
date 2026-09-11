const express = require("express");
const router = express.Router();

const controller = require("../../controllers/defectSnag.controller");
const uploadInstallationFiles = require("../../middlewares/uploadInstallationFiles");

router.get("/list/:jobId", controller.listByJob);
router.get("/open-count/:jobId", controller.openCount);
router.post("/create", controller.create);
router.patch("/update/:id", controller.update);
router.post("/close/:id", controller.close);
router.post(
  "/upload/:id",
  uploadInstallationFiles.array("files", 20),
  controller.uploadPhotos
);

module.exports = router;
