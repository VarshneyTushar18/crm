const express = require("express");
const router = express.Router();

const quoteController = require("../../controllers/quote.controller");

// LIST
router.get("/list", quoteController.listQuotes);

// READ
router.get("/search", quoteController.searchQuotes);
router.get("/read/:id", quoteController.readQuote);
router.get("/download/:id", quoteController.downloadQuotePdf);
// CREATE
router.post("/create", quoteController.createQuote);

// UPDATE
router.patch("/update/:id", quoteController.updateQuote);

// DELETE
router.delete("/delete/:id", quoteController.deleteQuote);

// APPROVE -> CREATE JOB
router.post("/approve/:id", quoteController.approveQuoteAndCreateJob);

module.exports = router;