const mongoose = require("mongoose");

const KANBAN_STATUSES = [
  "To Schedule",
  "Scheduled",
  "Material Purchase",
  "Fabrication",
  "QC",
  "Ready for Installation",
  "Completed",
];

const PRIORITIES = ["Low", "Medium", "High", "Urgent"];

const KanbanTaskSchema = new mongoose.Schema(
  {
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
      required: true,
      index: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      default: "",
      trim: true,
    },

    plannedStart: {
      type: String,
      default: "",
      trim: true,
    },

    plannedEnd: {
      type: String,
      default: "",
      trim: true,
    },

    priority: {
      type: String,
      enum: PRIORITIES,
      default: "Medium",
    },

    assignedTeam: {
      type: String,
      default: "",
      trim: true,
    },

    status: {
      type: String,
      enum: KANBAN_STATUSES,
      default: "To Schedule",
    },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.KanbanTask || mongoose.model("KanbanTask", KanbanTaskSchema);