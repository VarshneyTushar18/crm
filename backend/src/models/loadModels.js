// Explicitly register all Mongoose models.
// Static requires guarantee that Vercel NFT (Node File Trace) bundles every model file
// and prevents MissingSchemaError during serverless execution.

// Core models
require("./coreModels/Admin");
require("./coreModels/AdminPassword");
require("./coreModels/Setting");
require("./coreModels/Upload");

// Legacy mobile models
require("./CheckIn");
require("./Photo");
require("./WorkUpdate");
require("./Job"); // MobileJob

// App models
require("./appModels/Attendance");
require("./appModels/AuthDevice");
require("./appModels/AuthOtpLog");
require("./appModels/AuthSession");
require("./appModels/Client");
require("./appModels/Contact");
require("./appModels/Customer");
require("./appModels/DefectSnag");
require("./appModels/Drafting");
require("./appModels/Employee");
require("./appModels/Fabrication");
require("./appModels/FabricationProgressLog");
require("./appModels/Installation");
require("./appModels/InstallationSummary");
require("./appModels/Invoice");
require("./appModels/JobCard");
require("./appModels/JobComment");
require("./appModels/KanbanTask");
require("./appModels/Lead");
require("./appModels/Leave");
require("./appModels/MaterialPurchase");
require("./appModels/Ncr");
require("./appModels/Notification");
require("./appModels/Payment");
require("./appModels/PaymentMode");
require("./appModels/Planning");
require("./appModels/PurchaseOrder");
require("./appModels/Qc");
require("./appModels/Quote");
require("./appModels/Rfq");
require("./appModels/ScheduleAssignment");
require("./appModels/Settings");
require("./appModels/Site");
require("./appModels/SiteEngineerReview");
require("./appModels/SiteEngineerReviewHistory");
require("./appModels/SiteMeasurement");
require("./appModels/Supplier");
require("./appModels/Taxes");
require("./appModels/User");
require("./appModels/WorkerAttendanceSession");
require("./appModels/WorkerTask");

// CRM Job MUST be loaded last to ensure "Job" refers to the canonical CRM Job model.
require("./appModels/Job");
