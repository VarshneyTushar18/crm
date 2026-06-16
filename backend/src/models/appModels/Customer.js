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
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.Customer || mongoose.model("Customer", CustomerSchema);