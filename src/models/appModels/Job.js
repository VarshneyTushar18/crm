const mongoose = require("mongoose");

const SYSTEM_STATES = ["New", "Active", "Completed", "Closed"];

const JobSchema = new mongoose.Schema(
  {
    jobId: { type: String, required: true, unique: true, index: true, trim: true },
    customer: { type: String, default: "", trim: true },
    site: { type: String, default: "", trim: true },
    removed: {
      type: Boolean,
      default: false,
    },
    stage: { type: String, default: "Backlog" },

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

    // System Calculated State
    systemState: { type: String, enum: SYSTEM_STATES, default: "New" },

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
        scheduledDate: Date,
        expectedHours: Number,
        actualHours: Number,
        isCompleted: { type: Boolean, default: false },
        completedBy: String,
        completedAt: Date,
      },
      drafting: {
        startExpected: Date,
        startActual: Date,
        completionExpected: Date,
        completionActual: Date,
        documentUrl: String,
        isCompleted: { type: Boolean, default: false },
        completedBy: String,
        completedAt: Date,
      },
      planning: {
        approvalDate: Date,
        confirmationRecord: String,
        attachmentUrl: String,
        isCompleted: { type: Boolean, default: false },
        completedBy: String,
        completedAt: Date,
      },
      clientApproval: {
        approvalDate: Date,
        confirmationRecord: String,
        attachmentUrl: String,
        isCompleted: { type: Boolean, default: false },
        completedBy: String,
        completedAt: Date,
      },
      materialPurchasing: {
        requestDate: Date,
        supplierRef: String,
        isCompleted: { type: Boolean, default: false },
        completedBy: String,
        completedAt: Date,
      },
      fabrication: {
        startExpectedHours: Number,
        startActualHours: Number,
        completionExpectedHours: Number,
        completionActualHours: Number,
        jobCards: String,
        isCompleted: { type: Boolean, default: false },
        completedBy: String,
        completedAt: Date,
      },
      finishing: {
        startExpected: Date,
        startActual: Date,
        completionExpected: Date,
        completionActual: Date,
        qualityCheckIndicator: String,
        isCompleted: { type: Boolean, default: false },
        completedBy: String,
        completedAt: Date,
      },
      installation: {
        scheduledDate: Date,
        expectedHours: Number,
        actualHours: Number,
        installer: String,
        isCompleted: { type: Boolean, default: false },
        completedBy: String,
        completedAt: Date,
      },
      jobCompletion: {
        signatureCapture: String,
        completionDate: Date,
        pictures: [String],
        documents: [String],
        isCompleted: { type: Boolean, default: false },
        completedBy: String,
        completedAt: Date,
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
  const stages = [
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

  for (const s of stages) {
    if (wf[s]) {
      if (
        wf[s].isCompleted ||
        wf[s].actualHours ||
        wf[s].startActual ||
        wf[s].approvalDate ||
        wf[s].requestDate ||
        wf[s].scheduledDate
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