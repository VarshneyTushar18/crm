const express = require("express");
const router = express.Router();

const controller = require("../../controllers/workerTask.controller");
const upload = require("../../middlewares/uploadJobCardFiles");

router.get("/mine", controller.listMine);
router.get("/review-queue", controller.reviewQueue);
router.get("/list", controller.list);
router.post("/create", controller.create);
router.post("/start/:id", controller.start);
router.post("/complete/:id", controller.complete);
router.post("/upload-proof/:id", upload.array("files", 10), controller.uploadProof);
router.post("/location-ping/:id", controller.addLocationPing);
router.post("/review/:id", controller.review);
router.delete("/delete/:id", controller.remove);

module.exports = router;
