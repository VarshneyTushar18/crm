const express = require("express");
const router = express.Router();

const controller = require("../../controllers/jobCard.controller");
const uploadJobCardFiles = require("../../middlewares/uploadJobCardFiles");

router.get("/my", controller.listMyCards);
router.get("/list/:jobId", controller.listByJob);
router.post("/create", controller.create);
router.post("/generate-from-installation/:jobId", controller.generateFromInstallation);
router.patch("/update/:id", controller.update);
router.patch("/execute/:id", controller.execute);
router.post(
  "/upload/:id",
  uploadJobCardFiles.array("files", 20),
  controller.uploadFiles
);
router.delete("/delete/:id", controller.remove);

module.exports = router;
