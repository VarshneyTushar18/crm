const mongoose = require('mongoose');

const INVOICE_STATUSES = ['Draft', 'Issued', 'Partially Paid', 'Paid', 'Overdue'];

const invoiceSchema = new mongoose.Schema({
  removed: {
    type: Boolean,
    default: false,
  },

  createdBy: { type: mongoose.Schema.ObjectId, ref: 'Admin', required: true },
  number: {
    type: String,
    required: true,
    unique: true,
  },
  year: {
    type: Number,
    required: true,
  },
  content: String,
  date: {
    type: Date,
    required: true,
  },
  expiredDate: {
    type: Date,
    required: true,
  },
  // Reference to Job instead of Client
  job: {
    type: mongoose.Schema.ObjectId,
    ref: 'Job',
    required: true,
  },
  // Invoice type and basis
  invoiceType: {
    type: String,
    enum: {
      values: ['Progress Payment', 'Variation', 'Final', 'Retention'],
      message: 'Invoice type must be one of: Progress Payment, Variation, Final, Retention'
    },
    required: true,
    default: 'Progress Payment',
  },
  // For progress payments: which stage this invoice is for
  stage: {
    type: String,
    enum: {
      values: [
        'siteMeasurement',
        'drafting',
        'clientApproval',
        'materialPurchasing',
        'fabrication',
        'finishing',
        'installation',
        'jobCompletion'
      ],
      message: 'Stage must be a valid project stage'
    },
  },
  // Percentage of contract value for this invoice
  percentageOfContract: {
    type: Number,
    min: 0,
    max: 100,
    default: 0,
  },
  // Invoice value derived from job contract + variations
  items: [
    {
      itemName: {
        type: String,
        required: true,
      },
      description: {
        type: String,
      },
      quantity: {
        type: Number,
        default: 1,
        required: true,
      },
      price: {
        type: Number,
        required: true,
      },
      total: {
        type: Number,
        required: true,
      },
    },
  ],
  taxRate: {
    type: Number,
    default: 0,
  },
  subTotal: {
    type: Number,
    default: 0,
  },
  taxTotal: {
    type: Number,
    default: 0,
  },
  total: {
    type: Number,
    default: 0,
    required: true,
  },
  currency: {
    type: String,
    default: 'NA',
    uppercase: true,
    required: true,
  },
  // Status controlled by system
  status: {
    type: String,
    enum: {
      values: INVOICE_STATUSES,
      message: 'Status must be one of: Draft, Issued, Partially Paid, Paid, Overdue'
    },
    default: 'Draft',
  },
  // Auto-calculated based on payments
  amountPaid: {
    type: Number,
    default: 0,
  },
  amountDue: {
    type: Number,
    default: 0,
  },
  isOverdue: {
    type: Boolean,
    default: false,
  },
  notes: {
    type: String,
  },
  // Customer Payment Notification fields
  paymentNotified: {
    type: Boolean,
    default: false,
  },
  notificationDate: {
    type: Date,
  },
  paymentRef: {
    type: String,
  },
  paymentMode: {
    type: String,
  },
  pdf: {
    type: String,
  },
  files: [
    {
      id: String,
      name: String,
      path: String,
      description: String,
      isPublic: {
        type: Boolean,
        default: true,
      },
    },
  ],
  updated: {
    type: Date,
    default: Date.now,
  },
  created: {
    type: Date,
    default: Date.now,
  },
});

// Pre-save middleware to calculate amountDue
invoiceSchema.pre('save', function (next) {
  this.amountDue = this.total - this.amountPaid;
  next();
});

// Pre-save middleware to auto-calculate total from contract percentage if applicable
invoiceSchema.pre('save', async function (next) {
  if (this.percentageOfContract > 0 && this.job) {
    const Job = mongoose.model('Job');
    const job = await Job.findById(this.job);
    if (job && job.lockedValue > 0) {
      const calculatedAmount = (job.lockedValue * this.percentageOfContract) / 100;
      // If total is 0 or needs update, set it
      if (this.total === 0 || this.total !== calculatedAmount) {
        this.total = calculatedAmount;
        this.subTotal = calculatedAmount / (1 + (this.taxRate || 0) / 100);
        this.taxTotal = this.total - this.subTotal;
      }
    }
  }
  next();
});

// invoiceSchema.plugin(require('mongoose-autopopulate'));
module.exports = mongoose.model('Invoice', invoiceSchema);
