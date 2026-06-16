const CheckIn = require("../../models/CheckIn");

exports.workerCheckIn = async (req, res) => {
  try {
    const { workerId, jobId, time } = req.body;

    const checkinData = await CheckIn.create({
      workerId: workerId || "W001",
      jobId: jobId || "J001",
      checkInTime: time || new Date(),
      status: "checked_in",
    });

    res.json({
      success: true,
      message: "Worker checked in successfully",
      data: checkinData,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
exports.getAllCheckins = async (req, res) => {
  try {
    const data = await CheckIn.find().sort({ checkInTime: -1 });

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
exports.workerCheckOut = async (req, res) => {
  try {
    const { checkinId } = req.body;

    const updatedCheckin = await CheckIn.findByIdAndUpdate(
      checkinId,
      {
        checkOutTime: new Date(),
        status: "checked_out",
      },
      { new: true }
    );

    if (!updatedCheckin) {
      return res.status(404).json({
        success: false,
        message: "Check-in record not found",
      });
    }

    res.json({
      success: true,
      message: "Worker checked out successfully",
      data: updatedCheckin,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
exports.getWorkerCheckins = async (req, res) => {
  try {
    const { workerId } = req.params;

    const data = await CheckIn.find({ workerId }).sort({
      checkInTime: -1,
    });

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};