const mongoose = require("mongoose");

const photoSchema = new mongoose.Schema({
  jobId: {
    type: String,
    required: true,
  },
  workerId: {
    type: String,
    required: true,
  },
  imageUrl: {
    type: String,
    required: true,
  },
  caption: {
    type: String,
    default: "",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Photo", photoSchema);