const express = require("express");
const router = express.Router();

// ✅ controller path is now: backend/src/controllers/customer.controller.js
const controller = require("../../controllers/customer.controller");

// Customer portal endpoints
router.get("/me", controller.me);
router.get("/projects", controller.projects);
router.get("/projects/:id", controller.projectById);
router.get("/quotes", controller.quotes);
router.get("/quotes/:id", controller.quoteById);
router.get("/documents", controller.documents);
router.get("/financial-summary", controller.financialSummary);
router.get("/invoices", controller.invoices);
router.get("/invoices/:id", controller.invoiceById);
router.post("/invoice/notify/:id", controller.notifyPayment);
router.get("/payments/summary", controller.paymentSummary);
router.post("/enquiry", controller.submitEnquiry);

// Admin CRUD endpoints
router.get("/list", controller.list);
router.post("/create", controller.create);
router.put("/update/:id", controller.update);
router.delete("/delete/:id", controller.delete);
router.post("/portal-login/:id", controller.setupPortalLogin);
router.post("/reset-password/:id", controller.resetPortalPassword);

module.exports = router;
