const express = require("express");
const router = express.Router();
const controller = require("../../controllers/siteEngineer.controller");

router.get("/summary", controller.summary);
router.get("/list/:jobId", controller.listByJob);
router.get("/reviews", controller.listAll);
router.get("/history/:jobId", controller.history);
router.get("/pending", controller.pending);
router.patch("/status/:id", controller.updateStatus);
router.post("/ensure/:draftingId", controller.ensureReview);
router.post("/send/:jobId", controller.sendForApproval);
router.post("/approve/:id", controller.approve);
router.post("/reject/:id", controller.reject);

module.exports = router;
