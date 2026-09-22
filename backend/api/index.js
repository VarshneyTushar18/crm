const path = require("path");
const moduleAlias = require("module-alias");

// Explicit alias path — Vercel cwd may not be backend/, so package.json aliases can fail.
moduleAlias.addAliases({
  "@": path.resolve(__dirname, "../src"),
});

const mongoose = require("mongoose");
const { applyCorsHeaders } = require("../src/utils/corsOrigins");

let appInstance = null;
let initPromise = null;

/** Vercel catch-all routes may strip the /api prefix before Express sees the URL. */
const normalizeVercelUrl = (req) => {
  const url = req.url || "/";
  if (url.startsWith("/api")) return;

  const pathname = url.startsWith("/") ? url : `/${url}`;
  req.url = `/api${pathname}`;
};

async function initialize() {
  if (appInstance) return appInstance;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const envPath = path.resolve(__dirname, "../.env");
    const envLocalPath = path.resolve(__dirname, "../.env.local");
    require("dotenv").config({ path: envPath, override: false });
    require("dotenv").config({ path: envLocalPath, override: false });

    if (!process.env.DATABASE) {
      throw new Error("Missing DATABASE environment variable.");
    }

    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.DATABASE);
    }

    require("../src/models/loadModels");

    appInstance = require("../src/app");
    return appInstance;
  })();

  return initPromise;
}

module.exports = async function handler(req, res) {
  applyCorsHeaders(req, res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  try {
    normalizeVercelUrl(req);
    const app = await initialize();
    return app(req, res);
  } catch (error) {
    applyCorsHeaders(req, res);
    return res.status(500).json({
      success: false,
      message: "Server failed to initialize on Vercel.",
      error: error.message,
    });
  }
};
