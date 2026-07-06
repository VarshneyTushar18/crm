const createMemoryUpload = require("./createMemoryUpload");
const { isPdfFile } = require("../utils/uploadFileFilter");

module.exports = createMemoryUpload({
  accept: isPdfFile,
  rejectMessage: "Only PDF files are allowed",
});
