const createMemoryUpload = require("./createMemoryUpload");
const { acceptInstallationFile } = require("../utils/uploadFileFilter");

module.exports = createMemoryUpload({
  accept: acceptInstallationFile,
  rejectMessage: "Invalid file type. Allowed: images, PDF, Word, or video.",
});
