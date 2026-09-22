const express = require("express");
const router = express.Router();
const controller = require("../../controllers/leave.controller");

router.get("/list", controller.list);
router.get("/mine", controller.listMine);
router.post("/apply", controller.apply);
router.post("/create", controller.create);
router.patch("/update/:id", controller.update);
router.post("/approve/:id", controller.approve);
router.post("/reject/:id", controller.reject);
router.delete("/delete/:id", controller.delete);

module.exports = router;
