export const STAGE_LABELS = {
  siteMeasurement: "Site Measurement",
  planning: "Planning",
  scheduling: "Scheduling",
  drafting: "Drafting",
  clientApproval: "Client Approval",
  siteEngineerApproval: "Site Engineer Approval",
  materialPurchasing: "Material Purchasing",
  fabrication: "Fabrication",
  fabricationQc: "Fabrication QC",
  powderCoating: "Powder Coating",
  powderCoatingQc: "Powder Coating QC",
  finishing: "Finishing & QC",
  installation: "Installation",
  jobCompletion: "Job Completion",
};

export const WORKFLOW_STAGE_KEYS_V1 = [
  "siteMeasurement",
  "planning",
  "drafting",
  "clientApproval",
  "materialPurchasing",
  "fabrication",
  "finishing",
  "installation",
  "jobCompletion",
];

export const WORKFLOW_STAGE_KEYS_V2 = [
  "planning",
  "scheduling",
  "siteMeasurement",
  "drafting",
  "siteEngineerApproval",
  "materialPurchasing",
  "fabrication",
  "finishing",
  "installation",
  "jobCompletion",
];

export const WORKFLOW_STAGE_KEYS_V3 = [
  "planning",
  "scheduling",
  "siteMeasurement",
  "drafting",
  "siteEngineerApproval",
  "materialPurchasing",
  "fabrication",
  "fabricationQc",
  "powderCoating",
  "powderCoatingQc",
  "installation",
  "jobCompletion",
];

export const MODULES_REQUIRING_SITE_ENGINEER = [
  "siteMeasurement",
  "planning",
  "scheduling",
  "drafting",
  "materialPurchasing",
  "fabrication",
  "fabricationQc",
  "powderCoating",
  "powderCoatingQc",
  "finishing",
  "installation",
  "jobCompletion",
];

export const STAGE_ROUTES = {
  siteMeasurement: "/admin/site-measurement",
  planning: "/admin/planning",
  scheduling: "/admin/scheduling",
  drafting: "/admin/drafting",
  materialPurchasing: "/admin/material-purchase",
  fabrication: "/admin/fabrication",
  fabricationQc: "/admin/qc",
  powderCoating: "/admin/qc",
  powderCoatingQc: "/admin/qc",
  finishing: "/admin/qc",
  installation: "/admin/installation",
  siteEngineerApproval: "/admin/site-engineer",
};

export function getTimelineWorkflowVersion(jobOrVersion = 2) {
  const version =
    typeof jobOrVersion === "object"
      ? Number(jobOrVersion?.workflowVersion || 2)
      : Number(jobOrVersion || 2);
  return version >= 3 ? version : 3;
}

export function getWorkflowStageKeys(jobOrVersion = 3) {
  const version = getTimelineWorkflowVersion(jobOrVersion);
  if (version >= 3) return WORKFLOW_STAGE_KEYS_V3;
  return version >= 2 ? WORKFLOW_STAGE_KEYS_V2 : WORKFLOW_STAGE_KEYS_V1;
}

export function getTimelineStageKeys(jobOrVersion = 3) {
  return WORKFLOW_STAGE_KEYS_V3;
}

export function buildStagesConfig(jobOrVersion = 3) {
  const keys = getTimelineStageKeys(jobOrVersion);
  return keys.map((key, index) => ({
    key,
    title: `${index + 1}. ${STAGE_LABELS[key] || key}`,
    route: STAGE_ROUTES[key] || null,
  }));
}

export function calcStageCompletionPercent(stageData = {}) {
  if (!stageData || typeof stageData !== "object") return 0;
  if (stageData.isCompleted || stageData.stageStatus === "Complete") return 100;
  if (typeof stageData.progressPercent === "number") {
    return Math.min(100, Math.max(0, Math.round(stageData.progressPercent)));
  }
  if (
    stageData.stageStatus === "Awaiting Site Engineer" ||
    stageData.siteEngineerStatus === "Pending"
  ) {
    return 85;
  }
  const subtasks = Array.isArray(stageData.subtasks) ? stageData.subtasks : [];
  if (subtasks.length) {
    const done = subtasks.filter((t) => t.isCompleted).length;
    return Math.round((done / subtasks.length) * 100);
  }
  if (stageData.stageStatus === "In Progress" || stageData.moduleWorkComplete) return 50;
  return 0;
}

export function calcJobCompletionPercent(workflowEvents = {}, jobOrVersion = 3) {
  const keys = getTimelineStageKeys(jobOrVersion);
  if (!keys.length) return 0;
  let total = 0;
  for (const key of keys) {
    total += calcStageCompletionPercent(workflowEvents?.[key]);
  }
  return Math.round(total / keys.length);
}
