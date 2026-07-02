const mongoose = require("mongoose");

const CustomerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    companyName: { type: String, default: "", trim: true },
    email: { type: String, lowercase: true, trim: true, default: "" },
    phone: { type: String, default: "", trim: true },
    mobile: { type: String, default: "", trim: true },
    address: { type: String, default: "", trim: true },
    contactPerson: { type: String, default: "", trim: true },

    leadId: { type: mongoose.Schema.Types.ObjectId, ref: "Lead", default: null },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    portalEmail: {
      type: String,
      lowercase: true,
      trim: true,
      default: "",
    },

    portalInvitedAt: {
      type: Date,
      default: null,
    },

    status: {
      type: String,
      enum: ["Active", "Completed"],
      default: "Active",
    },

    addresses: [
      {
        type: {
          type: String,
          enum: ["Billing", "Site", "Office", "Other"],
          default: "Site",
        },
        line1: { type: String, default: "" },
        line2: { type: String, default: "" },
        city: { type: String, default: "" },
        state: { type: String, default: "" },
        postcode: { type: String, default: "" },
        country: { type: String, default: "" },
        isPrimary: { type: Boolean, default: false },
      },
    ],
    contacts: [
      {
        name: { type: String, default: "" },
        role: { type: String, default: "" },
        email: { type: String, default: "" },
        phone: { type: String, default: "" },
        mobile: { type: String, default: "" },
        isPrimary: { type: Boolean, default: false },
      },
    ],
    phones: [
      {
        number: { type: String, default: "" },
        type: {
          type: String,
          enum: ["Mobile", "Office", "Other"],
          default: "Mobile",
        },
        isPrimary: { type: Boolean, default: false },
      },
    ],
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.Customer || mongoose.model("Customer", CustomerSchema);