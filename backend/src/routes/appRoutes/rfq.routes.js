const express = require("express");
const controller = require("../../controllers/procurement.controller");

const router = express.Router();

router.get("/rfq/list", controller.listRfqs);
router.post("/rfq/create", controller.createRfq);
router.patch("/rfq/update/:id", controller.updateRfq);
router.post("/rfq/send/:id", controller.sendRfq);
router.post("/rfq/award/:id", controller.awardRfq);

router.get("/purchase-order/list", controller.listPurchaseOrders);
router.post("/purchase-order/create", controller.createPurchaseOrder);
router.patch("/purchase-order/update/:id", controller.updatePurchaseOrder);
router.post("/purchase-order/receive/:id", controller.receivePurchaseOrder);

module.exports = router;
