const express = require("express");
const { catchErrors } = require("@/handlers/errorHandlers");
const router = express.Router();

/**
 * Normalize route exports
 */
const asRouter = (mod, name) => {
  const r = mod?.default || mod?.router || mod;

  if (!r || typeof r.use !== "function") {
    console.error(`❌ Invalid router export in ${name}. Got:`, r);
    throw new Error(
      `Invalid router export in ${name}. It must export an express.Router() instance.`
    );
  }

  return r;
};

// ===============================
// CORE MODULE ROUTES
// ===============================

router.use("/auth", asRouter(require("./auth.routes"), "auth.routes"));
router.use("/lead", asRouter(require("./lead.routes"), "lead.routes"));
router.use("/quote", asRouter(require("./quote.routes"), "quote.routes"));
router.use("/kanban", asRouter(require("./kanban.routes"), "kanban.routes"));
router.use("/job", asRouter(require("./job.routes"), "job.routes"));

// ===============================
// PROJECT WORKFLOW MODULES
// ===============================

router.use("/planning", asRouter(require("./planning.routes"), "planning.routes"));
router.use(
  "/measurement",
  asRouter(require("./siteMeasurement.routes"), "siteMeasurement.routes")
);
router.use("/drafting", asRouter(require("./drafting.routes"), "drafting.routes"));
router.use(
  "/material-purchase",
  asRouter(require("./materialPurchase.routes"), "materialPurchase.routes")
);
router.use("/fabrication", asRouter(require("./fabrication.routes"), "fabrication.routes"));
router.use("/qc", asRouter(require("./qc.routes"), "qc.routes"));
router.use("/installation", asRouter(require("./installation.routes"), "installation.routes"));
router.use("/employee", asRouter(require("./employee.routes"), "employee.routes"));
router.use("/attendance", asRouter(require("./attendance.routes"), "attendance.routes"));

// ===============================
// USERS
// ===============================

router.use("/user", asRouter(require("./user.routes"), "user.routes"));

// ===============================
// SETTINGS
// ===============================

router.use("/settings", asRouter(require("./settings.routes"), "settings.routes"));

// ===============================
// CUSTOMER
// ===============================

router.use("/customer", asRouter(require("./customer.routes"), "customer.routes"));
router.use("/contact", require("./contact.routes"));

// ===============================
// DYNAMIC ERP ENTITIES
// ===============================

const appControllers = require("@/controllers/appControllers");
const { routesList } = require("@/models/utils");

const routerApp = (entity, controller) => {
  router.route(`/${entity}/create`).post(catchErrors(controller["create"]));
  router.route(`/${entity}/read/:id`).get(catchErrors(controller["read"]));
  router.route(`/${entity}/update/:id`).patch(catchErrors(controller["update"]));
  router.route(`/${entity}/delete/:id`).delete(catchErrors(controller["delete"]));
  router.route(`/${entity}/search`).get(catchErrors(controller["search"]));
  router.route(`/${entity}/list`).get(catchErrors(controller["list"]));
  router.route(`/${entity}/listAll`).get(catchErrors(controller["listAll"]));
  router.route(`/${entity}/filter`).get(catchErrors(controller["filter"]));
  router.route(`/${entity}/summary`).get(catchErrors(controller["summary"]));

  if (entity === "invoice" || entity === "quote" || entity === "payment") {
    router.route(`/${entity}/mail`).post(catchErrors(controller["mail"]));
    router.route(`/${entity}/download/:id`).get(catchErrors(controller["download"]));
  }

  if (entity === "invoice") {
    router.route(`/${entity}/issue/:id`).patch(catchErrors(controller["issue"]));
    router.route(`/${entity}/verify-payment/:id`).patch(catchErrors(controller["verifyPayment"]));
  }
};

routesList.forEach(({ entity, controllerName }) => {
  const controller = appControllers[controllerName];
  if (controller) {
    routerApp(entity, controller);
  }
});

module.exports = router;