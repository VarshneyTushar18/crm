const mongoose = require("mongoose");
const { getAllWorkflowStageKeys } = require("../../utils/workflowDefaults");

const SYSTEM_STATES = ["New", "Active", "Completed", "Closed"];

const SubtaskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    isCompleted: { type: Boolean, default: false },
    completedAt: { type: Date, default: null },
  },
  { _id: true }
);

const stageMeta = () => ({
  stageStatus: {
    type: String,
    enum: ["Pending", "In Progress", "Complete", "Awaiting Site Engineer"],
    default: "Pending",
  },
  subtasks: { type: [SubtaskSchema], default: [] },
  isCompleted: { type: Boolean, default: false },
  completedBy: String,
  completedAt: Date,
  moduleWorkComplete: { type: Boolean, default: false },
  siteEngineerStatus: {
    type: String,
    enum: ["NotRequired", "Pending", "Approved", "Rejected"],
    default: "NotRequired",
  },
  siteEngineerCheckedBy: String,
  siteEngineerCheckedAt: Date,
  siteEngineerComments: String,
});

const JobSchema = new mongoose.Schema(
  {
    jobId: { type: String, required: true, unique: true, index: true, trim: true },
    customer: { type: String, default: "", trim: true },
    site: { type: String, default: "", trim: true },
    siteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Site",
      default: null,
    },
    removed: {
      type: Boolean,
      default: false,
    },
    stage: { type: String, default: "Backlog" },

    workflowVersion: { type: Number, default: 3 },

    // Financial Inheritance
    lockedValue: { type: Number, default: 0 },
    totalInvoiced: { type: Number, default: 0 },
    totalPaid: { type: Number, default: 0 },

    // Variations tracking
    variations: [
      {
        description: { type: String, required: true },
        amount: { type: Number, required: true },
        status: { type: String, enum: ['Draft', 'Approved', 'Rejected'], default: 'Draft' },
        date: { type: Date, default: Date.now },
        invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' },
      }
    ],

    // Retention tracking
    retentionPercentage: { type: Number, default: 0, min: 0, max: 100 },

    billingMilestones: {
      triggered: { type: [Number], default: [] },
    },

    // System Calculated State
    systemState: { type: String, enum: SYSTEM_STATES, default: "New" },

    // Optional manual override (20/40/60/80/100); null = auto from workflow
    manualProgressPercent: { type: Number, default: null, min: 0, max: 100 },

    // System Calculated / Manual Conditions
    conditions: {
      isOverdue: { type: Boolean, default: false },
      onHold: { type: Boolean, default: false },
      holdReason: { type: String, default: "" },
      hasDefects: { type: Boolean, default: false },
    },

    // Embedded 8 Workflow Stages
    workflowEvents: {
      siteMeasurement: {
        ...stageMeta(),
        scheduledDate: Date,
        expectedHours: Number,
        actualHours: Number,
      },
      drafting: {
        ...stageMeta(),
        startExpected: Date,
        startActual: Date,
        completionExpected: Date,
        completionActual: Date,
        documentUrl: String,
      },
      planning: {
        ...stageMeta(),
        approvalDate: Date,
        confirmationRecord: String,
        attachmentUrl: String,
      },
      scheduling: {
        ...stageMeta(),
        scheduledStart: Date,
        scheduledEnd: Date,
        totalPlannedHours: Number,
        assignedRoles: [String],
      },
      clientApproval: {
        ...stageMeta(),
        approvalDate: Date,
        confirmationRecord: String,
        attachmentUrl: String,
      },
      siteEngineerApproval: {
        ...stageMeta(),
        approvalDate: Date,
        approvedBy: String,
        lastRejectedAt: Date,
        revisionCount: { type: Number, default: 0 },
      },
      materialPurchasing: {
        ...stageMeta(),
        requestDate: Date,
        supplierRef: String,
        selectedSupplierId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Supplier",
          default: null,
        },
        selectedQuotationRef: { type: String, default: "" },
      },
      fabrication: {
        ...stageMeta(),
        startExpectedHours: Number,
        startActualHours: Number,
        completionExpectedHours: Number,
        completionActualHours: Number,
        jobCards: String,
      },
      fabricationQc: {
        ...stageMeta(),
        approvalDate: Date,
        checkedBy: String,
      },
      powderCoating: {
        ...stageMeta(),
        startActual: Date,
        completionActual: Date,
        batchRef: String,
      },
      powderCoatingQc: {
        ...stageMeta(),
        approvalDate: Date,
        checkedBy: String,
      },
      finishing: {
        ...stageMeta(),
        startExpected: Date,
        startActual: Date,
        completionExpected: Date,
        completionActual: Date,
        qualityCheckIndicator: String,
      },
      installation: {
        ...stageMeta(),
        scheduledDate: Date,
        expectedHours: Number,
        actualHours: Number,
        installer: String,
      },
      jobCompletion: {
        ...stageMeta(),
        signatureCapture: String,
        completionDate: Date,
        pictures: [String],
        documents: [String],
      },
    },

    // ===== Linked References =====
    leadId: { type: mongoose.Schema.Types.ObjectId, ref: "Lead", default: null },
    quoteId: { type: mongoose.Schema.Types.ObjectId, ref: "Quote", default: null },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", default: null },
  },
  { timestamps: true }
);

// auto state calculation before save
JobSchema.pre("save", async function (next) {
  const wf = this.workflowEvents;
  if (!wf) return next();

  const isComplete = wf.jobCompletion?.isCompleted;

  // Check financial closure
  let financialClosed = false;

  if (isComplete) {
    const revisedValue = this.lockedValue + this.variations
      .filter(v => v.status === 'Approved')
      .reduce((sum, v) => sum + (v.amount || 0), 0);

    // Check if everything is invoiced and paid
    const everythingInvoiced = Math.abs(this.totalInvoiced - revisedValue) < 0.01;
    const everythingPaid = Math.abs(this.totalPaid - this.totalInvoiced) < 0.01;

    // Check if there are any draft invoices
    const Invoice = mongoose.model('Invoice');
    const draftInvoices = await Invoice.countDocuments({ job: this._id, status: 'Draft', removed: false });

    if (everythingInvoiced && everythingPaid && draftInvoices === 0) {
      financialClosed = true;
    }
  }

  let anyStarted = false;
  const stages = getAllWorkflowStageKeys();

  for (const s of stages) {
    if (wf[s]) {
      if (
        wf[s].isCompleted ||
        wf[s].actualHours ||
        wf[s].startActual ||
        wf[s].approvalDate ||
        wf[s].requestDate ||
        wf[s].scheduledDate ||
        wf[s].scheduledStart
      ) {
        anyStarted = true;
        break;
      }
    }
  }

  // Derive highest possible system State
  // Cannot be manually overridden due to computed precedence.
  if (financialClosed) {
    this.systemState = "Closed";
  } else if (isComplete) {
    this.systemState = "Completed";
  } else if (anyStarted) {
    this.systemState = "Active";
  } else {
    this.systemState = "New";
  }

  next();
});

// Always register the CRM Job schema (mobile legacy model uses "MobileJob").
if (mongoose.models.Job) {
  delete mongoose.models.Job;
  delete mongoose.connection.models.Job;
}
module.exports = mongoose.model("Job", JobSchema);