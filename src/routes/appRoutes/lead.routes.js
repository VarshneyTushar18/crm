const express = require("express");
const router = express.Router();

// ✅ IMPORTANT: same file where you exported listLeads/createLead/updateLead/deleteLead/createJobFromLead
const leadController = require("../../controllers/lead.controller");

// ✅ Safety check (optional, but debugging me help karega)
if (!leadController?.listLeads) console.log("❌ listLeads missing from lead.controller.js");
if (!leadController?.createLead) console.log("❌ createLead missing from lead.controller.js");
if (!leadController?.updateLead) console.log("❌ updateLead missing from lead.controller.js");
if (!leadController?.deleteLead) console.log("❌ deleteLead missing from lead.controller.js");
if (!leadController?.createJobFromLead) console.log("❌ createJobFromLead missing from lead.controller.js");

// Routes
router.get("/read/:id", leadController.readLead);
router.get("/list", leadController.listLeads);
router.post("/create", leadController.createLead);
router.patch("/update/:id", leadController.updateLead); // ✅ PATCH
router.delete("/delete/:id", leadController.deleteLead);

// ✅ Add Lead Interaction
router.post("/:id/interaction", leadController.addInteraction);

// ✅ Convert Lead -> Job + Customer create/link
router.post("/convert-to-job/:id", leadController.createJobFromLead);

module.exports = router;
