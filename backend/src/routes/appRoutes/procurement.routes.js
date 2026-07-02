const express = require("express");
const { makeCrudController } = require("../../utils/makeCrudController");

const supplier = makeCrudController("Supplier", "Supplier");
const site = makeCrudController("Site", "Site");

const router = express.Router();

router.get("/supplier/list", supplier.list);
router.get("/supplier/read/:id", supplier.read);
router.post("/supplier/create", supplier.create);
router.patch("/supplier/update/:id", supplier.update);
router.delete("/supplier/delete/:id", supplier.remove);

router.get("/site/list", site.list);
router.get("/site/read/:id", site.read);
router.post("/site/create", site.create);
router.patch("/site/update/:id", site.update);
router.delete("/site/delete/:id", site.remove);

module.exports = router;
