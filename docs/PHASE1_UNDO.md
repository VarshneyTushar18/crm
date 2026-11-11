# Phase 1 Implementation — Undo Guide

If you want to **revert all Phase 1 changes**, run from repo root:

```bash
git checkout -- .
git clean -fd docs/PHASE1_UNDO.md
```

Or revert specific areas:

## Backend files added
- `backend/src/utils/workflowDefaults.js`
- `backend/src/utils/leadSources.js`
- `backend/src/utils/makeCrudController.js`
- `backend/src/models/appModels/Supplier.js`
- `backend/src/models/appModels/Rfq.js`
- `backend/src/models/appModels/PurchaseOrder.js`
- `backend/src/models/appModels/Site.js`
- `backend/src/controllers/procurement.controller.js`
- `backend/src/routes/appRoutes/procurement.routes.js`
- `backend/src/routes/appRoutes/rfq.routes.js`
- `backend/src/middlewares/uploadSiteMeasurementFiles.js`

## Backend files modified
- `backend/src/models/appModels/Lead.js` — leadSource no longer enum
- `backend/src/models/appModels/Job.js` — stageStatus, subtasks, siteId
- `backend/src/models/appModels/MaterialPurchase.js` — Delayed, supplierId, PO ref
- `backend/src/models/appModels/Quote.js` — signatureImage in acceptanceAudit
- `backend/src/models/appModels/SiteMeasurement.js` — default Pending
- `backend/src/controllers/job.controller.js`
- `backend/src/controllers/quote.controller.js`
- `backend/src/controllers/siteMeasurement.controller.js`
- `backend/src/routes/appRoutes/settings.routes.js`
- `backend/src/routes/appRoutes/siteMeasurement.routes.js`
- `backend/src/routes/appRoutes/appApi.js`
- `backend/src/server.js`

## Frontend files added
- `frontend/src/api/phase1Api.js`
- `frontend/src/modules/SettingModule/LeadSourcesSettings/index.jsx`
- `frontend/src/pages/Procurement/Suppliers/index.jsx`
- `frontend/src/pages/Procurement/Rfq/index.jsx`
- `frontend/src/pages/Procurement/PurchaseOrders/index.jsx`
- `frontend/src/pages/Procurement/Sites/index.jsx`

## Frontend files modified
- `frontend/src/pages/Lead/LeadForm.jsx`
- `frontend/src/pages/Jobs/JobView.jsx`
- `frontend/src/pages/SiteMeasurement/index.jsx`
- `frontend/src/pages/MaterialPurchase/index.jsx`
- `frontend/src/modules/QuoteModule/ReadQuoteModule/index.jsx`
- `frontend/src/router/AppRouter.jsx`
- `frontend/src/apps/Navigation/NavigationContainer.jsx`

## New admin routes
| Route | Purpose |
|-------|---------|
| `/admin/settings/lead-sources` | Configure lead source dropdown |
| `/admin/suppliers` | Supplier master |
| `/admin/rfq` | RFQs multi-vendor |
| `/admin/purchase-orders` | PO tracking |
| `/admin/sites` | Multi-site locations |

Say **"undo phase 1"** and we can revert everything in one step.
