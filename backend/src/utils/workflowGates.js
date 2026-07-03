const {
  getWorkflowStageKeys,
  isStageComplete,
  isStageWorkComplete,
  STAGE_LABELS,
} = require("./workflowDefaults");
const { MODULES_REQUIRING_SITE_ENGINEER } = require("./moduleSiteEngineerGate");

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

/** SE sign-off is mandatory only when closing the job (end of timeline). */
const validateSiteEngineerSignoffBeforeJobClose = (job) => {
  const wf = job?.workflowEvents || {};
  const missing = [];

  for (const key of MODULES_REQUIRING_SITE_ENGINEER) {
    if (key === "jobCompletion") continue;
    const stage = wf[key];
    if (!stage) continue;

    const stageWasUsed = isStageWorkComplete(job, key);
    if (!stageWasUsed) continue;

    if (stage.siteEngineerStatus !== "Approved") {
      missing.push(STAGE_LABELS[key] || key);
    }
  }

  if (!missing.length) return { ok: true };

  return {
    ok: false,
    message: `Site engineer sign-off required before job closure: ${missing.join(", ")}`,
    missing,
  };
};

module.exports = {
  getPrerequisiteStages,
  validateStageCompletion,
  validateSiteEngineerSignoffBeforeJobClose,
};
