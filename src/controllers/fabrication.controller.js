const Fabrication = require("../models/appModels/Fabrication");

exports.create = async (req, res) => {
  try {
    const {
      jobId,
      itemName,
      drawingRef,
      workstation,
      assignedTeam,
      quantity,
      targetDate,
      status,
      remarks,
      checklist,
      hoursLog,
    } = req.body;

    if (!jobId || !itemName) {
      return res.status(400).json({
        success: false,
        message: "jobId and itemName are required",
      });
    }

    const doc = await Fabrication.create({
      jobId,
      itemName,
      drawingRef: drawingRef || "",
      workstation: workstation || "",
      assignedTeam: assignedTeam || "",
      quantity: Number(quantity || 1),
      targetDate: targetDate || "",
      status: status || "Pending",
      remarks: remarks || "",
      checklist: checklist || {},
      hoursLog: Array.isArray(hoursLog) ? hoursLog : [],
    });

    return res.status(201).json({
      success: true,
      result: doc,
      message: "Fabrication item created successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create fabrication item",
    });
  }
};

exports.listByJob = async (req, res) => {
  try {
    const { jobId } = req.params;

    const items = await Fabrication.find({ jobId }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      result: items,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch fabrication items",
    });
  }
};

exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const payload = { ...req.body };

    if (payload.quantity !== undefined) {
      payload.quantity = Number(payload.quantity || 1);
    }

    if (payload.hoursLog && !Array.isArray(payload.hoursLog)) {
      return res.status(400).json({
        success: false,
        message: "hoursLog must be an array",
      });
    }

    const updated = await Fabrication.findByIdAndUpdate(id, payload, {
      new: true,
      runValidators: true,
    });

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Fabrication item not found",
      });
    }

    return res.status(200).json({
      success: true,
      result: updated,
      message: "Fabrication item updated successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update fabrication item",
    });
  }
};

exports.remove = async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await Fabrication.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Fabrication item not found",
      });
    }

    return res.status(200).json({
      success: true,
      result: deleted,
      message: "Fabrication item deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to delete fabrication item",
    });
  }
};