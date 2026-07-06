const multer = require("multer");

const createMemoryUpload = ({
  accept,
  rejectMessage = "File type not allowed",
  limits = { fileSize: 300 * 1024 * 1024 },
}) =>
  multer({
    storage: multer.memoryStorage(),
    fileFilter: (req, file, cb) => {
      if (accept(file)) {
        cb(null, true);
      } else {
        cb(new Error(rejectMessage), false);
      }
    },
    limits,
  });

module.exports = createMemoryUpload;
