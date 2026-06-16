// Simple Job Controller (test ke liye)

exports.getAllJobs = async (req, res) => {
  try {
    // Abhi dummy data bhej rahe hain (DB baad me connect karenge)
    const jobs = [
      {
        id: "1",
        title: "Kitchen Work",
        status: "in_progress",
      },
      {
        id: "2",
        title: "Painting Work",
        status: "pending",
      },
    ];

    res.json({
      success: true,
      data: jobs,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
const MobileJob = require("../../models/Job");

// Job create karne ke liye
exports.createJob = async (req, res) => {
  try {
    const { title, description, customerId, workerId } = req.body;

    const newJob = await MobileJob.create({
      title,
      description,
      customerId,
      workerId,
      status: "assigned",
    });

    res.json({
      success: true,
      message: "Job created successfully",
      data: newJob,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
exports.getJobsByWorker = async (req, res) => {
  try {
    const { workerId } = req.params;

    const jobs = await MobileJob.find({ workerId }).sort({ createdAt: -1 });

    res.json({
      success: true,
      data: jobs,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
exports.getJobsByCustomer = async (req, res) => {
  try {
    const { customerId } = req.params;

    const jobs = await MobileJob.find({ customerId }).sort({ createdAt: -1 });

    res.json({
      success: true,
      data: jobs,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
exports.updateJobStatus = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { status } = req.body;

    const updatedJob = await MobileJob.findByIdAndUpdate(
      jobId,
      { status },
      { new: true }
    );

    if (!updatedJob) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    res.json({
      success: true,
      message: "Job status updated successfully",
      data: updatedJob,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};