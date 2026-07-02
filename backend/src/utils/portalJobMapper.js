const {
  getWorkflowStageKeys,
  STAGE_LABELS,
  calcJobCompletionPercent,
  calcStageCompletionPercent,
  ensureV3WorkflowEvents,
  getTimelineWorkflowVersion,
} = require("./workflowDefaults");

const sanitizeJobForPortal = (job) => {
  const obj = job?.toObject ? job.toObject() : { ...job };
  const version = getTimelineWorkflowVersion(obj);
  const workflowEvents = ensureV3WorkflowEvents(obj.workflowEvents || {});
  const stageKeys = getWorkflowStageKeys(version);

  const timeline = stageKeys.map((key, index) => {
    const stage = workflowEvents[key] || {};
    return {
      key,
      order: index + 1,
      title: STAGE_LABELS[key] || key,
      stageStatus: stage.stageStatus || "Pending",
      isCompleted: !!stage.isCompleted,
      completedAt: stage.completedAt || null,
      completionPercent: calcStageCompletionPercent(stage),
    };
  });

  const autoPercent = calcJobCompletionPercent(workflowEvents, version);
  const completionPercent = autoPercent;

  return {
    _id: obj._id,
    jobId: obj.jobId,
    customer: obj.customer,
    site: obj.site,
    stage: obj.stage,
    systemState: obj.systemState,
    workflowVersion: version,
    workflowEvents,
    completionPercent,
    autoCompletionPercent: autoPercent,
    manualProgressPercent: obj.manualProgressPercent ?? null,
    timeline,
    lockedValue: obj.lockedValue || 0,
    totalInvoiced: obj.totalInvoiced || 0,
    totalPaid: obj.totalPaid || 0,
    outstandingBalance: Math.max(
      0,
      Number(obj.totalInvoiced || 0) - Number(obj.totalPaid || 0)
    ),
    updatedAt: obj.updatedAt,
    createdAt: obj.createdAt,
  };
};

module.exports = {
  sanitizeJobForPortal,
};
