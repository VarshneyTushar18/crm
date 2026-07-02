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

const STAGE_MANUAL_FIELDS = {
  siteMeasurement: [
    { name: "scheduledDate", label: "Scheduled Date", type: "date" },
    { name: "expectedHours", label: "Expected Hours", type: "number" },
    { name: "actualHours", label: "Actual Hours", type: "number" },
  ],
  planning: [
    { name: "approvalDate", label: "Approval Date", type: "date" },
    { name: "confirmationRecord", label: "Confirmation Record", type: "text" },
    { name: "attachmentUrl", label: "Attachment URL", type: "text" },
  ],
  scheduling: [
    { name: "scheduledDate", label: "Scheduled Date", type: "date" },
    { name: "notes", label: "Notes", type: "text" },
  ],
  drafting: [
    { name: "startExpected", label: "Start Expected", type: "date" },
    { name: "startActual", label: "Start Actual", type: "date" },
    { name: "completionExpected", label: "Completion Expected", type: "date" },
    { name: "completionActual", label: "Completion Actual", type: "date" },
    { name: "documentUrl", label: "Document URL", type: "text" },
  ],
  clientApproval: [
    { name: "approvalDate", label: "Approval Date", type: "date" },
    { name: "confirmationRecord", label: "Confirmation Record", type: "text" },
    { name: "attachmentUrl", label: "Attachment URL", type: "text" },
  ],
  siteEngineerApproval: [
    { name: "approvalDate", label: "Approval Date", type: "date" },
    { name: "approvedBy", label: "Checked By", type: "text" },
    { name: "comments", label: "Comments", type: "text" },
  ],
  materialPurchasing: [
    { name: "requestDate", label: "Request Date", type: "date" },
    { name: "supplierRef", label: "Supplier Ref", type: "text" },
  ],
  fabrication: [
    { name: "startExpectedHours", label: "Start Expected Hours", type: "number" },
    { name: "startActualHours", label: "Start Actual Hours", type: "number" },
    { name: "completionExpectedHours", label: "Completion Expected Hours", type: "number" },
    { name: "completionActualHours", label: "Completion Actual Hours", type: "number" },
    { name: "jobCards", label: "Job Cards Info", type: "text" },
  ],
  fabricationQc: [
    { name: "approvalDate", label: "QC Date", type: "date" },
    { name: "checkedBy", label: "Checked By", type: "text" },
  ],
  powderCoating: [
    { name: "startActual", label: "Start Date", type: "date" },
    { name: "completionActual", label: "Completion Date", type: "date" },
    { name: "batchRef", label: "Batch Ref", type: "text" },
  ],
  powderCoatingQc: [
    { name: "approvalDate", label: "QC Date", type: "date" },
    { name: "checkedBy", label: "Checked By", type: "text" },
  ],
  finishing: [
    { name: "startExpected", label: "Start Expected", type: "date" },
    { name: "startActual", label: "Start Actual", type: "date" },
    { name: "completionExpected", label: "Completion Expected", type: "date" },
    { name: "completionActual", label: "Completion Actual", type: "date" },
    { name: "qualityCheckIndicator", label: "QC Indicator", type: "text" },
  ],
  installation: [
    { name: "scheduledDate", label: "Scheduled Date", type: "date" },
    { name: "expectedHours", label: "Expected Hours", type: "number" },
    { name: "actualHours", label: "Actual Hours", type: "number" },
    { name: "installer", label: "Assigned Installer", type: "text" },
  ],
  jobCompletion: [
    { name: "completionDate", label: "Completion Date", type: "date" },
    { name: "signatureCapture", label: "Signature (Text/Ref)", type: "text" },
  ],
};

const isManualFieldFilled = (field, value) => {
  if (field.type === "number") {
    if (value === null || value === undefined || value === "") return false;
    const num = Number(value);
    return !Number.isNaN(num) && num > 0;
  }

  if (field.type === "date") {
    if (!value) return false;
    const date = new Date(value);
    return !Number.isNaN(date.getTime());
  }

  return String(value ?? "").trim().length > 0;
};

const validateStageManualFields = (stageKey, data = {}) => {
  const fields = STAGE_MANUAL_FIELDS[stageKey] || [];
  if (!fields.length) return { ok: true, missing: [] };

  const missing = fields
    .filter((field) => !isManualFieldFilled(field, data[field.name]))
    .map((field) => field.label || field.name);

  if (!missing.length) return { ok: true, missing: [] };

  const stageLabel = STAGE_LABELS[stageKey] || stageKey;
  return {
    ok: false,
    missing,
    message: `${stageLabel}: fill all required fields before closing — ${missing.join(", ")}`,
  };
};

module.exports = {
  STAGE_MANUAL_FIELDS,
  STAGE_LABELS,
  isManualFieldFilled,
  validateStageManualFields,
};
