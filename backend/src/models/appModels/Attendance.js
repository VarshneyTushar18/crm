const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema(
  {
    workerName: {
      type: String,
      required: true,
      trim: true,
    },

    workerEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },

    employeeId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    designation: {
      type: String,
      required: true,
      trim: true,
    },

    department: {
      type: String,
      required: true,
      trim: true,
    },

    date: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    checkin: {
      type: String,
      required: true,
      trim: true,
    },

    checkout: {
      type: String,
      required: true,
      trim: true,
    },

    hours: {
      type: Number,
      required: true,
      default: 0,
    },

    status: {
      type: String,
      enum: ["Full Day", "Half Day", "Absent"],
      default: "Absent",
    },

    source: {
      type: String,
      enum: ["Manual", "Auto"],
      default: "Manual",
    },
  },
  {
    timestamps: true,
  }
);

// optional: one employee one date one record
attendanceSchema.index({ workerEmail: 1, date: 1 }, { unique: true });

module.exports =
  mongoose.models.Attendance ||
  mongoose.model("Attendance", attendanceSchema);