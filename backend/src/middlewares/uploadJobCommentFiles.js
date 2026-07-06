const createMemoryUpload = require("./createMemoryUpload");
const { acceptJobCommentFile } = require("../utils/uploadFileFilter");

module.exports = createMemoryUpload({
  accept: acceptJobCommentFile,
  rejectMessage: "Invalid file type. Allowed: images, PDF, Word, or video.",
});
