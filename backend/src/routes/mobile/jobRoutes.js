const express = require("express");
const router = express.Router();

// controller import karo
const jobController = require("../../controllers/mobile/jobController");

// route define karo
router.get("/jobs", jobController.getAllJobs);
router.get("/jobs/worker/:workerId", jobController.getJobsByWorker);
router.get("/jobs/customer/:customerId", jobController.getJobsByCustomer);
router.post("/jobs", jobController.createJob);
router.put("/jobs/:jobId/status", jobController.updateJobStatus);

module.exports = router;    