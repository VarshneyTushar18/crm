const Employee = require("../models/appModels/Employee");
const { getActiveDayOffsForWorker } = require("../services/dayOffService");

const getActor = (req) => ({
  id: req.user?._id || req.admin?._id || null,
  name: req.user?.name || req.admin?.name || req.user?.email || "System",
  email: String(req.user?.email || "").trim().toLowerCase(),
  workerId: String(req.user?.workerId || "").trim(),
  role: String(req.user?.role || req.admin?.role || "admin").trim(),
});

const escapeRegex = (value) =>
  String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const resolveEmployeeForWorker = async (actor) => {
  const or = [];
  if (actor.email) or.push({ email: actor.email });
  if (actor.workerId) {
    or.push({
      employeeId: new RegExp(`^${escapeRegex(actor.workerId)}$`, "i"),
    });
  }
  if (!or.length) return null;
  return Employee.findOne({ $or: or });
};

/**
 * GET /day-off/active
 * Returns company + personal day-offs for today and tomorrow (worker portal banner).
 */
exports.listActive = async (req, res) => {
  try {
    const actor = getActor(req);
    let employeeId = null;

    if (actor.role === "worker") {
      const employee = await resolveEmployeeForWorker(actor);
      employeeId = employee?._id || null;
    } else if (req.query.employeeId) {
      employeeId = req.query.employeeId;
    }

    const result = await getActiveDayOffsForWorker({
      employeeId,
      fromKey: req.query.from || undefined,
      toKey: req.query.to || undefined,
    });

    return res.json({ success: true, result });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
