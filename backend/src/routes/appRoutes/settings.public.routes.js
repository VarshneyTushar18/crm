const express = require("express");
const router = express.Router();

const loadSettings = require("../../middlewares/settings/loadSettings");

router.get("/public", loadSettings, async (req, res) => {
  try {
    // loadSettings ka output different projects me different hota hai
    const settings =
      req.settings ||
      req.serverData?.settings ||
      req.serverData ||
      {};

    const getVal = (key) => {
      // if array
      if (Array.isArray(settings)) {
        const found = settings.find((s) => s?.key === key || s?.settingKey === key);
        return found?.value ?? found?.settingValue ?? "";
      }
      // if object
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

module.exports = router;