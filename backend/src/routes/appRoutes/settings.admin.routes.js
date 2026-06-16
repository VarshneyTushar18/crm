const express = require("express");
const router = express.Router();

const updateBySettingKey = require("../../middlewares/settings/updateBySettingKey");

// ✅ import upload module from correct place (use the one you already used in try/catch)
let uploadModule;
try {
  uploadModule = require("../../middlewares/utils/singleStorageUpload");
} catch (e1) {
  try {
    uploadModule = require("../../middlewares/uploadMiddleware/singleStorageUpload");
  } catch (e2) {
    const mw = require("../../middlewares/uploadMiddleware");
    uploadModule = mw.singleStorageUpload || mw.upload || mw;
  }
}

// ✅ normalize upload middleware (supports multer instance / factory / direct middleware / wrapped export)
const getUploadMiddleware = (mod, fieldName) => {
  if (!mod) throw new Error("Upload middleware module not found");

  // If module exports { default: ... }
  const m = mod.default || mod;

  // If it's multer instance: upload.single("logo")
  if (m && typeof m.single === "function") return m.single(fieldName);

  // If it's exported as { upload: multerInstance }
  if (m && m.upload && typeof m.upload.single === "function") return m.upload.single(fieldName);

  // If it's a factory: singleStorageUpload("logo") -> middleware
  if (typeof m === "function") {
    try {
      const maybe = m(fieldName);
      if (typeof maybe === "function") return maybe;
    } catch (e) {
      // ignore and try fallback below
    }
    // If it is already middleware (req,res,next)
    return m;
  }

  // If it's exported as { single: fn } (rare)
  if (m && typeof m.single === "function") return m.single(fieldName);

  throw new Error(
    "Upload middleware is not compatible. Please check singleStorageUpload export (should be multer instance OR function)."
  );
};

const uploadLogoMiddleware = getUploadMiddleware(uploadModule, "logo");

// --------------------
// POST /api/settings/logo  (ADMIN)
// form-data: logo=<file>
router.post(
  "/logo",
  uploadLogoMiddleware,
  (req, res, next) => {
    const file = req.file;
    if (!file) return res.status(400).json({ success: false, message: "No file uploaded" });

    const filename =
      file.filename ||
      (file.path ? String(file.path).split("\\").pop() : "");

    req.body.settingKey = "company_logo";
    req.body.settingValue = `/uploads/${filename}`;
    next();
  },
  updateBySettingKey
);

// --------------------
// PATCH /api/settings/company  (ADMIN)
// body: { companyName: "..." }
router.patch(
  "/company",
  (req, res, next) => {
    req.body.settingKey = "company_name";
    req.body.settingValue = req.body.companyName || "";
    next();
  },
  updateBySettingKey
);

module.exports = router;