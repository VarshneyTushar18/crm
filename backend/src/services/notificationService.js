const Notification = require("../models/appModels/Notification");
const User = require("../models/appModels/User");
const ScheduleAssignment = require("../models/appModels/ScheduleAssignment");
const { STAGE_LABELS } = require("../utils/workflowDefaults");

const createNotification = async ({
  userId = null,
  customerId = null,
  role = "admin",
  type = "general",
  title,
  body = "",
  link = "",
  jobId = null,
  scheduledFor = null,
  metadata = {},
}) => {
  if (!title) return null;

  return Notification.create({
    userId,
    customerId,
    role,
    type,
    title,
    body,
    link,
    jobId,
    scheduledFor,
    metadata,
  });
};

const notifyWorkflow = async ({ job, stageKey, message, actor }) => {
  const jobLabel = job?.jobId || job?._id;
  return createNotification({
    role: "admin",
    type: "workflow",
    title: `Workflow update: ${stageKey}`,
    body: message || `${stageKey} updated on job ${jobLabel} by ${actor || "System"}`,
    link: job?._id ? `/admin/job/${job._id}` : "",
    jobId: job?._id || null,
    metadata: { stageKey, actor },
  });
};

const notifyCustomer = async ({ customerId, job, title, body, type = "workflow", metadata = {} }) => {
  if (!customerId || !title) return null;

  const jobLabel = job?.jobId || "";
  return createNotification({
    customerId,
    role: "customer",
    type,
    title,
    body: body || `Update on project ${jobLabel}`,
    link: job?._id ? `/portal/projects/${job._id}` : "/portal/projects",
    jobId: job?._id || null,
    metadata,
  });
};

const notifySiteEngineer = async ({ job, stageKey, actor, message }) => {
  const stageLabel = STAGE_LABELS[stageKey] || stageKey;
  const jobLabel = job?.jobId || job?._id;
  const title = `Approval required: ${stageLabel}`;
  const body =
    message ||
    `${stageLabel} on job ${jobLabel} needs your review. Sent by ${actor || "office staff"}.`;
  const link = job?._id ? `/admin/site-engineer?jobId=${job._id}` : "/admin/site-engineer";

  const seUsers = await User.find({
    role: "siteEngineer",
    isActive: { $ne: false },
  }).select("_id");

  if (seUsers.length) {
    await Promise.all(
      seUsers.map((user) =>
        createNotification({
          userId: user._id,
          role: "siteengineer",
          type: "workflow",
          title,
          body,
          link,
          jobId: job?._id || null,
          metadata: { stageKey, actor, action: "se_review_requested" },
        })
      )
    );
    return seUsers.length;
  }

  await createNotification({
    role: "siteengineer",
    type: "workflow",
    title,
    body,
    link,
    jobId: job?._id || null,
    metadata: { stageKey, actor, action: "se_review_requested" },
  });
  return 1;
};

const notifyEta = async ({ customerId, job, title, body, etaTime, metadata = {} }) => {
  if (!customerId || !title) return null;
  return createNotification({
    customerId,
    role: "customer",
    type: "eta",
    title,
    body: body || `ETA update for project ${job?.jobId || ""}`,
    link: job?._id ? `/portal/projects/${job._id}` : "/portal/projects",
    jobId: job?._id || null,
    scheduledFor: etaTime || null,
    metadata: { ...metadata, etaTime },
  });
};

const notifyAdmin = async ({ title, body, link = "", jobId = null, type = "general", metadata = {} }) => {
  if (!title) return null;

  const adminUsers = await User.find({
    role: "admin",
    isActive: { $ne: false },
  }).select("_id");

  if (adminUsers.length) {
    await Promise.all(
      adminUsers.map((user) =>
        createNotification({
          userId: user._id,
          role: "admin",
          type,
          title,
          body,
          link,
          jobId,
          metadata,
        })
      )
    );
    return adminUsers.length;
  }

  return createNotification({
    role: "admin",
    type,
    title,
    body,
    link,
    jobId,
    metadata,
  });
};

const notifyAdminPaymentClaim = async ({
  invoice,
  customer,
  paymentRef,
  paymentMode,
  amount,
}) => {
  const invoiceNumber = invoice?.number || "Invoice";
  const customerName = customer?.companyName || customer?.name || "Customer";
  const jobLabel = invoice?.job?.jobId || "";

  return notifyAdmin({
    type: "invoice_reminder",
    title: `Payment claim: ${invoiceNumber}`,
    body: `${customerName} reported payment for ${invoiceNumber}${jobLabel ? ` (${jobLabel})` : ""}. Ref: ${paymentRef || "—"} · ${paymentMode || "—"} · $${Number(amount || invoice?.amountDue || 0).toLocaleString()}`,
    link: invoice?._id ? `/admin/invoice/read/${invoice._id}` : "/admin/invoice",
    jobId: invoice?.job?._id || invoice?.job || null,
    metadata: {
      action: "payment_claim",
      invoiceId: invoice?._id,
      paymentRef,
      paymentMode,
      amount: amount || invoice?.amountDue,
    },
  });
};

const escapeRegex = (value) => String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const notifyJobComment = async ({ job, comment, actor }) => {
  if (!job?._id || !comment) return null;

  const jobLabel = job.jobId || "Job";
  const preview = String(comment.message || "").slice(0, 140);
  const title = `Team chat — ${jobLabel}`;
  const body = `${actor?.name || "Someone"} (${actor?.role || "staff"}): ${preview}`;
  const authorId = actor?.id ? String(actor.id) : null;

  const adminLink = `/admin/job/${job._id}`;
  const seLink = `/admin/site-engineer?jobId=${job._id}`;
  const workerLink = `/worker?jobId=${job._id}`;

  const tasks = [];

  const adminUsers = await User.find({ role: "admin", isActive: { $ne: false } }).select("_id");
  adminUsers.forEach((user) => {
    if (authorId && String(user._id) === authorId) return;
    tasks.push(
      createNotification({
        userId: user._id,
        role: "admin",
        type: "general",
        title,
        body,
        link: adminLink,
        jobId: job._id,
        metadata: { action: "job_comment", commentId: comment._id },
      })
    );
  });

  const seUsers = await User.find({ role: "siteEngineer", isActive: { $ne: false } }).select("_id");
  seUsers.forEach((user) => {
    if (authorId && String(user._id) === authorId) return;
    tasks.push(
      createNotification({
        userId: user._id,
        role: "siteengineer",
        type: "general",
        title,
        body,
        link: seLink,
        jobId: job._id,
        metadata: { action: "job_comment", commentId: comment._id },
      })
    );
  });

  const assignments = await ScheduleAssignment.find({ jobId: job._id })
    .select("assigneeName assignees teams")
    .lean();

  const notifyUserIds = new Set();
  if (authorId) notifyUserIds.add(authorId);

  const workerNames = new Set();
  for (const assignment of assignments) {
    if (assignment.assigneeName) workerNames.add(assignment.assigneeName);
    (assignment.assignees || []).forEach((item) => {
      if (item?.assigneeName) workerNames.add(item.assigneeName);
    });
    (assignment.teams || []).forEach((team) => {
      if (team) workerNames.add(team);
    });
  }

  for (const assigneeName of workerNames) {
    const workers = await User.find({
      role: "worker",
      isActive: { $ne: false },
      name: new RegExp(`^${escapeRegex(assigneeName)}$`, "i"),
    }).select("_id");

    workers.forEach((user) => {
      if (authorId && String(user._id) === authorId) return;
      if (notifyUserIds.has(String(user._id))) return;
      notifyUserIds.add(String(user._id));
      tasks.push(
        createNotification({
          userId: user._id,
          role: "worker",
          type: "general",
          title,
          body,
          link: workerLink,
          jobId: job._id,
          metadata: { action: "job_comment", commentId: comment._id },
        })
      );
    });
  }

  if (tasks.length) {
    await Promise.all(tasks);
  }

  return tasks.length;
};

module.exports = {
  createNotification,
  notifyWorkflow,
  notifyCustomer,
  notifySiteEngineer,
  notifyEta,
  notifyAdmin,
  notifyAdminPaymentClaim,
  notifyJobComment,
};
