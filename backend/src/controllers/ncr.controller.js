const Ncr = require("../models/appModels/Ncr");
const Job = require("../models/appModels/Job");
const Qc = require("../models/appModels/Qc");

const REINSPECTION_OUTCOME_TO_STATUS = {
  Pass: "Passed",
  Fail: "Failed",
};

const buildNcrNumber = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `NCR-${y}${m}${d}-${rand}`;
};

exports.listByJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    if (!jobId) {
      return res.status(400).json({
        success: false,
        result: [],
        message: "jobId is required",
      });
    }

    const result = await Ncr.find({ jobId })
      .sort({ createdAt: -1 })
      .populate("qcItemId", "itemName inspectionType status");

    return res.status(200).json({
      success: true,
      result,
      message: "NCR list fetched",
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      result: [],
      message: err.message,
    });
  }
};

exports.create = async (req, res) => {
  try {
    const payload = req.body || {};

    if (!payload.jobId || !payload.qcItemId) {
      return res.status(400).json({
        success: false,
        result: null,
        message: "jobId and qcItemId are required",
      });
    }

    const [job, qcItem] = await Promise.all([
      Job.findById(payload.jobId),
      Qc.findById(payload.qcItemId),
    ]);

    if (!job) {
      return res.status(404).json({
        success: false,
        result: null,
        message: "Job not found",
      });
    }

    if (!qcItem) {
      return res.status(404).json({
        success: false,
        result: null,
        message: "QC item not found",
      });
    }

    const existing = await Ncr.findOne({ qcItemId: payload.qcItemId }).sort({ createdAt: -1 });
    if (existing && existing.status !== "Closed") {
      return res.status(409).json({
        success: false,
        result: existing,
        message: "An open NCR already exists for this QC item",
      });
    }

    const created = await Ncr.create({
      jobId: payload.jobId,
      qcItemId: payload.qcItemId,
      ncrNumber: buildNcrNumber(),
      title: payload.title || `NCR for ${qcItem.itemName}`,
      description: payload.description || qcItem.remarks || "",
      rootCause: payload.rootCause || "",
      correctiveAction: payload.correctiveAction || "",
      assignedTo: payload.assignedTo || "",
      dueDate: payload.dueDate || "",
      status: payload.status || "Open",
      reinspectionRequired: payload.reinspectionRequired !== false,
      reinspectionStatus: payload.reinspectionRequired === false ? "Not Required" : "Pending",
    });

    if (qcItem.status !== "Rework") {
      qcItem.status = "Rework";
      await qcItem.save();
    }

    return res.status(201).json({
      success: true,
      result: created,
      message: "NCR created",
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      result: null,
      message: err.message,
    });
  }
};

exports.update = async (req, res) => {
  try {
    const updated = await Ncr.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!updated) {
      return res.status(404).json({
        success: false,
        result: null,
        message: "NCR not found",
      });
    }

    return res.status(200).json({
      success: true,
      result: updated,
      message: "NCR updated",
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      result: null,
      message: err.message,
    });
  }
};

exports.recordReinspection = async (req, res) => {
  try {
    const { result, notes, checkedBy, checkedDate } = req.body || {};
    if (!["Pass", "Fail"].includes(result)) {
      return res.status(400).json({
        success: false,
        result: null,
        message: "Re-inspection result must be Pass or Fail",
      });
    }

    const ncr = await Ncr.findById(req.params.id);
    if (!ncr) {
      return res.status(404).json({
        success: false,
        result: null,
        message: "NCR not found",
      });
    }

    ncr.reinspectionRequired = true;
    ncr.reinspectionStatus = REINSPECTION_OUTCOME_TO_STATUS[result];
    ncr.reinspectionAttempts = Number(ncr.reinspectionAttempts || 0) + 1;
    ncr.reinspectionNotes = notes || "";
    ncr.reinspectionBy = checkedBy || "";
    ncr.reinspectionDate = checkedDate || "";
    ncr.status = result === "Pass" ? "Closed" : "In Progress";
    await ncr.save();

    const qcItem = await Qc.findById(ncr.qcItemId);
    if (qcItem) {
      qcItem.status = result === "Pass" ? "Pass" : "Rework";
      if (notes) {
        qcItem.remarks = [qcItem.remarks, `Re-inspection: ${notes}`]
          .filter(Boolean)
          .join(" | ");
      }
      await qcItem.save();
    }

    return res.status(200).json({
      success: true,
      result: ncr,
      message: "Re-inspection saved",
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      result: null,
      message: err.message,
    });
  }
};
