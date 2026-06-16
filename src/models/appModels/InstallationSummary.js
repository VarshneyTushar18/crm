const mongoose = require("mongoose");

const uploadedFileSchema = new mongoose.Schema(
    {
        originalName: { type: String, default: "" },
        filename: { type: String, default: "" },
        path: { type: String, default: "" },
        mimetype: { type: String, default: "" },
        size: { type: Number, default: 0 },
    },
    { _id: false }
);

const installationSummarySchema = new mongoose.Schema(
    {
        jobId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Job",
            required: true,
            unique: true,
            index: true,
        },

        installationScheduledDate: {
            type: Date,
            default: null,
        },

        assignedTeam: [
            {
                type: String,
                trim: true,
            },
        ],

        expectedHours: {
            type: Number,
            default: 0,
            min: 0,
        },

        actualHours: {
            type: Number,
            default: 0,
            min: 0,
        },

        completionConfirmed: {
            type: Boolean,
            default: false,
        },

        completionConfirmedAt: {
            type: Date,
            default: null,
        },

        completionRemarks: {
            type: String,
            default: "",
            trim: true,
        },

        customerSignOffDone: {
            type: Boolean,
            default: false,
        },

        customerName: {
            type: String,
            default: "",
            trim: true,
        },

        completionDate: {
            type: Date,
            default: null,
        },

        customerSignatureFile: uploadedFileSchema,

        completionPictures: [uploadedFileSchema],

        completionDocuments: [uploadedFileSchema],
    },
    { timestamps: true }
);

module.exports =
    mongoose.models.InstallationSummary ||
    mongoose.model("InstallationSummary", installationSummarySchema);