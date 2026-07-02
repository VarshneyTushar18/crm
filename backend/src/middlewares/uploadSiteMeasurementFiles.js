const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { slugify } = require("transliteration");

const storage = multer.diskStorage({
  destination(req, file, cb) {
    const uploadPath = path.join(__dirname, "../../uploads/site-measurement");
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename(req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const originalName = file.originalname.split(".")[0];
    cb(null, `${slugify(originalName)}-${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
    "image/vnd.dwg",
    "application/acad",
    "video/mp4",
    "video/quicktime",
    "video/webm",
  ];
  if (allowed.includes(file.mimetype) || file.originalname.match(/\.(dwg|dxf)$/i)) {
    cb(null, true);
  } else {
    cb(new Error("Only JPEG, PNG, PDF, or drawing files are allowed"), false);
  }
};

module.exports = multer({
  storage,
  fileFilter,
  limits: { fileSize: 300 * 1024 * 1024 },
});
