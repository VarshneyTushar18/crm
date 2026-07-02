const Job = require("../models/appModels/Job");
const { markModuleCompleteForReview } = require("../utils/moduleSiteEngineerGate");
const { notifyCustomer } = require("../services/notificationService");

const getActor = (req) =>
  req.user?.name || req.user?.email || req.admin?.name || "System";

exports.markComplete = async (req, res) => {
  try {
    const job = await Job.findById(req.params.jobId);
    if (!job) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }

    if (!job.workflowEvents) job.workflowEvents = {};
    if (!job.workflowEvents.powderCoating) {
      job.workflowEvents.powderCoating = { stageStatus: "Pending", isCompleted: false };
    }

    const stage = job.workflowEvents.powderCoating;
    if (stage.isCompleted) {
      return res.json({ success: true, result: job, message: "Powder coating already completed" });
    }

    stage.stageStatus = "In Progress";
    stage.startActual = stage.startActual || new Date();
    stage.completionActual = new Date();
    stage.batchRef = req.body?.batchRef || stage.batchRef || "";

    await markModuleCompleteForReview(job._id, "powderCoating", getActor(req));

    const refreshed = await Job.findById(job._id);
    if (refreshed?.customerId) {
      await notifyCustomer({
        customerId: refreshed.customerId,
        job: refreshed,
        title: "Powder coating completed",
        body: `Powder coating is complete for project ${refreshed.jobId}. Quality check is next.`,
      });
    }

    return res.json({
      success: true,
      result: refreshed,
      message: "Powder coating marked complete — awaiting site engineer review",
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};
