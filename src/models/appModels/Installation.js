const mongoose = require("mongoose");

const installationSchema = new mongoose.Schema(
    {
        jobId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Job",
            required: true,
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
    },
    { timestamps: true }
);

module.exports =
    mongoose.models.Installation ||
    mongoose.model("Installation", installationSchema);