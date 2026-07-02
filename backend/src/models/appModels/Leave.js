const mongoose = require("mongoose");

const leaveSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      index: true,
    },
    employeeName: { type: String, default: "", trim: true },
    leaveType: {
      type: String,
      enum: ["Annual", "Sick", "Unpaid", "Other"],
      default: "Annual",
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    days: { type: Number, default: 1, min: 0.5 },
    reason: { type: String, default: "", trim: true },
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending",
    },
    reviewedBy: { type: String, default: "" },
    reviewedAt: { type: Date, default: null },
    removed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.Leave || mongoose.model("Leave", leaveSchema);
