const path = require("path");

const getExtension = (name = "") => path.extname(String(name)).toLowerCase();

const isPdfFile = (file = {}) => {
  const mimetype = String(file.mimetype || "").toLowerCase();
  const ext = getExtension(file.originalname);
  if (ext === ".pdf") return true;
  return [
    "application/pdf",
    "application/x-pdf",
    "application/acrobat",
    "application/vnd.pdf",
  ].includes(mimetype);
};

const isImageFile = (file = {}) => {
  const mimetype = String(file.mimetype || "").toLowerCase();
  return ["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(mimetype);
};

const isVideoFile = (file = {}) => {
  const mimetype = String(file.mimetype || "").toLowerCase();
  return ["video/mp4", "video/quicktime", "video/webm"].includes(mimetype);
};

const isDwgFile = (file = {}) => {
  const ext = getExtension(file.originalname);
  if ([".dwg", ".dxf"].includes(ext)) return true;
  const mimetype = String(file.mimetype || "").toLowerCase();
  return ["image/vnd.dwg", "application/acad", "application/x-autocad"].includes(mimetype);
};

const isWordFile = (file = {}) => {
  const ext = getExtension(file.originalname);
  if ([".doc", ".docx"].includes(ext)) return true;
  const mimetype = String(file.mimetype || "").toLowerCase();
  return [
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ].includes(mimetype);
};

const acceptImagePdfDrawing = (file) =>
  isImageFile(file) || isPdfFile(file) || isDwgFile(file) || isVideoFile(file);

const acceptImagePdfVideo = (file) =>
  isImageFile(file) || isPdfFile(file) || isVideoFile(file);

const acceptInstallationFile = (file) =>
  isImageFile(file) || isPdfFile(file) || isWordFile(file) || isVideoFile(file);

const acceptJobCommentFile = (file) =>
  isImageFile(file) || isPdfFile(file) || isWordFile(file) || isVideoFile(file);

module.exports = {
  isPdfFile,
  isImageFile,
  isVideoFile,
  isDwgFile,
  isWordFile,
  acceptImagePdfDrawing,
  acceptImagePdfVideo,
  acceptInstallationFile,
  acceptJobCommentFile,
};
