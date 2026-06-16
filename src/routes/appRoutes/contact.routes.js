const express = require("express");
const router = express.Router();
const controller = require("@/controllers/contact.controller");
const auth = require("@/controllers/coreControllers/adminAuth");

router.post("/create", auth.isValidAuthToken, controller.createContact);
router.get("/list", auth.isValidAuthToken, controller.listContacts);
router.get("/my", auth.isValidAuthToken, controller.listCustomerContacts);
router.post("/:id/reply", auth.isValidAuthToken, controller.replyContact);
router.patch("/:id/respond", auth.isValidAuthToken, controller.respondContact);

module.exports = router;