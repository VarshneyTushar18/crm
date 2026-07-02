const mongoose = require("mongoose");

const RfqItemSchema = new mongoose.Schema(
  {
    itemName: { type: String, required: true, trim: true },
    specification: { type: String, default: "", trim: true },
    quantity: { type: Number, default: 0, min: 0 },
    unit: { type: String, default: "Nos", trim: true },
  },
  { _id: false }
);

const VendorQuoteSchema = new mongoose.Schema(
  {
    supplierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Supplier",
      required: true,
    },
    quotedAmount: { type: Number, default: 0, min: 0 },
    leadTimeDays: { type: Number, default: 0, min: 0 },
    notes: { type: String, default: "", trim: true },
    documentUrl: { type: String, default: "", trim: true },
    receivedAt: { type: Date, default: null },
    isSelected: { type: Boolean, default: false },
  },
  { _id: true }
);

const RfqSchema = new mongoose.Schema(
  {
    rfqNumber: { type: String, unique: true, sparse: true, trim: true },
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
      required: true,
      index: true,
    },
    title: { type: String, default: "", trim: true },
    items: { type: [RfqItemSchema], default: [] },
    supplierIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Supplier" }],
    vendorQuotes: { type: [VendorQuoteSchema], default: [] },
    status: {
      type: String,
      enum: ["Draft", "Sent", "Responses Received", "Awarded", "Cancelled"],
      default: "Draft",
    },
    sentAt: { type: Date, default: null },
    remarks: { type: String, default: "", trim: true },
  },
  { timestamps: true }
);

RfqSchema.pre("save", async function (next) {
  if (this.rfqNumber) return next();
  const count = await mongoose.model("Rfq").countDocuments();
  this.rfqNumber = `RFQ-${String(count + 1).padStart(4, "0")}`;
  next();
});

module.exports = mongoose.models.Rfq || mongoose.model("Rfq", RfqSchema);
