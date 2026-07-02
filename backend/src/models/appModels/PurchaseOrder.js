const mongoose = require("mongoose");

const PO_STATUSES = [
  "Ordered",
  "Delayed",
  "Partially Received",
  "Received",
  "Cancelled",
];

const PoLineSchema = new mongoose.Schema(
  {
    itemName: { type: String, required: true, trim: true },
    orderedQty: { type: Number, default: 0, min: 0 },
    receivedQty: { type: Number, default: 0, min: 0 },
    unit: { type: String, default: "Nos", trim: true },
    unitPrice: { type: Number, default: 0, min: 0 },
  },
  { _id: true }
);

const PurchaseOrderSchema = new mongoose.Schema(
  {
    poNumber: { type: String, unique: true, sparse: true, trim: true },
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
      required: true,
      index: true,
    },
    supplierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Supplier",
      required: true,
    },
    rfqId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Rfq",
      default: null,
    },
    selectedQuotationRef: { type: String, default: "", trim: true },
    lines: { type: [PoLineSchema], default: [] },
    status: {
      type: String,
      enum: PO_STATUSES,
      default: "Ordered",
    },
    delayReason: { type: String, default: "", trim: true },
    expectedDelivery: { type: String, default: "", trim: true },
    orderedAt: { type: Date, default: Date.now },
    receivedAt: { type: Date, default: null },
    remarks: { type: String, default: "", trim: true },
  },
  { timestamps: true }
);

PurchaseOrderSchema.pre("save", async function (next) {
  if (this.poNumber) return next();
  const count = await mongoose.model("PurchaseOrder").countDocuments();
  this.poNumber = `PO-${String(count + 1).padStart(4, "0")}`;
  next();
});

module.exports =
  mongoose.models.PurchaseOrder ||
  mongoose.model("PurchaseOrder", PurchaseOrderSchema);
