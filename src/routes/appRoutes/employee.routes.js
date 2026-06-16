const express = require("express");
const router = express.Router();

const employeeController = require("@/controllers/employee.controller");

router.get("/list", employeeController.list);
router.get("/read/:id", employeeController.read);
router.post("/create", employeeController.create);
router.patch("/update/:id", employeeController.update);
router.delete("/delete/:id", employeeController.delete);

module.exports = router;