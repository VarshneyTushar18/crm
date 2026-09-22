const path = require("path");
const moduleAlias = require("module-alias");
const mongoose = require("mongoose");

// Ensure @ alias always resolves to backend/src regardless of how app.js is invoked
moduleAlias.addAliases({
  "@": path.resolve(__dirname),
});

// Explicitly load all models before routers/controllers are imported
require("./models/loadModels");

const express = require("express");
const cors = require("cors");
const compression = require("compression");
const cookieParser = require("cookie-parser");
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
const handleUploadErrors = require("./middlewares/handleUploadErrors");
const erpApiRouter = require("./routes/appRoutes/appApi");
const { isOriginAllowed } = require("./utils/corsOrigins");

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
    origin(origin, callback) {
      if (!origin || isOriginAllowed(origin)) {
        return callback(null, origin || true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

app.use(cookieParser());
app.use(express.json({ limit: "12mb" }));
app.use(express.urlencoded({ extended: true, limit: "12mb" }));
app.use(compression());

// Ensure MongoDB is connected for every request (critical for Vercel serverless)
let dbPromise = null;
app.use(async (req, res, next) => {
  if (mongoose.connection.readyState === 1 || mongoose.connection.readyState === 2) {
    return next();
  }
  try {
    if (!process.env.DATABASE) {
      require("dotenv").config({ path: path.resolve(__dirname, "../.env"), override: false });
      require("dotenv").config({ path: path.resolve(__dirname, "../.env.local"), override: false });
    }
    if (!process.env.DATABASE) {
      return res.status(500).json({
        success: false,
        message: "Missing DATABASE environment variable.",
      });
    }
    if (!dbPromise) {
      dbPromise = mongoose.connect(process.env.DATABASE).catch((err) => {
        dbPromise = null;
        throw err;
      });
    }
    await dbPromise;
    return next();
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Database connection failed",
      error: err.message,
    });
  }
});

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

// Health check & status endpoints (public, unauthenticated)
app.get(["/", "/api", "/api/"], (req, res) => {
  return res.json({
    success: true,
    message: "CRM API Backend is running",
  });
});

app.get("/api/health", (req, res) => {
  return res.json({
    success: true,
    message: "API is running",
  });
});

// GridFS / cloud file downloads (signed URL — no auth header needed in new tab)
const fileDownloadController = require("./controllers/fileDownload.controller");
app.get("/api/files/:id", fileDownloadController.download);

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
// ERROR HANDLERS
// ============================
app.use(handleUploadErrors);
app.use(errorHandlers.notFound);
app.use(errorHandlers.productionErrors);

module.exports = app;