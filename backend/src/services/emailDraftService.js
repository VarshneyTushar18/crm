const EmailDraft = require("../models/appModels/EmailDraft");
const User = require("../models/appModels/User");
const sendMail = require("../controllers/middlewaresControllers/createAuthMiddleware/sendMail");
const { createNotification } = require("./notificationService");

const DRAFT_TTL_MS = 30 * 60 * 1000;

const mapInBatches = async (items, batchSize, fn) => {
  const results = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const chunk = items.slice(i, i + batchSize);
    const settled = await Promise.allSettled(chunk.map((item, idx) => fn(item, i + idx)));
    results.push(...settled);
  }
  return results;
};

const sendAnnouncementEmail = async ({ email, name, subject, title, body }) => {
  if (!email) return { success: false, skipped: true, reason: "no_email" };
  return sendMail({
    email: String(email).trim().toLowerCase(),
    name: name || "",
    subject,
    type: "announcement",
    title: title || subject,
    body: body || "",
    idurar_app_email: process.env.MAIL_FROM,
  });
};

const draftPreview = (draft) => ({
  draftId: String(draft._id),
  requiresApproval: draft.status === "pending",
  status: draft.status,
  scope: draft.scope,
  to: draft.to || "",
  recipientName: draft.recipientName || "",
  workerId: draft.workerId || "",
  recipientCount: (draft.recipients || []).length || (draft.to ? 1 : 0),
  subject: draft.subject,
  body: draft.body,
  title: draft.title || draft.subject,
  notifyInApp: !!draft.notifyInApp,
  expiresAt: draft.expiresAt,
  emailsSent: draft.emailsSent,
  emailFailed: draft.emailFailed,
  notifiedCount: draft.notifiedCount,
  hint:
    draft.status === "pending"
      ? "Show the draft to the admin (they can Edit subject/body in the UI) and wait for Approve & Send. Do NOT claim the email was sent yet."
      : undefined,
});

/**
 * Create a pending email draft (no send). Used by assistant prepare_worker_email tool.
 */
async function prepareWorkerEmailDraft({
  scope = "single",
  worker,
  subject,
  body,
  title,
  notifyInApp = true,
  actor = {},
  roster = [],
} = {}) {
  const subj = String(subject || "").trim();
  const msg = String(body || "").trim();
  if (!subj) return { error: "subject is required" };
  if (!msg) return { error: "body is required" };

  const actorName =
    [actor.name, actor.surname].filter(Boolean).join(" ").trim() ||
    actor.email ||
    "Admin";

  const expiresAt = new Date(Date.now() + DRAFT_TTL_MS);
  const wantAll = String(scope || "single").toLowerCase() === "all";

  if (wantAll) {
    const seen = new Set();
    const recipients = [];
    (roster || []).forEach((w) => {
      const email = String(w.email || "")
        .trim()
        .toLowerCase();
      if (!email || seen.has(email)) return;
      seen.add(email);
      recipients.push({
        email,
        name: w.workerName || "",
        workerId: w.workerId || "",
      });
    });
    if (!recipients.length) {
      return { error: "No workers with email addresses found on the roster." };
    }

    const draft = await EmailDraft.create({
      scope: "all",
      to: "",
      recipientName: "All workers",
      workerId: "",
      recipients,
      subject: subj,
      body: msg,
      title: String(title || subj).trim(),
      notifyInApp: notifyInApp !== false && notifyInApp !== "false",
      status: "pending",
      createdById: actor.id || null,
      createdByName: actorName,
      expiresAt,
    });

    return {
      ok: true,
      ...draftPreview(draft),
      sampleRecipients: recipients.slice(0, 5).map((r) => ({
        name: r.name,
        email: r.email,
      })),
    };
  }

  if (!worker?.email) {
    return {
      error:
        "Could not resolve a worker email. Pass workerId / workerName of someone on the roster with an email.",
      worker: worker
        ? {
            workerName: worker.workerName,
            workerId: worker.workerId,
            email: worker.email || "",
          }
        : null,
    };
  }

  const draft = await EmailDraft.create({
    scope: "single",
    to: String(worker.email).trim().toLowerCase(),
    recipientName: worker.workerName || "",
    workerId: worker.workerId || "",
    recipients: [
      {
        email: String(worker.email).trim().toLowerCase(),
        name: worker.workerName || "",
        workerId: worker.workerId || "",
      },
    ],
    subject: subj,
    body: msg,
    title: String(title || subj).trim(),
    notifyInApp: notifyInApp !== false && notifyInApp !== "false",
    status: "pending",
    createdById: actor.id || null,
    createdByName: actorName,
    expiresAt,
  });

  return {
    ok: true,
    ...draftPreview(draft),
  };
}

async function sendEmailDraft(draftId, actor = {}) {
  const id = String(draftId || "").trim();
  if (!id) return { error: "draftId is required" };

  const draft = await EmailDraft.findById(id);
  if (!draft) return { error: "Draft not found" };

  if (draft.status === "sent") {
    return { error: "This draft was already sent", ...draftPreview(draft) };
  }
  if (draft.status === "cancelled") {
    return { error: "This draft was cancelled", ...draftPreview(draft) };
  }
  if (draft.expiresAt && new Date(draft.expiresAt).getTime() < Date.now()) {
    draft.status = "cancelled";
    draft.lastError = "expired";
    await draft.save();
    return { error: "Draft expired. Ask the assistant to prepare the email again." };
  }

  if (actor.id && draft.createdById && String(draft.createdById) !== String(actor.id)) {
    return { error: "Only the admin who drafted this email can approve it." };
  }

  const recipients =
    draft.recipients?.length > 0
      ? draft.recipients
      : draft.to
        ? [{ email: draft.to, name: draft.recipientName, workerId: draft.workerId }]
        : [];

  if (!recipients.length) {
    return { error: "Draft has no recipients" };
  }

  let emailsSent = 0;
  let emailFailed = 0;
  const results = await mapInBatches(recipients, 10, (r) =>
    sendAnnouncementEmail({
      email: r.email,
      name: r.name,
      subject: draft.subject,
      title: draft.title || draft.subject,
      body: draft.body,
    })
  );
  results.forEach((r) => {
    if (r.status === "fulfilled" && r.value?.success) emailsSent += 1;
    else emailFailed += 1;
  });

  let notifiedCount = 0;
  if (draft.notifyInApp) {
    if (draft.scope === "all") {
      const workers = await User.find({
        role: "worker",
        isActive: { $ne: false },
      }).select("_id");
      const notifResults = await mapInBatches(workers, 20, (user) =>
        createNotification({
          userId: user._id,
          role: "worker",
          type: "general",
          title: draft.title || draft.subject,
          body: draft.body,
          link: "/worker",
          metadata: { action: "assistant_email", draftId: draft._id },
        })
      );
      notifiedCount = notifResults.filter(
        (r) => r.status === "fulfilled" && r.value
      ).length;
    } else {
      const email = draft.to || recipients[0]?.email;
      const workerId = draft.workerId || recipients[0]?.workerId;
      const name = draft.recipientName || recipients[0]?.name;
      const or = [];
      if (email) or.push({ email: String(email).toLowerCase() });
      if (workerId) {
        or.push({
          workerId: new RegExp(
            `^${String(workerId).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
            "i"
          ),
        });
      }
      if (name) {
        or.push({
          name: new RegExp(
            `^${String(name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
            "i"
          ),
        });
      }
      if (or.length) {
        const user = await User.findOne({
          role: "worker",
          isActive: { $ne: false },
          $or: or,
        }).select("_id");
        if (user) {
          const n = await createNotification({
            userId: user._id,
            role: "worker",
            type: "general",
            title: draft.title || draft.subject,
            body: draft.body,
            link: "/worker",
            metadata: { action: "assistant_email", draftId: draft._id },
          });
          if (n) notifiedCount = 1;
        }
      }
    }
  }

  draft.status = emailsSent > 0 ? "sent" : "failed";
  draft.sentAt = new Date();
  draft.emailsSent = emailsSent;
  draft.emailFailed = emailFailed;
  draft.notifiedCount = notifiedCount;
  if (emailsSent === 0) draft.lastError = "All email sends failed";
  await draft.save();

  return {
    ok: emailsSent > 0,
    ...draftPreview(draft),
    emailsSent,
    emailFailed,
    notifiedCount,
    hint:
      process.env.NODE_ENV !== "production"
        ? "Local/dev: emails are logged to the server console (not sent via Resend)."
        : undefined,
  };
}

async function cancelEmailDraft(draftId, actor = {}) {
  const id = String(draftId || "").trim();
  if (!id) return { error: "draftId is required" };

  const draft = await EmailDraft.findById(id);
  if (!draft) return { error: "Draft not found" };
  if (draft.status === "sent") {
    return { error: "Already sent; cannot cancel", ...draftPreview(draft) };
  }
  if (actor.id && draft.createdById && String(draft.createdById) !== String(actor.id)) {
    return { error: "Only the admin who drafted this email can cancel it." };
  }

  draft.status = "cancelled";
  await draft.save();
  return { ok: true, ...draftPreview(draft) };
}

/**
 * Update subject/body of a pending draft before Approve & Send.
 * Recipients/scope are not editable here — ask the assistant to redraft for that.
 */
async function updateEmailDraft(draftId, patch = {}, actor = {}) {
  const id = String(draftId || "").trim();
  if (!id) return { error: "draftId is required" };

  const draft = await EmailDraft.findById(id);
  if (!draft) return { error: "Draft not found" };

  if (draft.status === "sent") {
    return { error: "Already sent; cannot edit", ...draftPreview(draft) };
  }
  if (draft.status === "cancelled") {
    return { error: "Draft was cancelled; cannot edit", ...draftPreview(draft) };
  }
  if (draft.status !== "pending") {
    return { error: "Only pending drafts can be edited", ...draftPreview(draft) };
  }
  if (draft.expiresAt && new Date(draft.expiresAt).getTime() < Date.now()) {
    draft.status = "cancelled";
    draft.lastError = "expired";
    await draft.save();
    return { error: "Draft expired. Ask the assistant to prepare the email again." };
  }
  if (actor.id && draft.createdById && String(draft.createdById) !== String(actor.id)) {
    return { error: "Only the admin who drafted this email can edit it." };
  }

  const nextSubject =
    patch.subject !== undefined ? String(patch.subject || "").trim() : draft.subject;
  const nextBody =
    patch.body !== undefined ? String(patch.body || "").trim() : draft.body;
  const nextTitle =
    patch.title !== undefined
      ? String(patch.title || "").trim()
      : patch.subject !== undefined
        ? nextSubject
        : draft.title;

  if (!nextSubject) return { error: "subject is required" };
  if (!nextBody) return { error: "body is required" };

  draft.subject = nextSubject;
  draft.body = nextBody;
  draft.title = nextTitle || nextSubject;
  await draft.save();

  return { ok: true, ...draftPreview(draft) };
}

async function getEmailDraft(draftId) {
  const draft = await EmailDraft.findById(String(draftId || "").trim());
  if (!draft) return null;
  return draftPreview(draft);
}

module.exports = {
  prepareWorkerEmailDraft,
  sendEmailDraft,
  cancelEmailDraft,
  updateEmailDraft,
  getEmailDraft,
  draftPreview,
  DRAFT_TTL_MS,
};
