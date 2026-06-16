const mongoose = require("mongoose");

const MATERIAL_STATUS = [
  "Pending",
  "Ordered",
  "Partially Received",
  "Received",
  "Cancelled",
];

const UNITS = ["Nos", "Meter", "Sqft", "Kg", "Set"];

const MaterialPurchaseSchema = new mongoose.Schema(
  {
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
      required: true,
      index: true,
    },

    itemName: {
      type: String,
      required: true,
      trim: true,
    },

    category: {
      type: String,
      default: "",
      trim: true,
    },

    specification: {
      type: String,
      default: "",
      trim: true,
    },

    unit: {
      type: String,
      enum: UNITS,
      default: "Nos",
    },

    requiredQty: {
      type: Number,
      default: 0,
      min: 0,
    },

    orderedQty: {
      type: Number,
      default: 0,
      min: 0,
    },

    receivedQty: {
      type: Number,
      default: 0,
      min: 0,
    },

    supplier: {
      type: String,
      default: "",
      trim: true,
    },

    expectedDelivery: {
      type: String,
      default: "",
      trim: true,
    },

    status: {
      type: String,
      enum: MATERIAL_STATUS,
      default: "Pending",
    },

    remarks: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.MaterialPurchase ||
  mongoose.model("MaterialPurchase", MaterialPurchaseSchema);