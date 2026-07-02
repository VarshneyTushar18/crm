const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { slugify } = require("transliteration");

const { acceptJobCommentFile } = require("../utils/uploadFileFilter");

const storage = multer.diskStorage({
  destination(req, file, cb) {
    const uploadPath = path.join(__dirname, "../../uploads/job-comments");
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename(req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const originalName = file.originalname.split(".")[0];
    const fileName = `${slugify(originalName)}-${uniqueSuffix}${ext}`;
    cb(null, fileName);
  },
});

const fileFilter = (req, file, cb) => {
  if (acceptJobCommentFile(file)) {
    cb(null, true);
  } else {
    cb(new Error("Invalid file type. Allowed: images, PDF, Word, video."), false);
  }
};

const uploadJobCommentFiles = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 300 * 1024 * 1024,
    files: 5,
  },
});

module.exports = uploadJobCommentFiles;
