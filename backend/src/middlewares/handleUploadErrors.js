const multer = require("multer");

const handleUploadErrors = (err, req, res, next) => {
  if (!err) return next();

  if (err instanceof multer.MulterError) {
    const message =
      err.code === "LIMIT_FILE_SIZE"
        ? "File is too large. Maximum upload size is 300 MB."
        : err.message;
    return res.status(400).json({ success: false, message });
  }

  if (/files are allowed|Invalid file type|Only PDF/i.test(String(err.message || ""))) {
    return res.status(400).json({ success: false, message: err.message });
  }

  return next(err);
};

module.exports = handleUploadErrors;
