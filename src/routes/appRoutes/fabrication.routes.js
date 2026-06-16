const express = require("express");
const router = express.Router();
const fabricationController = require("../../controllers/fabrication.controller");

router.get("/list/:jobId", fabricationController.listByJob);
router.post("/create", fabricationController.create);
router.patch("/update/:id", fabricationController.update);
router.delete("/delete/:id", fabricationController.remove);

module.exports = router;