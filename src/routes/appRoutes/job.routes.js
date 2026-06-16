const router = require("express").Router();

const {
  listJobs,
  createJob,
  deleteJob,
  updateJob,
  readJob, // ✅ NEW
  updateJobStage,
  summaryJobs,
} = require("../../controllers/job.controller");

router.get("/summary", summaryJobs);
router.get("/list", listJobs);
router.post("/create", createJob);

// ✅ NEW: read single job by id
router.get("/read/:id", readJob);

router.delete("/delete/:id", deleteJob);
router.patch("/update/:id", updateJob);

// ✅ Workflow stage update
router.patch("/stage/:id/:stageName", updateJobStage);

module.exports = router;