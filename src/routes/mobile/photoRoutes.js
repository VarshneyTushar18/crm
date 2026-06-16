const express = require("express");
const router = express.Router();

const photoController = require("../../controllers/mobile/photoController");

// upload + save photo
router.post(
  "/photo-upload",
  photoController.uploadPhotoMiddleware,
  photoController.savePhoto
);

// get photos by job
router.get("/photos/:jobId", photoController.getPhotosByJob);

module.exports = router;