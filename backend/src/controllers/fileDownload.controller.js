const { verifyFileSig, openGridFsDownload } = require("../utils/persistUpload");

exports.download = async (req, res) => {
  try {
    const { id } = req.params;
    const { sig } = req.query;

    if (!verifyFileSig(id, sig)) {
      return res.status(403).json({ success: false, message: "Invalid or missing file access token" });
    }

    return openGridFsDownload(id, res);
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
