const express = require("express");
const { makeCrudController } = require("../../utils/makeCrudController");
const siteController = require("../../controllers/site.controller");

const supplier = makeCrudController("Supplier", "Supplier");

const router = express.Router();

router.get("/supplier/list", supplier.list);
router.get("/supplier/read/:id", supplier.read);
router.post("/supplier/create", supplier.create);
router.patch("/supplier/update/:id", supplier.update);
router.delete("/supplier/delete/:id", supplier.remove);

router.get("/site/list", siteController.list);
router.get("/site/read/:id", siteController.read);
router.post("/site/create", siteController.create);
router.patch("/site/update/:id", siteController.update);
router.delete("/site/delete/:id", siteController.remove);

module.exports = router;
