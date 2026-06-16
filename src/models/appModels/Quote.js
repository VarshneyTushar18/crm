const mongoose = require("mongoose");

const QuoteSchema = new mongoose.Schema(
  {
    quoteNumber: { type: String, unique: true, index: true },

    // Quote Configuration (for unique ID)
    valueLevel: { type: String, enum: ["High", "Medium", "Low"], default: "Medium" },
    priority: { type: Number, enum: [1, 2, 3], default: 2 },
    categoryCode: { type: String, enum: ["Commercial", "Residential"], default: "Residential" },
    removed: {
      type: Boolean,
      default: false,
    },
    materialCode: { type: String, enum: ["Aluminium", "Glass", "Stainless Steel", "Wood", "Other"], default: "Aluminium" },

    // Versioning
    version: { type: Number, default: 1 },
    revisions: { type: [mongoose.Schema.Types.Mixed], default: [] }, // Array to hold past versions

    // linkages
    leadId: { type: mongoose.Schema.Types.ObjectId, ref: "Lead", required: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", default: null },
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: "Job", default: null },

    // customer snapshot (from lead)
    customerName: { type: String, required: true, trim: true },
    contactPerson: { type: String, default: "", trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, default: "", trim: true },

    // project/site
    siteAddress: { type: String, required: true, trim: true },
    leadSource: { type: String, default: "", trim: true },

    // scope (mandatory as per workflow)
    scope: { type: String, required: true, trim: true },
    inclusions: { type: String, required: true, trim: true },
    exclusions: { type: String, required: true, trim: true },
    assumptions: { type: String, default: "", trim: true },

    // quote details
    totalAmount: { type: Number, required: true, min: 0 },
    validUntil: { type: Date, required: true },

    status: {
      type: String,
      enum: ["Draft", "Sent", "Accepted", "Rejected"], // Strict rules now
      default: "Draft",
    },

    // Audit Info for Acceptance
    acceptanceAudit: {
      method: String,
      acceptedBy: String,
      acceptedAt: Date
    },

    approvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// auto quote number
QuoteSchema.pre("save", async function (next) {
  if (!this.quoteNumber) {
    const dt = new Date();
    const start = new Date(dt.getFullYear(), 0, 1);
    const diff = (dt - start + (start.getTimezoneOffset() - dt.getTimezoneOffset()) * 60000);
    const oneWeek = 1000 * 60 * 60 * 24 * 7;
    const weekNum = Math.ceil(diff / oneWeek);
    
    // Formatting parts
    const wStr = String(weekNum).padStart(2, "0");
    const yStr = String(dt.getFullYear()).slice(-2);
    const vC = this.valueLevel ? this.valueLevel.charAt(0).toUpperCase() : "M";
    const pC = this.priority || 2;
    const cC = this.categoryCode ? this.categoryCode.charAt(0).toUpperCase() : "R";
    const mC = this.materialCode ? this.materialCode.charAt(0).toUpperCase() : "A";

    const total = await mongoose.models.Quote.countDocuments();
    const seq = total + 1;

    // Example: H1C0126A1
    this.quoteNumber = `${vC}${pC}${cC}${wStr}${yStr}${mC}${seq}`;
  }

  // Handle auto audit tracking
  if (this.isModified("status")) {
    if (this.status === "Accepted" && !this.approvedAt) {
      this.approvedAt = new Date();
      if (this.acceptanceAudit && !this.acceptanceAudit.acceptedAt) {
        this.acceptanceAudit.acceptedAt = new Date();
      }
    }
    if (this.status !== "Accepted") {
      this.approvedAt = null;
    }
  }

  next();
});

module.exports = mongoose.models.Quote || mongoose.model("Quote", QuoteSchema);