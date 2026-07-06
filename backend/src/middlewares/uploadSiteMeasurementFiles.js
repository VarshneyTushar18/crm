const createMemoryUpload = require("./createMemoryUpload");
const { acceptImagePdfDrawing } = require("../utils/uploadFileFilter");

module.exports = createMemoryUpload({
  accept: acceptImagePdfDrawing,
  rejectMessage: "Only JPEG, PNG, PDF, video, or drawing files are allowed",
});
