const express = require("express");
const router = express.Router();
const controller = require("../../controllers/jobComment.controller");
const upload = require("../../middlewares/uploadJobCommentFiles");

router.get("/my-jobs", controller.myAssignedJobs);
router.get("/list/:jobId", controller.listByJob);
router.post("/create/:jobId", upload.array("files", 5), controller.create);

module.exports = router;
