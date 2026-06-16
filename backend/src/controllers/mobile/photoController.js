const multer = require("multer");
const Photo = require("../../models/Photo");

// storage config
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage });

// photo upload middleware
exports.uploadPhotoMiddleware = upload.single("image");

// photo save controller
exports.savePhoto = async (req, res) => {
  try {
    const { jobId, workerId, caption } = req.body;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Image file is required",
      });
    }

    const newPhoto = await Photo.create({
      jobId,
      workerId,
      imageUrl: `/uploads/${req.file.filename}`,
      caption: caption || "",
    });

    res.json({
      success: true,
      message: "Photo uploaded successfully",
      data: newPhoto,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getPhotosByJob = async (req, res) => {
  try {
    const { jobId } = req.params;

    const photos = await Photo.find({ jobId }).sort({ createdAt: -1 });

    res.json({
      success: true,
      data: photos,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};