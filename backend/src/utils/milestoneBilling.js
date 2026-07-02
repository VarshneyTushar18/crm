const mongoose = require("mongoose");
const { calcJobCompletionPercent } = require("./workflowDefaults");
const { notifyWorkflow } = require("../services/notificationService");

const MILESTONES = [30, 60, 80, 100];

const Invoice = () => mongoose.models.Invoice;
const Admin = () => mongoose.models.Admin;
const Job = () => mongoose.models.Job;

const nextInvoiceNumber = async () => {
  const count = await Invoice().countDocuments();
  const year = new Date().getFullYear();
  return { number: `INV-M${year}-${String(count + 1).padStart(4, "0")}`, year };
};

const processMilestoneBilling = async (job, actor = "System") => {
  if (!job?._id || !Invoice()) return { created: [] };

  const percent = calcJobCompletionPercent(
    job.workflowEvents || {},
    job.workflowVersion || 1
  );

  if (!job.billingMilestones) job.billingMilestones = { triggered: [] };
  const triggered = new Set((job.billingMilestones.triggered || []).map(Number));
  const created = [];

  for (const milestone of MILESTONES) {
    if (percent < milestone || triggered.has(milestone)) continue;

    const contractValue = Number(job.lockedValue || 0);
    if (contractValue <= 0) continue;

    const amount = Math.round((contractValue * milestone) / 100 * 100) / 100;
    const existing = await Invoice().findOne({
      job: job._id,
      percentageOfContract: milestone,
      removed: false,
    });
    if (existing) {
      triggered.add(milestone);
      continue;
    }

    let admin = await Admin().findOne({ removed: { $ne: true } });
    if (!admin) admin = await Admin().findOne();

    const { number, year } = await nextInvoiceNumber();
    const now = new Date();
    const due = new Date(now);
    due.setDate(due.getDate() + 14);

    const invoice = await Invoice().create({
      createdBy: admin?._id || job._id,
      number,
      year,
      date: now,
      expiredDate: due,
      job: job._id,
      invoiceType: milestone === 100 ? "Final" : "Progress Payment",
      stage: "jobCompletion",
      percentageOfContract: milestone,
      items: [
        {
          itemName: `${milestone}% Progress Milestone`,
          description: `Auto-generated at ${percent}% project completion`,
          quantity: 1,
          price: amount,
          total: amount,
        },
      ],
      subTotal: amount,
      taxTotal: 0,
      total: amount,
      amountPaid: 0,
      amountDue: amount,
      status: "Draft",
      currency: "AUD",
    });

    triggered.add(milestone);
    created.push(invoice);

    await notifyWorkflow({
      job,
      stageKey: "billing",
      message: `Milestone invoice draft created (${milestone}%) for job ${job.jobId}`,
      actor,
    });
  }

  if (created.length) {
    const totalInvoiced = created.reduce((s, inv) => s + Number(inv.total || 0), 0);
    await Job().findByIdAndUpdate(job._id, {
      $set: { "billingMilestones.triggered": [...triggered] },
      $inc: { totalInvoiced },
    });
    job.billingMilestones = { triggered: [...triggered] };
    job.totalInvoiced = Number(job.totalInvoiced || 0) + totalInvoiced;
  } else if (triggered.size !== (job.billingMilestones.triggered || []).length) {
    await Job().findByIdAndUpdate(job._id, {
      $set: { "billingMilestones.triggered": [...triggered] },
    });
  }

  return { created, percent };
};

module.exports = { processMilestoneBilling, MILESTONES };
