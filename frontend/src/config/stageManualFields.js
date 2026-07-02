export const STAGE_MANUAL_FIELDS = {
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

export const isManualFieldFilled = (field, value) => {
  if (field.type === "number") {
    if (value === null || value === undefined || value === "") return false;
    const num = Number(value);
    return !Number.isNaN(num) && num > 0;
  }

  if (field.type === "date") {
    if (!value) return false;
    return value?.isValid?.() ?? !Number.isNaN(new Date(value).getTime());
  }

  return String(value ?? "").trim().length > 0;
};

export const getStageManualFieldRules = (field, isCompleting) => {
  if (!isCompleting) return [];

  const base = [{ required: true, message: `${field.label} is required to close this stage` }];

  if (field.type === "number") {
    return [
      ...base,
      {
        type: "number",
        min: 0.01,
        message: `${field.label} must be greater than 0`,
      },
    ];
  }

  return base;
};
