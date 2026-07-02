const router = require("express").Router();
const controller = require("../../controllers/dashboard.controller");

router.get("/admin-overview", controller.adminOverview);

module.exports = router;
