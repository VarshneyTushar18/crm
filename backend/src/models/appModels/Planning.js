const mongoose = require("mongoose");

const PLANNING_STATUS = ["Pending", "In Progress", "Done"];

const PlanningSchema = new mongoose.Schema(
  {
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
      required: true,
      index: true,
    },

    task: {
      type: String,
      required: true,
      trim: true,
    },

    start: {
      type: String,
      required: true,
      trim: true,
    },

    end: {
      type: String,
      required: true,
      trim: true,
    },

    workers: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },

    hours: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },

    status: {
      type: String,
      enum: PLANNING_STATUS,
      default: "Pending",
    },

    country: {
      type: String,
      trim: true,
      default: "",
    },

    location: {
      type: String,
      trim: true,
      default: "",
    },

    city: {
      type: String,
      trim: true,
      default: "",
    },

    state: {
      type: String,
      trim: true,
      default: "",
    },

    mapsUrl: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.Planning || mongoose.model("Planning", PlanningSchema);