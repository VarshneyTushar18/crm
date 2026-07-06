const mongoose = require("mongoose");

const installationHoursSchema = new mongoose.Schema(
    {
        workerName: { type: String, trim: true, default: "" },
        role: { type: String, trim: true, default: "Installer" },
        hours: { type: Number, default: 0 },
        workDate: { type: String, trim: true, default: "" },
        notes: { type: String, trim: true, default: "" },
    },
    { _id: false }
);

const installationSchema = new mongoose.Schema(
    {
        jobId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Job",
            required: true,
            index: true,
        },
        sequenceOrder: {
            type: Number,
            default: 0,
            min: 0,
            index: true,
        },
        activityName: {
            type: String,
            required: true,
            trim: true,
        },
        locationArea: {
            type: String,
            default: "",
            trim: true,
        },
        assignedTeam: [
            {
                type: String,
                trim: true,
            },
        ],
        plannedDate: {
            type: String,
            default: "",
        },
        completedDate: {
            type: String,
            default: "",
        },
        status: {
            type: String,
            enum: ["Pending", "In Progress", "Completed", "Hold", "Snag"],
            default: "Pending",
        },
        snagIssue: {
            type: String,
            default: "",
            trim: true,
        },
        remarks: {
            type: String,
            default: "",
            trim: true,
        },
        expectedHours: {
            type: Number,
            default: 0,
        },
        actualHours: {
            type: Number,
            default: 0,
        },
        hoursLog: {
            type: [installationHoursSchema],
            default: [],
        },
        photoUrls: {
            type: [String],
            default: [],
        },
    },
    { timestamps: true }
);

module.exports =
    mongoose.models.Installation ||
    mongoose.model("Installation", installationSchema);