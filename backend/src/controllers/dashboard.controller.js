const mongoose = require("mongoose");
const moment = require("moment");
const Job = require("../models/appModels/Job");
const Lead = require("../models/appModels/Lead");
const Quote = require("../models/appModels/Quote");
const SiteEngineerReview = require("../models/appModels/SiteEngineerReview");
const ScheduleAssignment = require("../models/appModels/ScheduleAssignment");
const Fabrication = require("../models/appModels/Fabrication");
const MaterialPurchase = require("../models/appModels/MaterialPurchase");
const PurchaseOrder = require("../models/appModels/PurchaseOrder");
const {
  calcJobCompletionPercent,
  ensureV3WorkflowEvents,
  getWorkflowStageKeys,
  STAGE_LABELS,
} = require("../utils/workflowDefaults");

const Invoice = () => mongoose.models.Invoice;
const Payment = () => mongoose.models.Payment;

const OPEN_REVIEW_STATUSES = [
  "Pending",
  "Pending Review",
  "On Review",
  "Revision Required",
  "Rejected",
  "On Hold",
];

const getFilterDateRange = (query = {}) => {
  const { type, startDate, endDate } = query;
  let start = moment().startOf("month");
  let end = moment().endOf("month");

  if (type === "today") {
    start = moment().startOf("day");
    end = moment().endOf("day");
  } else if (type === "thisWeek") {
    start = moment().startOf("week");
    end = moment().endOf("week");
  } else if (type === "thisMonth") {
    start = moment().startOf("month");
    end = moment().endOf("month");
  } else if (type === "custom" && startDate && endDate) {
    start = moment(startDate).startOf("day");
    end = moment(endDate).endOf("day");
  }

  return { start, end };
};

const getTrendGranularity = (start, end) => {
  const days = end.diff(start, "days") + 1;
  return days <= 31 ? "day" : "week";
};

const buildTrendBuckets = (start, end, granularity) => {
  const buckets = [];
  const cursor =
    granularity === "week" ? moment(start).startOf("week") : moment(start).startOf("day");
  const endCursor = moment(end);

  while (cursor.isSameOrBefore(endCursor)) {
    const key =
      granularity === "week"
        ? cursor.clone().startOf("week").format("YYYY-MM-DD")
        : cursor.format("YYYY-MM-DD");
    const label =
      granularity === "week"
        ? `W/C ${cursor.clone().startOf("week").format("DD MMM")}`
        : cursor.format("DD MMM");

    if (!buckets.find((b) => b.key === key)) {
      buckets.push({ key, label, count: 0, value: 0 });
    }

    cursor.add(1, granularity === "week" ? "week" : "day");
  }

  return buckets;
};

const bucketDate = (date, granularity) => {
  const m = moment(date);
  if (!m.isValid()) return null;
  return granularity === "week"
    ? m.startOf("week").format("YYYY-MM-DD")
    : m.format("YYYY-MM-DD");
};

const fillCountTrend = (rows, dateField, start, end) => {
  const granularity = getTrendGranularity(start, end);
  const buckets = buildTrendBuckets(start, end, granularity);
  const map = Object.fromEntries(buckets.map((b) => [b.key, b]));

  for (const row of rows) {
    const key = bucketDate(row[dateField], granularity);
    if (key && map[key]) {
      map[key].count += 1;
    }
  }

  return { granularity, series: buckets.map((b) => map[b.key] || b) };
};

const fillValueTrend = (rows, dateField, valueField, start, end) => {
  const granularity = getTrendGranularity(start, end);
  const buckets = buildTrendBuckets(start, end, granularity);
  const map = Object.fromEntries(buckets.map((b) => [b.key, b]));

  for (const row of rows) {
    const key = bucketDate(row[dateField], granularity);
    if (key && map[key]) {
      map[key].value += Number(row[valueField] || 0);
      map[key].count += 1;
    }
  }

  return { granularity, series: buckets.map((b) => map[b.key] || b) };
};

const getCurrentWorkflowStage = (job) => {
  const keys = getWorkflowStageKeys(job);
  const wf = ensureV3WorkflowEvents(job.workflowEvents || {});
  for (const key of keys) {
    const stage = wf[key];
    if (!stage?.isCompleted && stage?.stageStatus !== "Complete") {
      return key;
    }
  }
  return "jobCompletion";
};

const countJobAwaitingSE = (job) => {
  const wf = ensureV3WorkflowEvents(job.workflowEvents || {});
  let count = 0;
  for (const key of Object.keys(wf)) {
    const stage = wf[key];
    if (
      stage?.siteEngineerStatus === "Pending" ||
      stage?.stageStatus === "Awaiting Site Engineer"
    ) {
      count += 1;
    }
  }
  return count;
};

const calcFabricationOverview = async () => {
  const items = await Fabrication.find({}).select("jobId progressPercentage status");
  const byJob = {};

  for (const item of items) {
    const key = String(item.jobId);
    if (!byJob[key]) byJob[key] = [];
    byJob[key].push(item);
  }

  let jobsWithFabrication = 0;
  let jobsInProgress = 0;
  let progressTotal = 0;

  for (const jobItems of Object.values(byJob)) {
    if (!jobItems.length) continue;
    jobsWithFabrication += 1;
    const avg =
      jobItems.reduce((sum, row) => {
        const pct = Number(row.progressPercentage || 0);
        if (pct > 0) return sum + pct;
        if (row.status === "Completed") return sum + 100;
        return sum;
      }, 0) / jobItems.length;

    progressTotal += avg;
    if (avg > 0 && avg < 100) jobsInProgress += 1;
  }

  return {
    jobsWithFabrication,
    jobsInProgress,
    avgProgressPercent:
      jobsWithFabrication > 0 ? Math.round(progressTotal / jobsWithFabrication) : 0,
  };
};

exports.adminOverview = async (req, res) => {
  try {
    const { start, end } = getFilterDateRange(req.query);
    const periodMatch = {
      createdAt: { $gte: start.toDate(), $lte: end.toDate() },
    };

    const jobs = await Job.find({ removed: { $ne: true } }).sort({ updatedAt: -1 });
    const workflowStageCounts = {};
    let avgProgressTotal = 0;
    let activeJobs = 0;
    let completedJobs = 0;
    let onHoldJobs = 0;
    let awaitingSEStages = 0;
    let contractValueActive = 0;

    for (const job of jobs) {
      const state = job.systemState || "New";
      if (state === "Active") {
        activeJobs += 1;
        contractValueActive += Number(job.lockedValue || 0);
      } else if (state === "Completed") {
        completedJobs += 1;
      }

      if (job.conditions?.onHold) onHoldJobs += 1;

      const wf = ensureV3WorkflowEvents(job.workflowEvents || {});
      const version = job.workflowVersion || 3;
      avgProgressTotal += calcJobCompletionPercent(wf, version);
      awaitingSEStages += countJobAwaitingSE(job);

      const currentStage = getCurrentWorkflowStage(job);
      workflowStageCounts[currentStage] = (workflowStageCounts[currentStage] || 0) + 1;
    }

    const workflowStages = Object.entries(workflowStageCounts)
      .map(([key, count]) => ({
        key,
        label: STAGE_LABELS[key] || key,
        count,
      }))
      .sort((a, b) => b.count - a.count);

    const openReviews = await SiteEngineerReview.find({
      status: { $in: OPEN_REVIEW_STATUSES },
    }).select("moduleStageKey status jobId title");

    const seByModuleMap = {};
    const seStatusMap = {};
    for (const review of openReviews) {
      const mod = review.moduleStageKey || "general";
      seByModuleMap[mod] = (seByModuleMap[mod] || 0) + 1;
      const st = review.status || "Pending Review";
      seStatusMap[st] = (seStatusMap[st] || 0) + 1;
    }

    const seReviewsByModule = Object.entries(seByModuleMap)
      .map(([key, count]) => ({
        key,
        label: STAGE_LABELS[key] || key,
        count,
      }))
      .sort((a, b) => b.count - a.count);

    const dayStart = moment().startOf("day").toDate();
    const dayEnd = moment().endOf("day").toDate();
    const todaySchedule = await ScheduleAssignment.find({
      startTime: { $gte: dayStart, $lte: dayEnd },
      status: { $nin: ["Cancelled"] },
    })
      .sort({ startTime: 1 })
      .limit(12)
      .lean();

    const jobIdSet = [
      ...new Set(todaySchedule.map((row) => String(row.jobId)).filter(Boolean)),
    ];
    const jobMap = {};
    if (jobIdSet.length) {
      const linked = await Job.find({ _id: { $in: jobIdSet } }).select("jobId customer");
      linked.forEach((j) => {
        jobMap[String(j._id)] = j;
      });
    }

    const fabrication = await calcFabricationOverview();

    const materialDelayed = await MaterialPurchase.countDocuments({
      status: "Delayed",
    });

    let procurementOpen = 0;
    try {
      procurementOpen = await PurchaseOrder.countDocuments({
        status: { $in: ["Ordered", "Delayed", "Partially Received"] },
      });
    } catch {
      procurementOpen = 0;
    }

    const leadStatuses = ["New", "Contacted", "Quoted", "Converted", "Lost"];
    const leadsByStatus = {};
    for (const status of leadStatuses) {
      leadsByStatus[status] = await Lead.countDocuments({ status });
    }
    const leadsInPeriod = await Lead.countDocuments(periodMatch);

    const quoteAgg = await Quote.aggregate([
      {
        $match: {
          $or: [{ removed: { $exists: false } }, { removed: false }],
          createdAt: { $gte: start.toDate(), $lte: end.toDate() },
        },
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          total: { $sum: "$totalAmount" },
        },
      },
    ]);

    const quotesByStatus = quoteAgg.map((row) => ({
      status: row._id || "Unknown",
      count: row.count,
      total: row.total || 0,
    }));

    const pipelineValue = quoteAgg
      .filter((row) => ["Draft", "Sent"].includes(row._id))
      .reduce((sum, row) => sum + (row.total || 0), 0);

    const acceptedWithoutJob = await Quote.countDocuments({
      status: "Accepted",
      $or: [{ jobId: null }, { jobId: { $exists: false } }],
    });

    let financial = {
      revenueCollected: 0,
      totalInvoiced: 0,
      outstandingInvoices: 0,
      overdueCount: 0,
      overdueValue: 0,
    };

    if (Payment()) {
      const payAgg = await Payment().aggregate([
        {
          $match: {
            removed: false,
            date: { $gte: start.toDate(), $lte: end.toDate() },
          },
        },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]);
      financial.revenueCollected = payAgg[0]?.total || 0;
    }

    if (Invoice()) {
      const invAgg = await Invoice().aggregate([
        { $match: { removed: false } },
        {
          $group: {
            _id: null,
            totalInvoiced: { $sum: "$total" },
            outstanding: {
              $sum: {
                $cond: [{ $gt: ["$amountDue", 0] }, "$amountDue", 0],
              },
            },
            overdueCount: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $gt: ["$amountDue", 0] },
                      { $lt: ["$expiredDate", new Date()] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            overdueValue: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $gt: ["$amountDue", 0] },
                      { $lt: ["$expiredDate", new Date()] },
                    ],
                  },
                  "$amountDue",
                  0,
                ],
              },
            },
          },
        },
      ]);
      financial.totalInvoiced = invAgg[0]?.totalInvoiced || 0;
      financial.outstandingInvoices = invAgg[0]?.outstanding || 0;
      financial.overdueCount = invAgg[0]?.overdueCount || 0;
      financial.overdueValue = invAgg[0]?.overdueValue || 0;
    }

    const recentJobs = jobs.slice(0, 8).map((job) => {
      const wf = ensureV3WorkflowEvents(job.workflowEvents || {});
      return {
        _id: job._id,
        jobId: job.jobId,
        customer: job.customer,
        systemState: job.systemState,
        stage: job.stage,
        currentWorkflowStage: getCurrentWorkflowStage(job),
        currentWorkflowLabel:
          STAGE_LABELS[getCurrentWorkflowStage(job)] || getCurrentWorkflowStage(job),
        completionPercent: calcJobCompletionPercent(wf, job.workflowVersion || 3),
        onHold: !!job.conditions?.onHold,
        updatedAt: job.updatedAt,
      };
    });

    const recentOpenReviews = openReviews.slice(0, 8).map((review) => ({
      _id: review._id,
      jobId: review.jobId,
      moduleStageKey: review.moduleStageKey,
      moduleLabel: STAGE_LABELS[review.moduleStageKey] || review.moduleStageKey,
      status: review.status,
      title: review.title,
    }));

    const periodJobs = jobs.filter((job) => {
      const created = moment(job.createdAt);
      return created.isBetween(start, end, null, "[]");
    });

    const periodLeads = await Lead.find(periodMatch).select("createdAt status");
    const periodQuotes = await Quote.find({
      $or: [{ removed: { $exists: false } }, { removed: false }],
      createdAt: { $gte: start.toDate(), $lte: end.toDate() },
    }).select("createdAt totalAmount status");

    let periodPayments = [];
    if (Payment()) {
      periodPayments = await Payment()
        .find({
          removed: false,
          date: { $gte: start.toDate(), $lte: end.toDate() },
        })
        .select("date amount");
    }

    const jobsTrend = fillCountTrend(periodJobs, "createdAt", start, end);
    const leadsTrend = fillCountTrend(periodLeads, "createdAt", start, end);
    const quotesTrend = fillCountTrend(periodQuotes, "createdAt", start, end);
    const revenueTrend = fillValueTrend(periodPayments, "date", "amount", start, end);

    const jobStateBreakdown = [
      { key: "active", label: "Active", count: activeJobs },
      { key: "completed", label: "Completed", count: completedJobs },
      { key: "onHold", label: "On Hold", count: onHoldJobs },
      {
        key: "other",
        label: "Other",
        count: Math.max(0, jobs.length - activeJobs - completedJobs - onHoldJobs),
      },
    ].filter((row) => row.count > 0);

    const quoteValueByStatus = quotesByStatus.map((row) => ({
      key: row.status,
      label: row.status,
      count: row.count,
      value: row.total,
    }));

    const seReviewStatusChart = Object.entries(seStatusMap).map(([key, count]) => ({
      key,
      label: key,
      count,
    }));

    return res.json({
      success: true,
      result: {
        operations: {
          totalJobs: jobs.length,
          activeJobs,
          completedJobs,
          onHoldJobs,
          avgProgressPercent:
            jobs.length > 0 ? Math.round(avgProgressTotal / jobs.length) : 0,
          awaitingSiteEngineerReviews: openReviews.length,
          awaitingSEStages,
          workflowStages,
          seReviewsByModule,
          seReviewStatus: seStatusMap,
          fabrication,
          materialLinesDelayed: materialDelayed,
          procurementOpen,
          todaySchedule: todaySchedule.map((row) => ({
            _id: row._id,
            title: row.title,
            role: row.role,
            assigneeName: row.assigneeName,
            status: row.status,
            startTime: row.startTime,
            endTime: row.endTime,
            jobCode: jobMap[String(row.jobId)]?.jobId || "",
            customer: jobMap[String(row.jobId)]?.customer || "",
          })),
        },
        commercial: {
          leadsByStatus,
          leadsInPeriod,
          quotesByStatus,
          pipelineValue,
          acceptedQuotesWithoutJob: acceptedWithoutJob,
        },
        financial: {
          ...financial,
          contractValueActive,
        },
        recent: {
          jobs: recentJobs,
          openReviews: recentOpenReviews,
        },
        analytics: {
          period: {
            start: start.toISOString(),
            end: end.toISOString(),
            granularity: getTrendGranularity(start, end),
          },
          jobsTrend,
          leadsTrend,
          quotesTrend,
          revenueTrend,
          jobStateBreakdown,
          quoteValueByStatus,
          seReviewStatusChart,
        },
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
