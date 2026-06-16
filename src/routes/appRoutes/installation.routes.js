const express = require("express");
const router = express.Router();

const controller = require("../../controllers/installation.controller");
const uploadInstallationFiles = require("../../middlewares/uploadInstallationFiles");

router.get("/list/:jobId", controller.listByJob);
router.post("/create", controller.create);
router.patch("/update/:id", controller.update);
router.delete("/delete/:id", controller.remove);

router.get("/summary/:jobId", controller.getSummary);
router.patch("/summary/:jobId", controller.saveSummary);

router.post("/mark-complete/:jobId", controller.markComplete);

router.post(
    "/finalize/:jobId",
    uploadInstallationFiles.fields([
        { name: "customerSignatureFile", maxCount: 1 },
        { name: "completionPictures", maxCount: 20 },
        { name: "completionDocuments", maxCount: 20 },
    ]),
    controller.finalize
);

module.exports = router;