const { runAssistantChat } = require("../services/assistant/runAssistant");
const {
  sendEmailDraft,
  cancelEmailDraft,
  updateEmailDraft,
  getEmailDraft,
} = require("../services/emailDraftService");

const getActor = (req) => ({
  id: req.user?._id ? String(req.user._id) : null,
  name: String(req.user?.name || "").trim(),
  surname: String(req.user?.surname || "").trim(),
  email: String(req.user?.email || "").trim(),
  role: String(req.user?.role || "").trim(),
});

const validateChatBody = (req, res) => {
  const role = String(req.user?.role || "").trim();
  if (role !== "admin") {
    res.status(403).json({
      success: false,
      message: "CRM assistant is available to admin users only.",
    });
    return null;
  }

  const { messages } = req.body || {};
  if (!Array.isArray(messages) || !messages.length) {
    res.status(400).json({
      success: false,
      message: "messages array is required",
    });
    return null;
  }

  const last = messages[messages.length - 1];
  if (last?.role !== "user" || !String(last.content || "").trim()) {
    res.status(400).json({
      success: false,
      message: "Last message must be a non-empty user message",
    });
    return null;
  }

  return messages;
};

exports.chat = async (req, res) => {
  try {
    const messages = validateChatBody(req, res);
    if (!messages) return;

    const actor = getActor(req);
    const {
      reply,
      messages: nextMessages,
      emailDrafts = [],
    } = await runAssistantChat(messages, { actor });

    return res.json({
      success: true,
      result: {
        reply,
        messages: nextMessages,
        emailDrafts,
      },
    });
  } catch (err) {
    console.error("assistant.chat:", err.message);
    const status = err.message?.includes("GROQ_API_KEY") ? 503 : 500;
    return res.status(status).json({
      success: false,
      message: err.message || "Assistant request failed",
    });
  }
};

/** SSE stream: status / delta / reset / done / error — same answer quality as /chat. */
exports.chatStream = async (req, res) => {
  const messages = validateChatBody(req, res);
  if (!messages) return;

  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  if (typeof res.flushHeaders === "function") res.flushHeaders();

  const send = (payload) => {
    if (res.writableEnded) return;
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
    if (typeof res.flush === "function") res.flush();
  };

  let closed = false;
  req.on("close", () => {
    closed = true;
  });

  try {
    const actor = getActor(req);
    const result = await runAssistantChat(messages, {
      actor,
      onEvent: (ev) => {
        if (!closed) send(ev);
      },
    });
    if (!closed) {
      send({
        type: "done",
        result: {
          reply: result.reply,
          messages: result.messages,
          emailDrafts: result.emailDrafts || [],
        },
      });
    }
  } catch (err) {
    console.error("assistant.chatStream:", err.message);
    if (!closed) {
      send({
        type: "error",
        message: err.message || "Assistant request failed",
      });
    }
  }

  if (!res.writableEnded) res.end();
};

exports.sendEmailDraft = async (req, res) => {
  try {
    if (String(req.user?.role || "").trim() !== "admin") {
      return res.status(403).json({ success: false, message: "Admin only" });
    }
    const result = await sendEmailDraft(req.params.id, getActor(req));
    if (result?.error) {
      return res.status(400).json({ success: false, message: result.error, result });
    }
    return res.json({ success: true, result });
  } catch (err) {
    console.error("assistant.sendEmailDraft:", err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.cancelEmailDraft = async (req, res) => {
  try {
    if (String(req.user?.role || "").trim() !== "admin") {
      return res.status(403).json({ success: false, message: "Admin only" });
    }
    const result = await cancelEmailDraft(req.params.id, getActor(req));
    if (result?.error) {
      return res.status(400).json({ success: false, message: result.error, result });
    }
    return res.json({ success: true, result });
  } catch (err) {
    console.error("assistant.cancelEmailDraft:", err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateEmailDraft = async (req, res) => {
  try {
    if (String(req.user?.role || "").trim() !== "admin") {
      return res.status(403).json({ success: false, message: "Admin only" });
    }
    const { subject, body, title } = req.body || {};
    const result = await updateEmailDraft(
      req.params.id,
      { subject, body, title },
      getActor(req)
    );
    if (result?.error) {
      return res.status(400).json({ success: false, message: result.error, result });
    }
    return res.json({ success: true, result });
  } catch (err) {
    console.error("assistant.updateEmailDraft:", err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.getEmailDraft = async (req, res) => {
  try {
    if (String(req.user?.role || "").trim() !== "admin") {
      return res.status(403).json({ success: false, message: "Admin only" });
    }
    const result = await getEmailDraft(req.params.id);
    if (!result) {
      return res.status(404).json({ success: false, message: "Draft not found" });
    }
    return res.json({ success: true, result });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Stream a jobs+stages Excel/CSV report built in memory on each request.
 * Nothing is written to disk, public/, or Mongo.
 */
exports.exportJobs = async (req, res) => {
  try {
    const role = String(req.user?.role || "").trim();
    if (role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "CRM assistant exports are available to admin users only.",
      });
    }

    const {
      fetchJobsForExport,
      buildJobsExportBuffer,
      stampFilename,
    } = require("../services/assistant/jobsExcelExport");

    const limit = req.query.limit;
    const systemState = req.query.systemState
      ? String(req.query.systemState).trim()
      : undefined;
    const search = req.query.search ? String(req.query.search).trim() : undefined;
    const format =
      String(req.query.format || "excel").toLowerCase() === "csv" ? "csv" : "excel";

    const allowedStates = ["New", "Active", "Completed", "Closed"];
    if (systemState && !allowedStates.includes(systemState)) {
      return res.status(400).json({
        success: false,
        message: `systemState must be one of: ${allowedStates.join(", ")}`,
      });
    }

    const rows = await fetchJobsForExport({ systemState, search, limit });
    const { buffer, contentType, extension } = buildJobsExportBuffer(rows, format);
    const filename = stampFilename("jobs-stages", extension);

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Cache-Control", "no-store");
    return res.send(buffer);
  } catch (err) {
    console.error("assistant.exportJobs:", err.message);
    return res.status(500).json({
      success: false,
      message: err.message || "Export failed",
    });
  }
};

const assertAdminExport = (req, res) => {
  if (String(req.user?.role || "").trim() !== "admin") {
    res.status(403).json({
      success: false,
      message: "CRM assistant exports are available to admin users only.",
    });
    return false;
  }
  return true;
};

exports.exportInvoices = async (req, res) => {
  try {
    if (!assertAdminExport(req, res)) return;
    const {
      fetchInvoicesForExport,
      buildInvoicesExportBuffer,
      stampFilename,
    } = require("../services/assistant/financeSalesExcelExport");

    const format =
      String(req.query.format || "excel").toLowerCase() === "csv" ? "csv" : "excel";
    const rows = await fetchInvoicesForExport({
      period: req.query.period,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      status: req.query.status,
      limit: req.query.limit,
    });
    const { buffer, contentType, extension } = buildInvoicesExportBuffer(rows, format);
    const filename = stampFilename("invoices", extension);
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Cache-Control", "no-store");
    return res.send(buffer);
  } catch (err) {
    console.error("assistant.exportInvoices:", err.message);
    return res.status(500).json({ success: false, message: err.message || "Export failed" });
  }
};

exports.exportPayments = async (req, res) => {
  try {
    if (!assertAdminExport(req, res)) return;
    const {
      fetchPaymentsForExport,
      buildPaymentsExportBuffer,
      stampFilename,
    } = require("../services/assistant/financeSalesExcelExport");

    const format =
      String(req.query.format || "excel").toLowerCase() === "csv" ? "csv" : "excel";
    const rows = await fetchPaymentsForExport({
      period: req.query.period,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      limit: req.query.limit,
    });
    const { buffer, contentType, extension } = buildPaymentsExportBuffer(rows, format);
    const filename = stampFilename("payments", extension);
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Cache-Control", "no-store");
    return res.send(buffer);
  } catch (err) {
    console.error("assistant.exportPayments:", err.message);
    return res.status(500).json({ success: false, message: err.message || "Export failed" });
  }
};

exports.exportAttendance = async (req, res) => {
  try {
    if (!assertAdminExport(req, res)) return;
    const {
      fetchAttendanceForExport,
      buildAttendanceExportBuffer,
      stampFilename,
    } = require("../services/assistant/financeSalesExcelExport");

    const format =
      String(req.query.format || "excel").toLowerCase() === "csv" ? "csv" : "excel";
    const rows = await fetchAttendanceForExport({
      period: req.query.period,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      workerName: req.query.workerName,
      limit: req.query.limit,
    });
    const { buffer, contentType, extension } = buildAttendanceExportBuffer(rows, format);
    const filename = stampFilename("attendance", extension);
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Cache-Control", "no-store");
    return res.send(buffer);
  } catch (err) {
    console.error("assistant.exportAttendance:", err.message);
    return res.status(500).json({ success: false, message: err.message || "Export failed" });
  }
};

const sendExport = (res, buffer, contentType, filename) => {
  res.setHeader("Content-Type", contentType);
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Cache-Control", "no-store");
  return res.send(buffer);
};

exports.exportLeads = async (req, res) => {
  try {
    if (!assertAdminExport(req, res)) return;
    const {
      fetchLeadsForExport,
      buildLeadsExportBuffer,
      stampFilename,
    } = require("../services/assistant/catalogExcelExport");
    const format =
      String(req.query.format || "excel").toLowerCase() === "csv" ? "csv" : "excel";
    const rows = await fetchLeadsForExport({
      period: req.query.period,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      status: req.query.status,
      openOnly: req.query.openOnly,
      limit: req.query.limit,
    });
    const { buffer, contentType, extension } = buildLeadsExportBuffer(rows, format);
    return sendExport(res, buffer, contentType, stampFilename("leads", extension));
  } catch (err) {
    console.error("assistant.exportLeads:", err.message);
    return res.status(500).json({ success: false, message: err.message || "Export failed" });
  }
};

exports.exportQuotes = async (req, res) => {
  try {
    if (!assertAdminExport(req, res)) return;
    const {
      fetchQuotesForExport,
      buildQuotesExportBuffer,
      stampFilename,
    } = require("../services/assistant/catalogExcelExport");
    const format =
      String(req.query.format || "excel").toLowerCase() === "csv" ? "csv" : "excel";
    const rows = await fetchQuotesForExport({
      period: req.query.period,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      status: req.query.status,
      openOnly: req.query.openOnly,
      limit: req.query.limit,
    });
    const { buffer, contentType, extension } = buildQuotesExportBuffer(rows, format);
    return sendExport(res, buffer, contentType, stampFilename("quotes", extension));
  } catch (err) {
    console.error("assistant.exportQuotes:", err.message);
    return res.status(500).json({ success: false, message: err.message || "Export failed" });
  }
};

exports.exportDefects = async (req, res) => {
  try {
    if (!assertAdminExport(req, res)) return;
    const {
      fetchDefectsForExport,
      buildDefectsExportBuffer,
      stampFilename,
    } = require("../services/assistant/catalogExcelExport");
    const format =
      String(req.query.format || "excel").toLowerCase() === "csv" ? "csv" : "excel";
    const openOnly =
      req.query.openOnly === undefined ? true : req.query.openOnly;
    const rows = await fetchDefectsForExport({
      period: req.query.period || "all",
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      status: req.query.status,
      type: req.query.type,
      openOnly,
      limit: req.query.limit,
    });
    const { buffer, contentType, extension } = buildDefectsExportBuffer(rows, format);
    return sendExport(res, buffer, contentType, stampFilename("defects-snags", extension));
  } catch (err) {
    console.error("assistant.exportDefects:", err.message);
    return res.status(500).json({ success: false, message: err.message || "Export failed" });
  }
};

exports.exportPurchaseOrders = async (req, res) => {
  try {
    if (!assertAdminExport(req, res)) return;
    const {
      fetchPurchaseOrdersForExport,
      buildPurchaseOrdersExportBuffer,
      stampFilename,
    } = require("../services/assistant/catalogExcelExport");
    const format =
      String(req.query.format || "excel").toLowerCase() === "csv" ? "csv" : "excel";
    const rows = await fetchPurchaseOrdersForExport({
      period: req.query.period,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      status: req.query.status,
      limit: req.query.limit,
    });
    const { buffer, contentType, extension } = buildPurchaseOrdersExportBuffer(rows, format);
    return sendExport(res, buffer, contentType, stampFilename("purchase-orders", extension));
  } catch (err) {
    console.error("assistant.exportPurchaseOrders:", err.message);
    return res.status(500).json({ success: false, message: err.message || "Export failed" });
  }
};

exports.exportRfqs = async (req, res) => {
  try {
    if (!assertAdminExport(req, res)) return;
    const {
      fetchRfqsForExport,
      buildRfqsExportBuffer,
      stampFilename,
    } = require("../services/assistant/catalogExcelExport");
    const format =
      String(req.query.format || "excel").toLowerCase() === "csv" ? "csv" : "excel";
    const rows = await fetchRfqsForExport({
      period: req.query.period,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      status: req.query.status,
      limit: req.query.limit,
    });
    const { buffer, contentType, extension } = buildRfqsExportBuffer(rows, format);
    return sendExport(res, buffer, contentType, stampFilename("rfqs", extension));
  } catch (err) {
    console.error("assistant.exportRfqs:", err.message);
    return res.status(500).json({ success: false, message: err.message || "Export failed" });
  }
};
