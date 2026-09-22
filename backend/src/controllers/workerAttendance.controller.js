const WorkerAttendanceSession = require("../models/appModels/WorkerAttendanceSession");
const { persistDataUrl, deletePersistedUrl } = require("../utils/persistUpload");
const { syncAttendanceFromSession } = require("../utils/syncAttendanceFromSession");

const getActor = (req) => ({
  id: req.user?._id || null,
  name: req.user?.name || req.user?.email || "Worker",
  email: String(req.user?.email || "").trim().toLowerCase(),
  workerId: String(req.user?.workerId || "").trim(),
  role: String(req.user?.role || "").trim(),
});

const getClientIp = (req) =>
  req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
  req.socket?.remoteAddress ||
  "";

const parseCoord = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const requireGps = (latitude, longitude) => {
  if (latitude === null || longitude === null) {
    return {
      ok: false,
      message: "GPS location is required for attendance. Enable location access and try again.",
    };
  }
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    return { ok: false, message: "Invalid GPS coordinates" };
  }
  return { ok: true };
};

const formatDuration = (ms) => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(
    seconds
  ).padStart(2, "0")}`;
};

const sessionPayload = (session) => {
  if (!session) {
    return {
      isCheckedIn: false,
      session: null,
      elapsedMs: 0,
      elapsedLabel: "00:00:00",
    };
  }

  const checkInTime = new Date(session.checkInTime).getTime();
  const endTime =
    session.status === "checked_in"
      ? Date.now()
      : new Date(session.checkOutTime || Date.now()).getTime();
  const elapsedMs = Math.max(0, endTime - checkInTime);

  return {
    isCheckedIn: session.status === "checked_in",
    session,
    elapsedMs,
    elapsedLabel: formatDuration(elapsedMs),
  };
};

const findOpenSession = async (actor) => {
  const or = [];
  if (actor.id) or.push({ userId: actor.id });
  if (actor.workerId) or.push({ workerId: actor.workerId });
  if (actor.email) or.push({ workerEmail: actor.email });
  if (!or.length) return null;

  return WorkerAttendanceSession.findOne({
    status: "checked_in",
    $or: or,
  }).sort({ checkInTime: -1 });
};

const saveSelfie = async (photoDataUrl, label) => {
  if (!photoDataUrl) return "";
  const saved = await persistDataUrl(photoDataUrl, "attendance", `${label}.jpg`);
  return saved.url;
};

exports.status = async (req, res) => {
  try {
    const actor = getActor(req);
    if (actor.role !== "worker" && actor.role !== "admin" && actor.role !== "siteEngineer") {
      return res.status(403).json({ success: false, message: "Workers only" });
    }

    const open = await findOpenSession(actor);
    return res.json({
      success: true,
      result: sessionPayload(open),
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.checkIn = async (req, res) => {
  try {
    const actor = getActor(req);
    if (actor.role !== "worker") {
      return res.status(403).json({ success: false, message: "Workers only" });
    }

    const open = await findOpenSession(actor);
    if (open) {
      return res.status(400).json({
        success: false,
        message: "Already checked in. Please check out first.",
        result: sessionPayload(open),
      });
    }

    const latitude = parseCoord(req.body?.latitude);
    const longitude = parseCoord(req.body?.longitude);
    const gpsCheck = requireGps(latitude, longitude);
    if (!gpsCheck.ok) {
      return res.status(400).json({ success: false, message: gpsCheck.message });
    }

    const livenessPassed = Boolean(req.body?.livenessPassed);
    const livenessSteps = Array.isArray(req.body?.livenessSteps)
      ? req.body.livenessSteps.map((s) => String(s || "").trim()).filter(Boolean)
      : [];
    const livenessScore = Math.min(100, Math.max(0, Number(req.body?.livenessScore || 0)));

    if (!livenessPassed || livenessSteps.length < 2 || livenessScore < 70) {
      return res.status(400).json({
        success: false,
        message: "Liveness check required before check-in (blink and turn head).",
      });
    }

    if (!req.body?.photoDataUrl) {
      return res.status(400).json({
        success: false,
        message: "Check-in photo is required. Capture selfie during liveness.",
      });
    }

    let checkInPhotoUrl = "";
    try {
      checkInPhotoUrl = await saveSelfie(req.body.photoDataUrl, `checkin-${actor.workerId || actor.id}`);
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: err.message || "Failed to save check-in photo",
      });
    }

    const created = await WorkerAttendanceSession.create({
      userId: actor.id,
      workerId: actor.workerId,
      workerEmail: actor.email,
      workerName: actor.name,
      jobId: String(req.body?.jobId || "").trim(),
      checkInTime: new Date(),
      status: "checked_in",
      checkInLatitude: latitude,
      checkInLongitude: longitude,
      livenessPassed: true,
      livenessSteps,
      livenessScore,
      faceMatchStatus: "skipped",
      faceMatchScore: null,
      deviceId: String(req.body?.deviceId || "").trim(),
      userAgent: String(req.headers["user-agent"] || "").slice(0, 400),
      checkInIp: getClientIp(req),
      checkInPhotoUrl,
    });

    return res.status(201).json({
      success: true,
      message: "Checked in successfully",
      result: sessionPayload(created),
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.checkOut = async (req, res) => {
  try {
    const actor = getActor(req);
    if (actor.role !== "worker") {
      return res.status(403).json({ success: false, message: "Workers only" });
    }

    const open = await findOpenSession(actor);
    if (!open) {
      return res.status(400).json({
        success: false,
        message: "No active check-in found",
        result: sessionPayload(null),
      });
    }

    const latitude = parseCoord(req.body?.latitude);
    const longitude = parseCoord(req.body?.longitude);
    const gpsCheck = requireGps(latitude, longitude);
    if (!gpsCheck.ok) {
      return res.status(400).json({ success: false, message: gpsCheck.message });
    }

    let checkOutPhotoUrl = open.checkOutPhotoUrl || "";
    if (req.body?.photoDataUrl) {
      try {
        checkOutPhotoUrl = await saveSelfie(
          req.body.photoDataUrl,
          `checkout-${actor.workerId || actor.id}`
        );
      } catch (err) {
        return res.status(400).json({
          success: false,
          message: err.message || "Failed to save check-out photo",
        });
      }
    }

    const now = new Date();
    open.checkOutTime = now;
    open.status = "checked_out";
    open.checkOutLatitude = latitude;
    open.checkOutLongitude = longitude;
    open.checkOutIp = getClientIp(req);
    open.checkOutPhotoUrl = checkOutPhotoUrl;
    open.totalMinutes = Math.max(
      0,
      Math.round((now.getTime() - new Date(open.checkInTime).getTime()) / 60000)
    );
    await open.save();

    try {
      await syncAttendanceFromSession(open);
    } catch (syncErr) {
      console.error("Attendance sync after check-out failed:", syncErr.message);
    }

    return res.json({
      success: true,
      message: "Checked out successfully",
      result: sessionPayload(open),
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.history = async (req, res) => {
  try {
    const actor = getActor(req);
    if (actor.role !== "worker" && actor.role !== "admin") {
      return res.status(403).json({ success: false, message: "Workers only" });
    }

    const or = [];
    if (actor.id) or.push({ userId: actor.id });
    if (actor.workerId) or.push({ workerId: actor.workerId });
    if (actor.email) or.push({ workerEmail: actor.email });

    const items = or.length
      ? await WorkerAttendanceSession.find({ $or: or })
          .sort({ checkInTime: -1 })
          .limit(50)
      : [];

    return res.json({
      success: true,
      result: items,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/** Admin / HR timesheet — all employee check-in/out sessions */
exports.timesheet = async (req, res) => {
  try {
    const actor = getActor(req);
    if (!["admin", "siteEngineer"].includes(actor.role)) {
      return res.status(403).json({
        success: false,
        message: "Admin / HR access only",
      });
    }

    const filter = {};
    const workerId = String(req.query.workerId || "").trim();
    const email = String(req.query.email || "").trim().toLowerCase();
    const status = String(req.query.status || "").trim();
    const from = req.query.from ? new Date(req.query.from) : null;
    const to = req.query.to ? new Date(req.query.to) : null;

    if (workerId) filter.workerId = workerId;
    if (email) filter.workerEmail = email;
    if (status) filter.status = status;
    if ((from && !Number.isNaN(from.getTime())) || (to && !Number.isNaN(to.getTime()))) {
      filter.checkInTime = {};
      if (from && !Number.isNaN(from.getTime())) filter.checkInTime.$gte = from;
      if (to && !Number.isNaN(to.getTime())) filter.checkInTime.$lte = to;
    }

    const items = await WorkerAttendanceSession.find(filter)
      .sort({ checkInTime: -1 })
      .limit(Math.min(500, Number(req.query.limit || 200)));

    return res.json({
      success: true,
      result: items,
      message: `${items.length} timesheet row(s)`,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/** Admin / HR — delete check-in and/or check-out selfie photos from a session */
exports.deletePhotos = async (req, res) => {
  try {
    const actor = getActor(req);
    if (!["admin", "siteEngineer"].includes(actor.role)) {
      return res.status(403).json({
        success: false,
        message: "Admin / HR access only",
      });
    }

    const id = String(req.params.id || "").trim();
    if (!id) {
      return res.status(400).json({ success: false, message: "Session id required" });
    }

    const session = await WorkerAttendanceSession.findById(id);
    if (!session) {
      return res.status(404).json({ success: false, message: "Attendance session not found" });
    }

    const which = String(req.body?.which || "both").trim().toLowerCase();
    const deleteIn = which === "in" || which === "checkin" || which === "both" || which === "all";
    const deleteOut =
      which === "out" || which === "checkout" || which === "both" || which === "all";

    if (!deleteIn && !deleteOut) {
      return res.status(400).json({
        success: false,
        message: "which must be in, out, or both",
      });
    }

    const removed = [];

    if (deleteIn && session.checkInPhotoUrl) {
      await deletePersistedUrl(session.checkInPhotoUrl);
      session.checkInPhotoUrl = "";
      removed.push("checkIn");
    }
    if (deleteOut && session.checkOutPhotoUrl) {
      await deletePersistedUrl(session.checkOutPhotoUrl);
      session.checkOutPhotoUrl = "";
      removed.push("checkOut");
    }

    if (!removed.length) {
      return res.status(400).json({
        success: false,
        message: "No photos to delete for the selected side(s)",
        result: session,
      });
    }

    await session.save();

    return res.json({
      success: true,
      message: `Deleted ${removed.join(" & ")} photo(s)`,
      result: session,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
