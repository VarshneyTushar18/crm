const {
  getWorkflowStageKeys,
  isStageComplete,
  STAGE_LABELS,
} = require("./workflowDefaults");

const getPrerequisiteStages = (job, stageKey) => {
  const keys = getWorkflowStageKeys(job);
  const index = keys.indexOf(stageKey);
  if (index <= 0) return [];
  return keys.slice(0, index);
};

const validateStageCompletion = (job, stageKey) => {
  const prerequisites = getPrerequisiteStages(job, stageKey);
  const blockedBy = prerequisites.filter((key) => !isStageComplete(job, key));

  if (blockedBy.length) {
    const labels = blockedBy.map((k) => STAGE_LABELS[k] || k).join(", ");
    return {
      ok: false,
      message: `Complete previous stages first: ${labels}`,
      blockedBy,
    };
  }

  return { ok: true };
};

module.exports = {
  getPrerequisiteStages,
  validateStageCompletion,
};
