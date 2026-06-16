const mongoose = require("mongoose");

const SiteMeasurementSchema = new mongoose.Schema(
  {
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
      required: true,
      index: true,
    },

    measuredBy: {
      type: String,
      default: "",
      trim: true,
    },

    siteAddress: {
      type: String,
      default: "",
      trim: true,
    },

    height: {
      type: Number,
      default: 0,
      min: 0,
    },

    width: {
      type: Number,
      default: 0,
      min: 0,
    },

    length: {
      type: Number,
      default: 0,
      min: 0,
    },

    materialType: {
      type: String,
      default: "",
      trim: true,
    },

    fixingSurfaces: {
      type: String,
      default: "",
      trim: true,
    },

    accessDetails: {
      type: String,
      default: "",
      trim: true,
    },

    parkingDetails: {
      type: String,
      default: "",
      trim: true,
    },

    powerAvailable: {
      type: Boolean,
      default: false,
    },
    powerLocation: {
      type: String,
      default: "",
      trim: true,
    },

    waterAvailable: {
      type: Boolean,
      default: false,
    },
    waterLocation: {
      type: String,
      default: "",
      trim: true,
    },

    liftAccess: {
      type: String,
      default: "",
      trim: true,
    },

    washroomAccess: {
      type: String,
      default: "",
      trim: true,
    },

    publicRisk: {
      type: String,
      default: "",
      trim: true,
    },

    whsHazards: {
      type: String,
      default: "",
      trim: true,
    },

    gpsLocation: {
      type: String,
      default: "",
      trim: true,
    },

    photoUrls: {
      type: [String],
      default: [],
    },

    notes: {
      type: String,
      default: "",
      trim: true,
    },

    measurementDate: {
      type: Date,
      default: Date.now,
    },

    status: {
      type: String,
      enum: ["Pending", "Completed"],
      default: "Completed",
    },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.SiteMeasurement ||
  mongoose.model("SiteMeasurement", SiteMeasurementSchema);