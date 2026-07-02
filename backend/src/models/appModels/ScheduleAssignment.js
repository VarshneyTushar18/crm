const mongoose = require("mongoose");

const scheduleAssignmentSchema = new mongoose.Schema(
  {
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
      required: true,
      index: true,
    },
    assignmentType: {
      type: String,
      enum: [
        "SiteMeasurement",
        "Drafting",
        "Fabrication",
        "Installation",
        "General",
      ],
      default: "General",
    },
    role: {
      type: String,
      enum: ["Site Engineer", "Drafter", "Fabricator", "Installer", "Other"],
      default: "Other",
    },
    assigneeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
    },
    assigneeName: { type: String, trim: true, default: "" },
    teams: {
      type: [String],
      default: [],
    },
    assignees: [
      {
        assigneeId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Employee",
          default: null,
        },
        assigneeName: { type: String, trim: true, default: "" },
      },
    ],
    title: { type: String, trim: true, required: true },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    totalHours: { type: Number, default: 0 },
    travelTimeMinutes: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["Scheduled", "In Progress", "Completed", "Cancelled", "Delayed"],
      default: "Scheduled",
    },
    location: { type: String, trim: true, default: "" },
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
    estimatedArrival: { type: Date, default: null },
    mapsUrl: { type: String, trim: true, default: "" },
    notes: { type: String, trim: true, default: "" },
    attachments: [
      {
        fileUrl: { type: String, trim: true, required: true },
        originalName: { type: String, trim: true, default: "" },
      },
    ],
    workflowStageKey: { type: String, trim: true, default: "scheduling" },
    createdBy: { type: String, trim: true, default: "" },
    updatedBy: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.ScheduleAssignment ||
  mongoose.model("ScheduleAssignment", scheduleAssignmentSchema);
