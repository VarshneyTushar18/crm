const path = require("path");
const moduleAlias = require("module-alias");

// Explicit alias path — Vercel cwd may not be backend/, so package.json aliases can fail.
moduleAlias.addAliases({
  "@": path.resolve(__dirname, "../src"),
});

const mongoose = require("mongoose");
const { globSync } = require("glob");

let appInstance = null;
let initPromise = null;

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

    const rootDir = path.resolve(__dirname, "../src");
    const modelsFiles = globSync(
      path.join(rootDir, "models/**/*.js").replace(/\\/g, "/")
    );
    for (const filePath of modelsFiles) {
      require(path.resolve(filePath));
    }
    require(path.resolve(rootDir, "models/appModels/Job.js"));

    appInstance = require("../src/app");
    return appInstance;
  })();

  return initPromise;
}

module.exports = async function handler(req, res) {
  try {
    const app = await initialize();
    return app(req, res);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server failed to initialize on Vercel.",
      error: error.message,
    });
  }
};
