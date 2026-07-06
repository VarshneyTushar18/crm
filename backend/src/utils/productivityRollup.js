const Fabrication = require("../models/appModels/Fabrication");
const JobCard = require("../models/appModels/JobCard");
const Attendance = require("../models/appModels/Attendance");
const Installation = require("../models/appModels/Installation");
const Job = require("../models/appModels/Job");

const normalizeWorkerName = (name) => String(name || "").trim().toLowerCase();

const parseDateValue = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  const str = String(value).trim();
  const dmy = str.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (dmy) {
    const parsed = new Date(`${dmy[3]}-${dmy[2]}-${dmy[1]}`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const parsed = new Date(str);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const inDateRange = (workDate, startDate, endDate) => {
  const d = parseDateValue(workDate);
  if (!d) return !startDate && !endDate;
  if (startDate) {
    const start = parseDateValue(startDate);
    if (start && d < start) return false;
  }
  if (endDate) {
    const end = parseDateValue(endDate);
    if (end) {
      const endOfDay = new Date(end);
      endOfDay.setHours(23, 59, 59, 999);
      if (d > endOfDay) return false;
    }
  }
  return true;
};

const pushEntry = (entries, entry) => {
  if (!entry.workerName || Number(entry.hours) <= 0) return;
  entries.push(entry);
};

const aggregateEntries = (entries) => {
  const byWorkerMap = new Map();
  const byJobMap = new Map();
  const byModule = {};

  let totalHours = 0;

  for (const entry of entries) {
    totalHours += entry.hours;
    byModule[entry.module] = (byModule[entry.module] || 0) + entry.hours;

    const workerKey = normalizeWorkerName(entry.workerName);
    if (!byWorkerMap.has(workerKey)) {
      byWorkerMap.set(workerKey, {
        workerName: entry.workerName,
        totalHours: 0,
        fabricationHours: 0,
        installationHours: 0,
        attendanceHours: 0,
        entries: 0,
      });
    }
    const workerRow = byWorkerMap.get(workerKey);
    workerRow.totalHours += entry.hours;
    workerRow.entries += 1;
    if (entry.module === "Fabrication") workerRow.fabricationHours += entry.hours;
    if (entry.module.startsWith("Installation")) workerRow.installationHours += entry.hours;
    if (entry.module === "Attendance") workerRow.attendanceHours += entry.hours;

    if (entry.jobId) {
      const jobKey = String(entry.jobId);
      if (!byJobMap.has(jobKey)) {
        byJobMap.set(jobKey, {
          jobId: entry.jobId,
          jobCode: entry.jobCode,
          customer: entry.customer || "",
          totalHours: 0,
          workers: new Set(),
        });
      }
      const jobRow = byJobMap.get(jobKey);
      jobRow.totalHours += entry.hours;
      jobRow.workers.add(entry.workerName);
    }
  }

  const byWorker = [...byWorkerMap.values()]
    .map((row) => ({
      ...row,
      totalHours: Number(row.totalHours.toFixed(2)),
      fabricationHours: Number(row.fabricationHours.toFixed(2)),
      installationHours: Number(row.installationHours.toFixed(2)),
      attendanceHours: Number(row.attendanceHours.toFixed(2)),
    }))
    .sort((a, b) => b.totalHours - a.totalHours);

  const byJob = [...byJobMap.values()]
    .map((row) => ({
      jobId: row.jobId,
      jobCode: row.jobCode,
      customer: row.customer,
      totalHours: Number(row.totalHours.toFixed(2)),
      workerCount: row.workers.size,
      workers: [...row.workers],
    }))
    .sort((a, b) => b.totalHours - a.totalHours);

  return {
    summary: {
      totalHours: Number(totalHours.toFixed(2)),
      byModule,
      workerCount: byWorker.length,
      jobCount: byJob.length,
      entryCount: entries.length,
    },
    byWorker,
    byJob,
    entries: entries.map((e) => ({ ...e, hours: Number(e.hours.toFixed(2)) })),
  };
};

async function buildProductivityRollup(filters = {}) {
  const { jobId, workerName, startDate, endDate, module } = filters;
  const entries = [];
  const jobCache = new Map();

  const getJobLabel = async (id) => {
    const key = String(id);
    if (jobCache.has(key)) return jobCache.get(key);
    const job = await Job.findById(id).select("jobId customer").lean();
    const label = job
      ? { jobCode: job.jobId, customer: job.customer || "" }
      : { jobCode: key, customer: "" };
    jobCache.set(key, label);
    return label;
  };

  const workerMatch = (name) =>
    !workerName || normalizeWorkerName(name) === normalizeWorkerName(workerName);

  if (!module || module === "fabrication") {
    const fabQuery = jobId ? { jobId } : {};
    const fabItems = await Fabrication.find(fabQuery).lean();
    for (const item of fabItems) {
      const job = await getJobLabel(item.jobId);
      for (const log of item.hoursLog || []) {
        if (!workerMatch(log.workerName)) continue;
        if (!inDateRange(log.workDate, startDate, endDate)) continue;
        pushEntry(entries, {
          workerName: log.workerName || "Unknown",
          hours: Number(log.hours || 0),
          workDate: log.workDate || "",
          module: "Fabrication",
          jobId: item.jobId,
          jobCode: job.jobCode,
          customer: job.customer,
          reference: item.itemName,
          role: log.role || "",
          notes: log.notes || "",
        });
      }
    }
  }

  if (!module || module === "installation") {
    const cardQuery = jobId ? { jobId } : {};
    const cards = await JobCard.find(cardQuery).lean();
    for (const card of cards) {
      const job = await getJobLabel(card.jobId);
      for (const log of card.hoursLog || []) {
        if (!workerMatch(log.workerName)) continue;
        if (!inDateRange(log.workDate, startDate, endDate)) continue;
        pushEntry(entries, {
          workerName: log.workerName || "Unknown",
          hours: Number(log.hours || 0),
          workDate: log.workDate || "",
          module: "Installation (Job Card)",
          jobId: card.jobId,
          jobCode: job.jobCode,
          customer: job.customer,
          reference: card.title,
          role: log.role || "Installer",
          notes: log.notes || "",
        });
      }
    }

    const instQuery = jobId ? { jobId } : {};
    const activities = await Installation.find(instQuery).lean();
    for (const activity of activities) {
      const job = await getJobLabel(activity.jobId);
      for (const log of activity.hoursLog || []) {
        if (!workerMatch(log.workerName)) continue;
        if (!inDateRange(log.workDate, startDate, endDate)) continue;
        pushEntry(entries, {
          workerName: log.workerName || "Unknown",
          hours: Number(log.hours || 0),
          workDate: log.workDate || "",
          module: "Installation (Activity)",
          jobId: activity.jobId,
          jobCode: job.jobCode,
          customer: job.customer,
          reference: activity.activityName,
          role: log.role || "Installer",
          notes: log.notes || "",
        });
      }
    }
  }

  if (!module || module === "attendance") {
    const attRecords = await Attendance.find({}).lean();
    for (const rec of attRecords) {
      if (!workerMatch(rec.workerName)) continue;
      if (!inDateRange(rec.date, startDate, endDate)) continue;
      pushEntry(entries, {
        workerName: rec.workerName,
        hours: Number(rec.hours || 0),
        workDate: rec.date,
        module: "Attendance",
        jobId: null,
        jobCode: "—",
        customer: "",
        reference: `${rec.department || ""} / ${rec.designation || ""}`.trim(),
        role: rec.designation || "",
        notes: rec.status || "",
      });
    }
  }

  return aggregateEntries(entries);
}

module.exports = {
  buildProductivityRollup,
};
