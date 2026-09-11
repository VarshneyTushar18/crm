const moment = require("moment");
const Lead = require("../models/appModels/Lead");
const Notification = require("../models/appModels/Notification");
const { notifyAdmin } = require("./notificationService");

const FOLLOW_UP_WINDOW_DAYS = 10;
const ACTION = "lead_follow_up";

const dayKey = (date = new Date()) => moment(date).format("YYYY-MM-DD");

const formatFollowUpDate = (date) => moment(date).format("DD MMM YYYY");

/**
 * Create one admin notification per lead per calendar day when
 * nextFollowUpDate is between today and today + 10 days (inclusive).
 */
const processLeadFollowUpReminders = async () => {
  const todayStart = moment().startOf("day");
  const windowEnd = moment().startOf("day").add(FOLLOW_UP_WINDOW_DAYS, "days").endOf("day");
  const reminderDay = dayKey(todayStart);

  const leads = await Lead.find({
    nextFollowUpDate: {
      $gte: todayStart.toDate(),
      $lte: windowEnd.toDate(),
    },
    status: { $nin: ["Converted", "Lost"] },
    isLocked: { $ne: true },
  })
    .select("_id clientName contactPerson nextFollowUpDate status assignedSalesperson")
    .lean();

  if (!leads.length) {
    return { checked: 0, created: 0 };
  }

  let created = 0;

  for (const lead of leads) {
    const leadId = String(lead._id);
    const followUpDate = lead.nextFollowUpDate;

    const alreadySent = await Notification.exists({
      type: "appointment_reminder",
      "metadata.action": ACTION,
      "metadata.leadId": leadId,
      "metadata.reminderDay": reminderDay,
    });

    if (alreadySent) continue;

    const clientName = lead.clientName || lead.contactPerson || "Lead";
    const dueLabel = formatFollowUpDate(followUpDate);
    const daysUntil = moment(followUpDate).startOf("day").diff(todayStart, "days");
    const whenLabel =
      daysUntil === 0 ? "today" : daysUntil === 1 ? "tomorrow" : `in ${daysUntil} days`;

    const salesperson = lead.assignedSalesperson
      ? ` · Salesperson: ${lead.assignedSalesperson}`
      : "";

    await notifyAdmin({
      type: "appointment_reminder",
      title: `Lead follow-up: ${clientName}`,
      body: `Follow-up due ${whenLabel} (${dueLabel})${salesperson}`,
      link: `/admin/lead/${leadId}`,
      metadata: {
        action: ACTION,
        leadId,
        reminderDay,
        followUpDate: followUpDate ? new Date(followUpDate).toISOString() : null,
        assignedSalesperson: lead.assignedSalesperson || "",
      },
    });

    created += 1;
  }

  return { checked: leads.length, created };
};

let schedulerStarted = false;

const startLeadFollowUpReminderScheduler = () => {
  if (schedulerStarted) return;
  schedulerStarted = true;

  const run = async () => {
    try {
      const result = await processLeadFollowUpReminders();
      if (result.created > 0) {
        console.log(
          `📅 Lead follow-up reminders: checked ${result.checked}, created ${result.created}`
        );
      }
    } catch (err) {
      console.error("Lead follow-up reminder job failed:", err.message);
    }
  };

  // Run shortly after boot, then hourly (deduped per day).
  setTimeout(run, 15_000);
  setInterval(run, 60 * 60 * 1000);
};

module.exports = {
  FOLLOW_UP_WINDOW_DAYS,
  processLeadFollowUpReminders,
  startLeadFollowUpReminderScheduler,
};
