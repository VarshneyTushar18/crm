const WorkUpdate = require("../../models/WorkUpdate");

exports.createWorkUpdate = async (req, res) => {
  try {
    const { jobId, workerId, note } = req.body;

    const newUpdate = await WorkUpdate.create({
      jobId,
      workerId,
      note,
    });

    res.json({
      success: true,
      message: "Work update created successfully",
      data: newUpdate,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getWorkUpdatesByJob = async (req, res) => {
  try {
    const { jobId } = req.params;

    const updates = await WorkUpdate.find({ jobId }).sort({ createdAt: -1 });

    res.json({
      success: true,
      data: updates,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};