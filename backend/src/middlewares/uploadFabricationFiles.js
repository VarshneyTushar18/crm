const createMemoryUpload = require("./createMemoryUpload");
const { acceptImagePdfVideo } = require("../utils/uploadFileFilter");

module.exports = createMemoryUpload({
  accept: acceptImagePdfVideo,
  rejectMessage: "Only images, PDF, or video files are allowed",
});
