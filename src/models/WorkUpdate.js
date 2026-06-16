const mongoose = require("mongoose");

const workUpdateSchema = new mongoose.Schema({
  jobId: {
    type: String,
    required: true,
  },
  workerId: {
    type: String,
    required: true,
  },
  note: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("WorkUpdate", workUpdateSchema);