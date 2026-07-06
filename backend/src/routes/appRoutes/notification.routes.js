const express = require("express");
const router = express.Router();
const controller = require("../../controllers/notification.controller");

router.get("/list", controller.list);
router.get("/admin/customer-receipts", controller.adminCustomerReceipts);
router.patch("/read/:id", controller.markRead);
router.patch("/read-all", controller.markAllRead);

module.exports = router;
