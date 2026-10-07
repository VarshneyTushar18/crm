const router = require("express").Router();
const adminAuth = require("@/controllers/coreControllers/adminAuth");
const assistantController = require("@/controllers/assistant.controller");

router.post("/chat", adminAuth.requireRoles("admin"), assistantController.chat);
router.post(
  "/chat/stream",
  adminAuth.requireRoles("admin"),
  assistantController.chatStream
);
router.get(
  "/exports/jobs",
  adminAuth.requireRoles("admin"),
  assistantController.exportJobs
);
router.get(
  "/exports/invoices",
  adminAuth.requireRoles("admin"),
  assistantController.exportInvoices
);
router.get(
  "/exports/payments",
  adminAuth.requireRoles("admin"),
  assistantController.exportPayments
);
router.get(
  "/exports/attendance",
  adminAuth.requireRoles("admin"),
  assistantController.exportAttendance
);
router.get(
  "/exports/leads",
  adminAuth.requireRoles("admin"),
  assistantController.exportLeads
);
router.get(
  "/exports/quotes",
  adminAuth.requireRoles("admin"),
  assistantController.exportQuotes
);
router.get(
  "/exports/defects",
  adminAuth.requireRoles("admin"),
  assistantController.exportDefects
);
router.get(
  "/exports/purchase-orders",
  adminAuth.requireRoles("admin"),
  assistantController.exportPurchaseOrders
);
router.get(
  "/exports/rfqs",
  adminAuth.requireRoles("admin"),
  assistantController.exportRfqs
);
router.get(
  "/email-drafts/:id",
  adminAuth.requireRoles("admin"),
  assistantController.getEmailDraft
);
router.patch(
  "/email-drafts/:id",
  adminAuth.requireRoles("admin"),
  assistantController.updateEmailDraft
);
router.post(
  "/email-drafts/:id/send",
  adminAuth.requireRoles("admin"),
  assistantController.sendEmailDraft
);
router.post(
  "/email-drafts/:id/cancel",
  adminAuth.requireRoles("admin"),
  assistantController.cancelEmailDraft
);

module.exports = router;
