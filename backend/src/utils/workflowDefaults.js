const WORKFLOW_STAGE_KEYS_V1 = [
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

const WORKFLOW_STAGE_KEYS_V2 = [
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

const WORKFLOW_STAGE_KEYS_V3 = [
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

// backward-compatible export
const WORKFLOW_STAGE_KEYS = WORKFLOW_STAGE_KEYS_V1;

const STAGE_STATUS = ["Pending", "In Progress", "Complete", "Awaiting Site Engineer"];

const STAGE_LABELS = {
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

function getTimelineWorkflowVersion(jobOrVersion = 1) {
  const version =
    typeof jobOrVersion === "object"
      ? Number(jobOrVersion?.workflowVersion || 1)
      : Number(jobOrVersion || 1);
  return version >= 3 ? version : 3;
}

function getWorkflowStageKeys(jobOrVersion) {
  const version = getTimelineWorkflowVersion(jobOrVersion);
  if (version >= 3) return WORKFLOW_STAGE_KEYS_V3;
  return version >= 2 ? WORKFLOW_STAGE_KEYS_V2 : WORKFLOW_STAGE_KEYS_V1;
}

function getAllWorkflowStageKeys() {
  return [...new Set([...WORKFLOW_STAGE_KEYS_V1, ...WORKFLOW_STAGE_KEYS_V2, ...WORKFLOW_STAGE_KEYS_V3])];
}

function defaultStageFields() {
  return {
    stageStatus: "Pending",
    isCompleted: false,
    subtasks: [],
  };
}

function buildDefaultWorkflowEvents(workflowVersion = 1) {
  const wf = {
    siteMeasurement: {
      ...defaultStageFields(),
      scheduledDate: null,
      expectedHours: 0,
      actualHours: 0,
    },
    planning: {
      ...defaultStageFields(),
      approvalDate: null,
      confirmationRecord: "",
      attachmentUrl: "",
    },
    scheduling: {
      ...defaultStageFields(),
      scheduledStart: null,
      scheduledEnd: null,
      totalPlannedHours: 0,
      assignedRoles: [],
    },
    drafting: {
      ...defaultStageFields(),
      startExpected: null,
      startActual: null,
      completionExpected: null,
      completionActual: null,
      documentUrl: "",
    },
    clientApproval: {
      ...defaultStageFields(),
      approvalDate: null,
      confirmationRecord: "",
      attachmentUrl: "",
    },
    siteEngineerApproval: {
      ...defaultStageFields(),
      approvalDate: null,
      approvedBy: "",
      lastRejectedAt: null,
      revisionCount: 0,
    },
    materialPurchasing: {
      ...defaultStageFields(),
      requestDate: null,
      supplierRef: "",
      selectedSupplierId: null,
      selectedQuotationRef: "",
    },
    fabrication: {
      ...defaultStageFields(),
      startExpectedHours: 0,
      startActualHours: 0,
      completionExpectedHours: 0,
      completionActualHours: 0,
      jobCards: "",
    },
    fabricationQc: {
      ...defaultStageFields(),
      approvalDate: null,
      checkedBy: "",
    },
    powderCoating: {
      ...defaultStageFields(),
      startActual: null,
      completionActual: null,
      batchRef: "",
    },
    powderCoatingQc: {
      ...defaultStageFields(),
      approvalDate: null,
      checkedBy: "",
    },
    finishing: {
      ...defaultStageFields(),
      startExpected: null,
      startActual: null,
      completionExpected: null,
      completionActual: null,
      qualityCheckIndicator: "",
    },
    installation: {
      ...defaultStageFields(),
      scheduledDate: null,
      expectedHours: 0,
      actualHours: 0,
      installer: "",
    },
    jobCompletion: {
      ...defaultStageFields(),
      signatureCapture: "",
      completionDate: null,
      pictures: [],
      documents: [],
    },
  };

  if (Number(workflowVersion) < 2) {
    return wf;
  }

  return wf;
}

function normalizeStageStatus(stageData = {}) {
  if (stageData.isCompleted) {
    stageData.stageStatus = "Complete";
  } else if (stageData.stageStatus === "Complete" && !stageData.isCompleted) {
    stageData.stageStatus = "Pending";
  } else if (!stageData.stageStatus) {
    stageData.stageStatus = "Pending";
  }
  return stageData;
}

function calcStageCompletionPercent(stageData = {}) {
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

function calcJobCompletionPercent(workflowEvents = {}, jobOrVersion = 1) {
  const keys = getWorkflowStageKeys(jobOrVersion);
  if (!keys.length) return 0;

  let total = 0;
  for (const key of keys) {
    total += calcStageCompletionPercent(workflowEvents[key]);
  }

  return Math.round(total / keys.length);
}

function syncStageFromSubtasks(stageData = {}) {
  const subtasks = Array.isArray(stageData.subtasks) ? stageData.subtasks : [];
  if (!subtasks.length) return stageData;

  const allDone = subtasks.every((t) => t.isCompleted);
  const anyDone = subtasks.some((t) => t.isCompleted);

  if (allDone) {
    stageData.stageStatus = "Complete";
    stageData.isCompleted = true;
    if (!stageData.completedAt) stageData.completedAt = new Date();
  } else if (anyDone) {
    stageData.stageStatus = "In Progress";
    stageData.isCompleted = false;
  } else {
    stageData.stageStatus = "Pending";
    stageData.isCompleted = false;
  }

  return stageData;
}

function isStageComplete(job, stageKey) {
  const wf = job?.workflowEvents?.[stageKey];
  if (!wf) return false;

  const workDone = !!(wf.isCompleted || wf.stageStatus === "Complete");
  if (!workDone) return false;

  const seStatus = wf.siteEngineerStatus;
  if (!seStatus || seStatus === "NotRequired" || seStatus === "Approved") {
    return true;
  }

  return false;
}

function isStageAwaitingSiteEngineer(job, stageKey) {
  const wf = job?.workflowEvents?.[stageKey];
  return (
    wf?.siteEngineerStatus === "Pending" ||
    wf?.stageStatus === "Awaiting Site Engineer"
  );
}

/** Expand legacy v1/v2 jobs so timeline shows Fabrication QC → Powder Coating → Powder Coating QC */
function toPlainWorkflowEvents(workflowEvents) {
  if (!workflowEvents) return {};
  if (typeof workflowEvents.toObject === "function") {
    return workflowEvents.toObject({ flattenMaps: true, depopulate: true });
  }
  try {
    return JSON.parse(JSON.stringify(workflowEvents));
  } catch {
    return { ...workflowEvents };
  }
}

function ensureV3WorkflowEvents(workflowEvents = {}) {
  const plain = toPlainWorkflowEvents(workflowEvents);
  const defaults = buildDefaultWorkflowEvents(3);
  const wf = {};

  for (const key of getAllWorkflowStageKeys()) {
    const existing = plain[key];
    if (existing && typeof existing === "object" && !Array.isArray(existing)) {
      wf[key] = JSON.parse(JSON.stringify(existing));
    } else {
      wf[key] = JSON.parse(JSON.stringify(defaults[key] || defaultStageFields()));
    }
  }

  const finishing = wf.finishing || {};
  if (finishing.isCompleted || finishing.stageStatus === "Complete") {
    if (!wf.fabricationQc?.isCompleted) {
      wf.fabricationQc = {
        ...(wf.fabricationQc || {}),
        ...finishing,
        stageStatus: finishing.stageStatus || "Complete",
        isCompleted: true,
      };
    }
  }

  return wf;
}

/** Set workflow stage objects on a Mongoose job without casting undefined */
function applyWorkflowEventsToJob(job, workflowEvents) {
  const wf = ensureV3WorkflowEvents(workflowEvents);
  if (!job.workflowEvents) job.workflowEvents = {};
  for (const key of getAllWorkflowStageKeys()) {
    if (wf[key]) {
      job.set(`workflowEvents.${key}`, wf[key]);
    }
  }
  job.markModified("workflowEvents");
  return wf;
}

async function migrateJobWorkflowToV3(job) {
  if (!job) return {};
  if (Number(job.workflowVersion || 1) >= 3) {
    return ensureV3WorkflowEvents(job.workflowEvents);
  }
  applyWorkflowEventsToJob(job, job.workflowEvents);
  job.workflowVersion = 3;
  await job.save();
  return ensureV3WorkflowEvents(job.workflowEvents);
}

module.exports = {
  WORKFLOW_STAGE_KEYS,
  WORKFLOW_STAGE_KEYS_V1,
  WORKFLOW_STAGE_KEYS_V2,
  WORKFLOW_STAGE_KEYS_V3,
  STAGE_STATUS,
  STAGE_LABELS,
  getWorkflowStageKeys,
  getAllWorkflowStageKeys,
  buildDefaultWorkflowEvents,
  normalizeStageStatus,
  calcJobCompletionPercent,
  calcStageCompletionPercent,
  syncStageFromSubtasks,
  isStageComplete,
  isStageAwaitingSiteEngineer,
  ensureV3WorkflowEvents,
  getTimelineWorkflowVersion,
  toPlainWorkflowEvents,
  applyWorkflowEventsToJob,
  migrateJobWorkflowToV3,
};
