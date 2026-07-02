const mongoose = require("mongoose");
const Installation = require("../models/appModels/Installation");
const InstallationSummary = require("../models/appModels/InstallationSummary");
const Job = require("../models/appModels/Job");
const { markModuleCompleteForReview } = require("../utils/moduleSiteEngineerGate");

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const toNumber = (value, fallback = 0) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
};

const toDateOrNull = (value) => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
};

const mapFile = (file) => ({
    originalName: file.originalname || "",
    filename: file.filename || "",
    path: file.filename ? `/uploads/installation/${file.filename}` : file.path || "",
    mimetype: file.mimetype || "",
    size: file.size || 0,
});

exports.listByJob = async (req, res) => {
    try {
        const { jobId } = req.params;

        if (!isValidObjectId(jobId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid jobId",
            });
        }

        const items = await Installation.find({ jobId }).sort({
            plannedDate: 1,
            createdAt: -1,
        });

        return res.status(200).json({
            success: true,
            result: items,
        });
    } catch (error) {
        console.error("Installation listByJob error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch installation items",
            error: error.message,
        });
    }
};

exports.create = async (req, res) => {
    try {
        const {
            jobId,
            activityName,
            locationArea,
            assignedTeam,
            plannedDate,
            completedDate,
            status,
            snagIssue,
            remarks,
            expectedHours,
            actualHours,
        } = req.body;

        if (!isValidObjectId(jobId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid jobId",
            });
        }

        if (!activityName?.trim()) {
            return res.status(400).json({
                success: false,
                message: "Activity name is required",
            });
        }

        const job = await Job.findById(jobId);
        if (!job) {
            return res.status(404).json({
                success: false,
                message: "Job not found",
            });
        }

        const item = await Installation.create({
            jobId,
            activityName: activityName.trim(),
            locationArea: locationArea || "",
            assignedTeam: Array.isArray(assignedTeam) ? assignedTeam : [],
            plannedDate: toDateOrNull(plannedDate),
            completedDate: toDateOrNull(completedDate),
            status: status || "Pending",
            snagIssue: snagIssue || "",
            remarks: remarks || "",
            expectedHours: toNumber(expectedHours),
            actualHours: toNumber(actualHours),
        });

        return res.status(201).json({
            success: true,
            result: item,
            message: "Installation activity created successfully",
        });
    } catch (error) {
        console.error("Installation create error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to create installation activity",
            error: error.message,
        });
    }
};

exports.update = async (req, res) => {
    try {
        const { id } = req.params;

        if (!isValidObjectId(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid installation item id",
            });
        }

        const existing = await Installation.findById(id);
        if (!existing) {
            return res.status(404).json({
                success: false,
                message: "Installation activity not found",
            });
        }

        const payload = {
            ...(req.body.activityName !== undefined && {
                activityName: String(req.body.activityName || "").trim(),
            }),
            ...(req.body.locationArea !== undefined && {
                locationArea: req.body.locationArea || "",
            }),
            ...(req.body.assignedTeam !== undefined && {
                assignedTeam: Array.isArray(req.body.assignedTeam)
                    ? req.body.assignedTeam
                    : [],
            }),
            ...(req.body.plannedDate !== undefined && {
                plannedDate: toDateOrNull(req.body.plannedDate),
            }),
            ...(req.body.completedDate !== undefined && {
                completedDate: toDateOrNull(req.body.completedDate),
            }),
            ...(req.body.status !== undefined && {
                status: req.body.status || "Pending",
            }),
            ...(req.body.snagIssue !== undefined && {
                snagIssue: req.body.snagIssue || "",
            }),
            ...(req.body.remarks !== undefined && {
                remarks: req.body.remarks || "",
            }),
            ...(req.body.expectedHours !== undefined && {
                expectedHours: toNumber(req.body.expectedHours),
            }),
            ...(req.body.actualHours !== undefined && {
                actualHours: toNumber(req.body.actualHours),
            }),
        };

        const nextStatus = payload.status !== undefined ? payload.status : existing.status;
        const photoUrls =
            req.body.photoUrls !== undefined
                ? Array.isArray(req.body.photoUrls)
                    ? req.body.photoUrls
                    : []
                : existing.photoUrls || [];

        if (nextStatus === "Completed" && photoUrls.length === 0) {
            return res.status(400).json({
                success: false,
                message:
                    "Upload at least one photo before marking this installation activity complete",
            });
        }

        if (req.body.photoUrls !== undefined) {
            payload.photoUrls = photoUrls;
        }

        const updated = await Installation.findByIdAndUpdate(id, payload, {
            new: true,
            runValidators: true,
        });

        if (!updated) {
            return res.status(404).json({
                success: false,
                message: "Installation activity not found",
            });
        }

        return res.status(200).json({
            success: true,
            result: updated,
            message: "Installation activity updated successfully",
        });
    } catch (error) {
        console.error("Installation update error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to update installation activity",
            error: error.message,
        });
    }
};

exports.remove = async (req, res) => {
    try {
        const { id } = req.params;

        if (!isValidObjectId(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid installation item id",
            });
        }

        const deleted = await Installation.findByIdAndDelete(id);

        if (!deleted) {
            return res.status(404).json({
                success: false,
                message: "Installation activity not found",
            });
        }

        return res.status(200).json({
            success: true,
            result: deleted,
            message: "Installation activity deleted successfully",
        });
    } catch (error) {
        console.error("Installation delete error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to delete installation activity",
            error: error.message,
        });
    }
};

exports.getSummary = async (req, res) => {
    try {
        const { jobId } = req.params;

        if (!isValidObjectId(jobId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid jobId",
            });
        }

        let summary = await InstallationSummary.findOne({ jobId });

        if (!summary) {
            summary = await InstallationSummary.create({ jobId });
        }

        return res.status(200).json({
            success: true,
            result: summary,
        });
    } catch (error) {
        console.error("Installation getSummary error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch installation summary",
            error: error.message,
        });
    }
};

exports.saveSummary = async (req, res) => {
    try {
        const { jobId } = req.params;

        if (!isValidObjectId(jobId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid jobId",
            });
        }

        const payload = {
            ...(req.body.installationScheduledDate !== undefined && {
                installationScheduledDate: toDateOrNull(
                    req.body.installationScheduledDate
                ),
            }),
            ...(req.body.assignedTeam !== undefined && {
                assignedTeam: Array.isArray(req.body.assignedTeam)
                    ? req.body.assignedTeam
                    : [],
            }),
            ...(req.body.expectedHours !== undefined && {
                expectedHours: toNumber(req.body.expectedHours),
            }),
            ...(req.body.actualHours !== undefined && {
                actualHours: toNumber(req.body.actualHours),
            }),
            ...(req.body.completionConfirmed !== undefined && {
                completionConfirmed:
                    req.body.completionConfirmed === true ||
                    req.body.completionConfirmed === "true",
            }),
            ...(req.body.completionConfirmedAt !== undefined && {
                completionConfirmedAt: toDateOrNull(req.body.completionConfirmedAt),
            }),
            ...(req.body.completionRemarks !== undefined && {
                completionRemarks: req.body.completionRemarks || "",
            }),
        };

        const summary = await InstallationSummary.findOneAndUpdate(
            { jobId },
            { $set: payload },
            {
                new: true,
                upsert: true,
                runValidators: true,
            }
        );

        await Job.findByIdAndUpdate(jobId, {
            stage: "Installation",
            status: "Active",
        });

        return res.status(200).json({
            success: true,
            result: summary,
            message: "Installation summary saved successfully",
        });
    } catch (error) {
        console.error("Installation saveSummary error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to save installation summary",
            error: error.message,
        });
    }
};

exports.markComplete = async (req, res) => {
    try {
        const { jobId } = req.params;

        if (!isValidObjectId(jobId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid jobId",
            });
        }

        const items = await Installation.find({ jobId });

        if (!items.length) {
            return res.status(400).json({
                success: false,
                message: "No installation activities found",
            });
        }

        const allCompleted = items.every((item) => item.status === "Completed");

        if (!allCompleted) {
            return res.status(400).json({
                success: false,
                message:
                    "All installation activities must be Completed before confirmation",
            });
        }

        const missingPhotos = items.some(
            (item) => !Array.isArray(item.photoUrls) || item.photoUrls.length === 0
        );
        if (missingPhotos) {
            return res.status(400).json({
                success: false,
                message:
                    "Each installation activity must have at least one uploaded photo before confirmation",
            });
        }

        const summary = await InstallationSummary.findOneAndUpdate(
            { jobId },
            {
                $set: {
                    completionConfirmed: true,
                    completionConfirmedAt: new Date(),
                },
            },
            { new: true, upsert: true }
        );

        await markModuleCompleteForReview(jobId, "installation", "Installation Module");

        return res.status(200).json({
            success: true,
            result: summary,
            message: "Installation completion confirmed — awaiting site engineer review",
        });
    } catch (error) {
        console.error("Installation markComplete error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to confirm installation completion",
            error: error.message,
        });
    }
};

exports.finalize = async (req, res) => {
    try {
        const { jobId } = req.params;

        if (!isValidObjectId(jobId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid jobId",
            });
        }

        const {
            customerName,
            customerSignOffDone,
            completionDate,
            completionRemarks,
        } = req.body;

        const signOff =
            customerSignOffDone === true || customerSignOffDone === "true";

        if (!signOff) {
            return res.status(400).json({
                success: false,
                message: "Customer sign-off is required",
            });
        }

        if (!completionDate) {
            return res.status(400).json({
                success: false,
                message: "Completion date is required",
            });
        }

        const allItems = await Installation.find({ jobId });

        if (!allItems.length) {
            return res.status(400).json({
                success: false,
                message: "No installation activities found",
            });
        }

        const allCompleted = allItems.every((item) => item.status === "Completed");

        if (!allCompleted) {
            return res.status(400).json({
                success: false,
                message: "All installation activities must be completed before closure",
            });
        }

        const signatureFile =
            req.files?.customerSignatureFile?.[0] || null;
        const pictureFiles = Array.isArray(req.files?.completionPictures)
            ? req.files.completionPictures
            : [];
        const documentFiles = Array.isArray(req.files?.completionDocuments)
            ? req.files.completionDocuments
            : [];

        if (!pictureFiles.length) {
            return res.status(400).json({
                success: false,
                message: "At least one completion picture is required",
            });
        }

        const summary = await InstallationSummary.findOneAndUpdate(
            { jobId },
            {
                $set: {
                    customerName: customerName || "",
                    customerSignOffDone: true,
                    completionDate: toDateOrNull(completionDate),
                    completionRemarks: completionRemarks || "",
                    completionConfirmed: true,
                    completionConfirmedAt: new Date(),
                    ...(signatureFile && {
                        customerSignatureFile: mapFile(signatureFile),
                    }),
                    completionPictures: pictureFiles.map(mapFile),
                    completionDocuments: documentFiles.map(mapFile),
                },
            },
            {
                new: true,
                upsert: true,
                runValidators: true,
            }
        );

        await markModuleCompleteForReview(jobId, "installation", "Installation Module");
        await markModuleCompleteForReview(jobId, "jobCompletion", "Installation Module");

        return res.status(200).json({
            success: true,
            result: summary,
            message: "Job finalized — awaiting site engineer review",
        });
    } catch (error) {
        console.error("Installation finalize error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to finalize job completion",
            error: error.message,
        });
    }
};

exports.uploadActivityFiles = async (req, res) => {
    try {
        const { id } = req.params;

        if (!isValidObjectId(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid installation item id",
            });
        }

        const item = await Installation.findById(id);
        if (!item) {
            return res.status(404).json({
                success: false,
                message: "Installation activity not found",
            });
        }

        const files = req.files || [];
        const uploadedUrls = files.map((f) => `/uploads/installation/${f.filename}`);

        item.photoUrls = [...(item.photoUrls || []), ...uploadedUrls];
        await item.save();

        return res.status(200).json({
            success: true,
            result: item,
            message: `${uploadedUrls.length} file(s) uploaded`,
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message || "Upload failed",
        });
    }
};