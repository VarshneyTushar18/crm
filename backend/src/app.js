const express = require("express");
const cors = require("cors");
const compression = require("compression");
const cookieParser = require("cookie-parser");
const path = require("path");
const jobRoutes = require("./routes/mobile/jobRoutes");
const coreAuthRouter = require("./routes/coreRoutes/coreAuth");
const coreApiRouter = require("./routes/coreRoutes/coreApi");
const coreDownloadRouter = require("./routes/coreRoutes/coreDownloadRouter");
const corePublicRouter = require("./routes/coreRoutes/corePublicRouter");
const checkinRoutes = require("./routes/mobile/checkinRoutes");
const photoRoutes = require("./routes/mobile/photoRoutes");
const adminAuth = require("./controllers/coreControllers/adminAuth");
const workUpdateRoutes = require("./routes/mobile/workUpdateRoutes");
const errorHandlers = require("./handlers/errorHandlers");
const erpApiRouter = require("./routes/appRoutes/appApi");

// Custom auth routes
const authRouter = require("./routes/appRoutes/auth.routes");

// Public settings route
const settingsPublicRoutes = require("./routes/appRoutes/settings.public.routes");

const app = express();

// ============================
// CORS
// ============================
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(compression());
app.use("/api/mobile", jobRoutes);
app.use("/api/mobile", checkinRoutes);
app.use("/api/mobile", photoRoutes);
app.use("/api/mobile", workUpdateRoutes);
// ============================
// STATIC FILES
// ============================
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// ============================
// PUBLIC ROUTES (NO TOKEN)
// ============================

// Idurar core auth
app.use("/api", coreAuthRouter);

// Custom auth routes
// Login URL => /api/auth/login
app.use("/api/auth", authRouter);

// Public settings
// Example => /api/settings/public
app.use("/api/settings", settingsPublicRoutes);

// Public downloads & public APIs
app.use("/download", coreDownloadRouter);
app.use("/public", corePublicRouter);

// ============================
// PROTECTED ROUTES (TOKEN REQUIRED)
// ============================

// Core protected APIs
app.use("/api", adminAuth.isValidAuthToken, coreApiRouter);

// App/ERP APIs
// IMPORTANT:
// This works for customer portal only if isValidAuthToken validates
// any logged-in user token (admin/worker/customer) and does NOT block
// customer role.
app.use("/api", adminAuth.isValidAuthToken, erpApiRouter);

// ============================
// HEALTH CHECK (OPTIONAL BUT USEFUL)
// ============================
app.get("/api/health", (req, res) => {
  return res.json({
    success: true,
    message: "API is running",
  });
});

// ============================
// ERROR HANDLERS
// ============================
app.use(errorHandlers.notFound);
app.use(errorHandlers.productionErrors);

module.exports = app;