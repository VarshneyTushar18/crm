const express = require("express");
const router = express.Router();
const controller = require("../../controllers/scheduling.controller");
const upload = require("../../middlewares/uploadSchedulingFiles");

router.get("/list/:jobId", controller.listByJob);
router.get("/calendar", controller.calendar);
router.get("/summary/:jobId", controller.summary);
router.post("/create", controller.create);
router.patch("/update/:id", controller.update);
router.post("/upload/:id", upload.array("files", 10), controller.uploadFiles);
router.delete("/delete/:id", controller.remove);

module.exports = router;
