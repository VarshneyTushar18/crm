const express = require("express");
const router = express.Router();

const loadSettings = require("../../middlewares/settings/loadSettings");
const updateBySettingKey = require("../../middlewares/settings/updateBySettingKey");

// ⚠️ Upload middleware ka correct path tumhare project me jo exist karta ho wo use karo.
// Example: "../../middlewares/uploadMiddleware" ya "../../middlewares/uploadMiddleware/singleStorageUpload"
// Main yahan safe fallback de raha hu:

let uploadModule;
try {
  uploadModule = require("../../middlewares/uploadMiddleware/singleStorageUpload");
} catch (e1) {
  try {
    uploadModule = require("../../middlewares/utils/singleStorageUpload");
  } catch (e2) {
    uploadModule = require("../../middlewares/uploadMiddleware");
  }
}

const getUploadMiddleware = (mod, fieldName) => {
  const m = mod?.default || mod;

  if (m && typeof m.single === "function") return m.single(fieldName);
  if (m && m.upload && typeof m.upload.single === "function") return m.upload.single(fieldName);

  if (typeof m === "function") {
    try {
      const maybe = m(fieldName);
      if (typeof maybe === "function") return maybe;
    } catch (e) {}
    return m; // direct middleware
  }

  throw new Error("Upload middleware not compatible. Check singleStorageUpload export.");
};

const uploadLogo = getUploadMiddleware(uploadModule, "logo");

// ✅ PUBLIC: Customer portal reads this (no admin)
router.get("/public", loadSettings, async (req, res) => {
  try {
    const settings = req.settings || req.serverData?.settings || req.serverData || {};

    const getVal = (key) => {
      if (Array.isArray(settings)) {
        const found = settings.find((s) => s?.key === key || s?.settingKey === key);
        return found?.value ?? found?.settingValue ?? "";
      }
      return settings[key] ?? "";
    };

    return res.json({
      success: true,
      result: {
        companyName: getVal("company_name") || "Company",
        logoUrl: getVal("company_logo") || "",
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ✅ ADMIN: update company name
router.patch("/company", (req, res, next) => {
  req.body.settingKey = "company_name";
  req.body.settingValue = req.body.companyName || "";
  next();
}, updateBySettingKey);

// ✅ ADMIN: upload logo
router.post("/logo", uploadLogo, (req, res, next) => {
  const file = req.file;
  if (!file) return res.status(400).json({ success: false, message: "No file uploaded" });

  const filename = file.filename || (file.path ? String(file.path).split("\\").pop() : "");
  req.body.settingKey = "company_logo";
  req.body.settingValue = `/uploads/${filename}`;
  next();
}, updateBySettingKey);

module.exports = router;