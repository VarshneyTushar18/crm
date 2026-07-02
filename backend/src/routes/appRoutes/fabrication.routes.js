const express = require("express");
const router = express.Router();
const fabricationController = require("../../controllers/fabrication.controller");
const uploadFabricationFiles = require("../../middlewares/uploadFabricationFiles");

router.get("/list/:jobId", fabricationController.listByJob);
router.get("/history/:jobId", fabricationController.getHistory);
router.post("/create", fabricationController.create);
router.post(
  "/upload/:id",
  uploadFabricationFiles.array("files", 20),
  fabricationController.uploadFiles
);
router.patch("/progress/:id", fabricationController.updateProgress);
router.patch("/update/:id", fabricationController.update);
router.delete("/delete/:id", fabricationController.remove);

module.exports = router;