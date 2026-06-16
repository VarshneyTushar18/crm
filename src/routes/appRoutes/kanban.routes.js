const express = require("express");
const router = express.Router();

const controller = require("../../controllers/kanban.controller");

router.get("/list/:jobId", controller.listByJob);
router.post("/create", controller.create);
router.patch("/update/:id", controller.update);
router.delete("/delete/:id", controller.delete);

module.exports = router;