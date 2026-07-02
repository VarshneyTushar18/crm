const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { slugify } = require("transliteration");

const { acceptInstallationFile } = require("../utils/uploadFileFilter");

const storage = multer.diskStorage({
  destination(req, file, cb) {
    const uploadPath = path.join(__dirname, "../../uploads/installation");
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const originalName = file.originalname.split(".")[0];
    const fileName = `${slugify(originalName)}-${uniqueSuffix}${ext}`;
    cb(null, fileName);
  },
});

const fileFilter = (req, file, cb) => {
  if (acceptInstallationFile(file)) {
    cb(null, true);
  } else {
    cb(new Error("Invalid file type. Allowed: images, PDF, Word, or video."), false);
  }
};

const uploadInstallationFiles = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 300 * 1024 * 1024,
  },
});

module.exports = uploadInstallationFiles;
