const { buildProductivityRollup } = require("../utils/productivityRollup");

const getActor = (req) => ({
  name: req.user?.name || req.admin?.name || "",
  role: String(req.user?.role || req.admin?.role || "admin").toLowerCase(),
});

exports.summary = async (req, res) => {
  try {
    const { jobId, workerName, startDate, endDate, module } = req.query;
    const result = await buildProductivityRollup({
      jobId,
      workerName,
      startDate,
      endDate,
      module,
    });

    return res.status(200).json({
      success: true,
      result,
      message: "Productivity summary fetched",
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

exports.mySummary = async (req, res) => {
  try {
    const actor = getActor(req);
    if (actor.role !== "worker") {
      return res.status(403).json({ success: false, message: "Workers only" });
    }

    const { jobId, startDate, endDate, module } = req.query;
    const result = await buildProductivityRollup({
      jobId,
      workerName: actor.name,
      startDate,
      endDate,
      module,
    });

    return res.status(200).json({
      success: true,
      result,
      message: "Your productivity summary fetched",
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};
